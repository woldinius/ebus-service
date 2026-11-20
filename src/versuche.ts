// Versuche: geführte Abläufe für die aktive Kommunikation mit einem Gerät am eBus, gestartet in der Oberfläche von jemandem, der
// am Gerät steht. Ein Versuch fragt Werte über ebusd ab, schreibt (nur Freigegebenes), bittet um Handgriffe am Gerät und wartet
// auf „Erledigt“. Jeder Schritt, jede Anfrage und jede Antwort landet mit Zeit als Ereignis im Speicher; die Telegramme dazu
// schreibt der Mitschnitt ohnehin mit. Daraus lässt sich das Protokoll des Geräts danach entschlüsseln.
//
// Der Lauf lebt im Dienst, nicht im Browser: Sperrt sich das Handy, läuft er weiter. Es läuft höchstens einer zur Zeit.
// Abbrechen wirkt in Wartezeiten; was ein Versuch in finally aufräumt (Stufe zurück), läuft danach noch.
import type { Antwort, Befehle } from './ebusd.ts';
import type { Ereignis, LaufStatus, NeuesEreignis, Speicher } from './speicher.ts';

export type Art = 'erledigt' | 'eingabe' | 'warten' | 'arbeitet';

export interface Schritt {
  nr: number;
  art: Art; // erledigt/eingabe/warten: wartet auf „Weiter“; arbeitet: liest oder schreibt gerade
  text: string;
  seit: number;
  bis: number | null; // warten: spätestens dann geht es von selbst weiter
  fortschritt: { fertig: number; gesamt: number } | null;
}

export interface Wert {
  name: string;
  wert: string;
  ok: boolean;
  zeit: number;
}

export interface Beobachten {
  beobachten?: string[]; // diese Werte während des Wartens immer wieder lesen
  alleMs?: number;
}

export interface Kontext {
  readonly signal: AbortSignal;
  readonly lesbar: string[];
  readonly cwl: string; // Slave-Adresse des Geräts, zwei Hex-Ziffern
  lies(namen: string[]): Promise<Record<string, string>>;
  schreibe(name: string, wert: string): Promise<Antwort>;
  hex(daten: string): Promise<Antwort>;
  erledigt(text: string, o?: Beobachten): Promise<string>;
  eingabe(text: string, o?: Beobachten): Promise<string>;
  warte(ms: number, text: string, o?: Beobachten & { bis?: (werte: Record<string, string>) => boolean }): Promise<string>;
  arbeite(text: string, gesamt?: number): void;
  fortschritt(fertig: number): void;
  notiz(text: string): void;
}

export interface Versuch {
  id: string;
  titel: string;
  beschreibung: string;
  dauer: string;
  einmalig?: string; // Warnung vor dem Start, wenn sich der Versuch nicht wiederholen lässt
  ablauf(k: Kontext): Promise<void>;
}

export interface LaufLage {
  id: number;
  versuch: string;
  titel: string;
  start: number;
  ende: number | null;
  status: LaufStatus;
  fehler: string | null;
  schritt: Schritt | null;
  werte: Wert[];
  ereignisse: Ereignis[]; // die letzten
}

/** Was geschrieben werden darf: nur der Lüftungsmodus, der laut Definition nach wenigen Minuten von selbst zurückfällt. */
export const SCHREIBBAR: Record<string, string[]> = { SetFanMode: ['Holiday', 'Reduced', 'Normal', 'High'] };

export class VersuchFehler extends Error {
  code: number;
  constructor(code: number, text: string) {
    super(text);
    this.code = code;
  }
}

class Abgebrochen extends Error {}

const LETZTE = 40;

function schlafen(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((r) => {
    if (signal.aborted) return r();
    const t = setTimeout(fertig, Math.max(0, ms));
    function fertig() {
      clearTimeout(t);
      signal.removeEventListener('abort', fertig);
      r();
    }
    signal.addEventListener('abort', fertig);
  });
}

class Lauf {
  lage: LaufLage;
  ac = new AbortController();
  warter: { nr: number; fertig: (notiz: string) => void } | null = null;
  werte = new Map<string, Wert>();
  ende: Promise<void> = Promise.resolve();
  private nr = 0;
  private o: { befehle: Befehle | null; speicher: Speicher; kreis: string; cwl: string; lesbar: string[]; faktor: number; jetzt: () => number };

  constructor(lage: LaufLage, o: Lauf['o']) {
    this.lage = lage;
    this.o = o;
  }

  protokoll(e: Omit<NeuesEreignis, 'zeit'>): void {
    const zeit = this.o.jetzt();
    const id = this.o.speicher.ereignis(this.lage.id, { ...e, zeit });
    const x: Ereignis = {
      id, lauf: this.lage.id, zeit, art: e.art, text: e.text ?? null, befehl: e.befehl ?? null, antwort: e.antwort ?? null,
      ok: e.ok ?? null, ms: e.ms ?? null,
    };
    this.lage.ereignisse = [...this.lage.ereignisse, x].slice(-LETZTE);
  }

  private async befehl(art: string, text: string, zeile: string): Promise<Antwort> {
    if (!this.o.befehle) throw new Error('Keine Verbindung zu ebusd eingestellt (EBUSD)');
    const a = await this.o.befehle.befehl(zeile).catch((e: Error) => {
      this.protokoll({ art: 'fehler', text, befehl: zeile, antwort: e.message, ok: false });
      throw e;
    });
    this.protokoll({ art, text, befehl: zeile, antwort: a.text, ok: a.ok, ms: a.ms });
    return a;
  }

  private setze(art: Art, text: string, bis: number | null = null, gesamt?: number): number {
    const nr = ++this.nr;
    this.lage.schritt = { nr, art, text, seit: this.o.jetzt(), bis, fortschritt: gesamt ? { fertig: 0, gesamt } : null };
    this.protokoll({ art: 'schritt', text });
    return nr;
  }

  kontext(): Kontext {
    const { o } = this;
    const signal = this.ac.signal;
    const lies = async (namen: string[]) => {
      const aus: Record<string, string> = {};
      for (const name of namen) {
        if (!o.lesbar.includes(name)) {
          this.protokoll({ art: 'fehler', text: name, antwort: 'nicht in der Definition', ok: false });
          continue;
        }
        const a = await this.befehl('lesen', name, `read -f -c ${o.kreis} ${name}`);
        this.werte.set(name, { name, wert: a.text, ok: a.ok, zeit: o.jetzt() });
        this.lage.werte = [...this.werte.values()];
        if (a.ok) aus[name] = a.text;
      }
      return aus;
    };
    const warten = async (
      art: 'erledigt' | 'eingabe' | 'warten', text: string, b: Beobachten & { bis?: (w: Record<string, string>) => boolean }, ms?: number,
    ): Promise<string> => {
      const dauer = ms === undefined ? undefined : ms * o.faktor;
      const ende = dauer === undefined ? null : o.jetzt() + dauer;
      const nr = this.setze(art, text, ende);
      // „Weiter“ aus der Oberfläche: merkt sich die Notiz und weckt die Pause zwischen zwei Abfragen
      const w = { notiz: null as string | null, wecken: () => {} };
      this.warter = { nr, fertig: (n) => ((w.notiz = n), w.wecken()) };
      let grund = '';
      try {
        for (;;) {
          if (signal.aborted) throw new Abgebrochen('abgebrochen');
          if (w.notiz !== null) break;
          if (b.beobachten?.length) {
            const werte = await lies(b.beobachten);
            if (b.bis?.(werte)) {
              grund = 'Bedingung erfüllt';
              break;
            }
          }
          if (ende !== null && o.jetzt() >= ende) {
            grund = 'Zeit um';
            break;
          }
          if (w.notiz !== null) break;
          const pause = b.beobachten?.length ? (b.alleMs ?? 5000) * o.faktor : 1000;
          await Promise.race([
            schlafen(ende === null ? pause : Math.min(pause, ende - o.jetzt()), signal),
            new Promise<void>((r) => (w.wecken = r)),
          ]);
        }
      } finally {
        this.warter = null;
      }
      const was = art === 'warten' ? 'weiter' : art;
      this.protokoll({ art: was, text: w.notiz !== null ? w.notiz || (art === 'warten' ? 'vorzeitig' : '') : grund });
      return w.notiz ?? '';
    };
    return {
      signal,
      lesbar: o.lesbar,
      cwl: o.cwl,
      lies,
      schreibe: async (name, wert) => {
        if (!SCHREIBBAR[name]?.includes(wert)) throw new Error(`Schreiben nicht freigegeben: ${name} ${wert}`);
        return this.befehl('schreiben', `${name} ${wert}`, `write -c ${o.kreis} ${name} ${wert}`);
      },
      hex: async (daten) => {
        const d = daten.toLowerCase();
        if (!new RegExp(`^${o.cwl}40(22|50)01[0-9a-f]{2}$`).test(d)) throw new Error(`hex nicht freigegeben: ${daten}`);
        return this.befehl('hex', d, `hex ${d}`);
      },
      erledigt: (text, b = {}) => warten('erledigt', text, b),
      eingabe: (text, b = {}) => warten('eingabe', text, b),
      warte: (ms, text, b = {}) => warten('warten', text, b, ms),
      arbeite: (text, gesamt) => {
        this.setze('arbeitet', text, null, gesamt);
      },
      fortschritt: (fertig) => {
        const s = this.lage.schritt;
        if (s?.fortschritt) s.fortschritt = { ...s.fortschritt, fertig };
      },
      notiz: (text) => this.protokoll({ art: 'notiz', text }),
    };
  }
}

export interface LeiterOptionen {
  befehle: Befehle | null;
  speicher: Speicher;
  versuche: Versuch[];
  lesbar: string[];
  erlaubt: boolean; // Versuchsbetrieb an (VERSUCHE=an)
  kreis?: string; // Circuit in ebusd, z. B. excellent
  cwl?: string;
  faktor?: number; // Zeiten im Test verkürzen
  jetzt?: () => number;
}

export class Versuchsleiter {
  o: Required<LeiterOptionen>;
  aktiv: Lauf | null = null;

  constructor(o: LeiterOptionen) {
    this.o = { kreis: 'excellent', cwl: '3c', faktor: 1, jetzt: Date.now, ...o };
    if (!/^[0-9a-f]{2}$/.test(this.o.cwl)) throw new Error(`CWL ist keine Adresse: ${this.o.cwl}`);
    if (!/^[A-Za-z0-9_.-]+$/.test(this.o.kreis)) throw new Error(`KREIS ungültig: ${this.o.kreis}`);
  }

  liste() {
    return this.o.versuche.map(({ id, titel, beschreibung, dauer, einmalig }) => ({ id, titel, beschreibung, dauer, einmalig: einmalig ?? null }));
  }

  lage() {
    return { erlaubt: this.o.erlaubt && !!this.o.befehle, versuche: this.liste(), lauf: this.aktiv?.lage ?? null };
  }

  starte(id: string): LaufLage {
    if (!this.o.erlaubt || !this.o.befehle) throw new VersuchFehler(403, 'Versuchsbetrieb ist aus');
    const v = this.o.versuche.find((x) => x.id === id);
    if (!v) throw new VersuchFehler(404, `Versuch ${id} gibt es nicht`);
    if (this.aktiv?.lage.status === 'laeuft') throw new VersuchFehler(409, `Es läuft schon: ${this.aktiv.lage.titel}`);
    const { speicher, jetzt } = this.o;
    const start = jetzt();
    const lid = speicher.neuerLauf(v.id, v.titel, start);
    const lauf = new Lauf(
      { id: lid, versuch: v.id, titel: v.titel, start, ende: null, status: 'laeuft', fehler: null, schritt: null, werte: [], ereignisse: [] },
      { ...this.o, befehle: this.o.befehle },
    );
    this.aktiv = lauf;
    lauf.ende = (async () => {
      let status: LaufStatus = 'fertig';
      let fehler: string | null = null;
      try {
        await v.ablauf(lauf.kontext());
        if (lauf.ac.signal.aborted) status = 'abgebrochen';
      } catch (e) {
        if (lauf.ac.signal.aborted) status = 'abgebrochen';
        else {
          status = 'fehler';
          fehler = (e as Error).message;
        }
      }
      const ende = jetzt();
      speicher.beendeLauf(lid, ende, status, fehler);
      Object.assign(lauf.lage, { status, fehler, ende, schritt: null });
    })();
    return lauf.lage;
  }

  /** „Erledigt“/„Weiter“ für genau diesen Schritt; ein zweites Tippen auf einen alten Schritt zählt nicht. */
  weiter(lauf: number, nr: number, notiz: string): void {
    const l = this.aktiv;
    if (!l || l.lage.id !== lauf || l.lage.status !== 'laeuft') throw new VersuchFehler(409, 'Dieser Lauf läuft nicht');
    if (!l.warter || l.warter.nr !== nr) throw new VersuchFehler(409, 'Dieser Schritt ist schon vorbei');
    const { fertig } = l.warter;
    l.warter = null; // sofort: ein zweites Tippen, bevor der Ablauf weiter ist, zählt nicht
    fertig(notiz.slice(0, 2000));
  }

  abbrechen(lauf: number): void {
    const l = this.aktiv;
    if (!l || l.lage.id !== lauf || l.lage.status !== 'laeuft') throw new VersuchFehler(409, 'Dieser Lauf läuft nicht');
    if (!l.ac.signal.aborted) l.protokoll({ art: 'abbruch', text: 'in der Oberfläche abgebrochen' });
    l.ac.abort();
  }

  /** Beim Beenden des Dienstes: laufenden Versuch abbrechen und höchstens ms warten, bis er aufgeräumt hat. */
  async beenden(ms: number): Promise<void> {
    const l = this.aktiv;
    if (!l || l.lage.status !== 'laeuft') return;
    if (!l.ac.signal.aborted) l.protokoll({ art: 'abbruch', text: 'Dienst endet' });
    l.ac.abort();
    await Promise.race([l.ende, new Promise((r) => setTimeout(r, ms).unref())]);
  }
}
