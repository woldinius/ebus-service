// Versuche gegen eine nachgebaute CWL (Befehle wie ebusd sie beantwortet, aus ebusd-echt.test.ts bekannt). Zeiten verkürzt (faktor).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CWL_VERSUCHE, FILTER, STUFE } from './cwl-versuche.ts';
import type { Antwort, Befehle } from './ebusd.ts';
import { Speicher } from './speicher.ts';
import { Versuchsleiter, VersuchFehler, type Kontext, type LaufLage, type Versuch } from './versuche.ts';

const LESBAR = [...new Set([...STUFE, ...FILTER, 'FlowMode0', 'FlowMode1', 'FlowMode2', 'FlowMode3', 'InsideTemperature', 'OutsideTemperature'])];

/** Antwortet wie ebusd mit der Definition der CWL. Nach SetFanMode High hält sie die Stufe für `haelt` Lesungen von FanMode. */
class NachgebauteCwl implements Befehle {
  zeilen: string[] = [];
  modus = 'Normal';
  haelt = 3;
  private hoch = 0;
  async befehl(z: string): Promise<Antwort> {
    this.zeilen.push(z);
    let text = '1';
    let m: RegExpMatchArray | null;
    if (z === 'read -f -c excellent FanMode') {
      if (this.modus === 'High' && this.hoch++ >= this.haelt) this.modus = 'Normal';
      text = this.modus;
    } else if ((m = /^write -c excellent SetFanMode (\w+)$/.exec(z))) {
      this.modus = m[1]!;
      this.hoch = 0;
      text = 'done';
    } else if (z.startsWith('hex ')) text = z.endsWith('01') ? '020002' : 'ERR: NAK received';
    else if (!z.startsWith('read -f -c excellent ')) text = 'ERR: command not found';
    return { text, ok: !text.startsWith('ERR:'), ms: 1 };
  }
}

function leiter(o: { befehle?: Befehle | null; versuche?: Versuch[]; erlaubt?: boolean } = {}) {
  const speicher = new Speicher(':memory:');
  const cwl = new NachgebauteCwl();
  const l = new Versuchsleiter({
    befehle: o.befehle === undefined ? cwl : o.befehle, speicher, versuche: o.versuche ?? CWL_VERSUCHE, lesbar: LESBAR,
    erlaubt: o.erlaubt ?? true, faktor: 0.001,
  });
  return { l, cwl, speicher };
}

const kurz = () => new Promise((r) => setTimeout(r, 1));

/** Spielt den Menschen am Gerät: tippt bei jedem Schritt, der auf ihn wartet, „Erledigt“ (Wartezeiten laufen von selbst ab). */
async function fahre(l: Versuchsleiter, id: string, o: { notizen?: string[]; abbrechenBei?: RegExp } = {}): Promise<LaufLage> {
  const lage = l.starte(id);
  const notizen = [...(o.notizen ?? [])];
  while (lage.status === 'laeuft') {
    const s = lage.schritt;
    if (s && o.abbrechenBei?.test(s.text)) l.abbrechen(lage.id);
    else if (s && (s.art === 'erledigt' || s.art === 'eingabe')) {
      try {
        l.weiter(lage.id, s.nr, notizen.shift() ?? 'ok');
      } catch {
        // Schritt schon vorbei
      }
    }
    await kurz();
  }
  await l.aktiv!.ende;
  return lage;
}

test('Bestandsaufnahme: liest jeden Wert der Definition genau einmal, protokolliert Anzeige und Vergleich', async () => {
  const { l, cwl, speicher } = leiter();
  const lage = await fahre(l, 'bestand', { notizen: ['Stufe 1, 50 m³/h, FILTER', 'alles gleich'] });
  assert.equal(lage.status, 'fertig', lage.fehler ?? '');
  assert.deepEqual(cwl.zeilen, LESBAR.map((n) => `read -f -c excellent ${n}`));
  const e = speicher.ereignisse(lage.id);
  assert.deepEqual(e.filter((x) => x.art === 'eingabe').map((x) => x.text), ['Stufe 1, 50 m³/h, FILTER', 'alles gleich']);
  const fan = e.find((x) => x.art === 'lesen' && x.text === 'FanMode')!;
  assert.deepEqual([fan.befehl, fan.antwort, fan.ok], ['read -f -c excellent FanMode', 'Normal', true]);
  assert.equal(lage.werte.length, LESBAR.length);
  assert.deepEqual(speicher.lauf(lage.id)!.status, 'fertig');
});

test('Stufe am Gerät: fünf Handgriffe, dazwischen Lesungen, geschrieben wird nichts', async () => {
  const { l, cwl, speicher } = leiter();
  const lage = await fahre(l, 'stufe-geraet');
  assert.equal(lage.status, 'fertig', lage.fehler ?? '');
  assert.equal(cwl.zeilen.filter((z) => !z.startsWith('read ')).length, 0);
  const e = speicher.ereignisse(lage.id);
  assert.equal(e.filter((x) => x.art === 'erledigt').length, 5);
  assert.ok(e.filter((x) => x.art === 'lesen' && x.text === 'InletFanSpeed').length >= 6, 'beobachtet die Drehzahl bei jeder Stufe');
});

test('Stufe per eBus: schreibt High, wartet, bis die CWL von selbst zurück ist, und schreibt danach nichts mehr', async () => {
  const { l, cwl, speicher } = leiter();
  const lage = await fahre(l, 'stufe-ebus');
  assert.equal(lage.status, 'fertig', lage.fehler ?? '');
  assert.deepEqual(cwl.zeilen.filter((z) => z.startsWith('write ')), ['write -c excellent SetFanMode High']);
  const e = speicher.ereignisse(lage.id);
  assert.ok(e.some((x) => x.art === 'weiter' && x.text === 'Bedingung erfüllt'), 'zurückgefallen erkannt');
  assert.ok(e.some((x) => x.art === 'notiz' && x.text === 'Ausgang: FanMode Normal'));
});

test('Stufe per eBus abgebrochen, während die CWL noch auf High steht: der Ausgangswert kommt zurück', async () => {
  const { l, cwl, speicher } = leiter();
  cwl.haelt = Infinity;
  const lage = await fahre(l, 'stufe-ebus', { abbrechenBei: /zurückfällt/ });
  assert.equal(lage.status, 'abgebrochen');
  assert.deepEqual(cwl.zeilen.filter((z) => z.startsWith('write ')), ['write -c excellent SetFanMode High', 'write -c excellent SetFanMode Normal']);
  assert.equal(speicher.lauf(lage.id)!.status, 'abgebrochen');
  const arten = speicher.ereignisse(lage.id).map((e) => e.art);
  assert.ok(arten.includes('abbruch'), 'der Abbruch steht im Protokoll');
  assert.ok(arten.lastIndexOf('abbruch') < arten.lastIndexOf('schreiben'), 'erst der Abbruch, dann das Zurückstellen');
});

test('Filter quittieren: nur lesen, nie schreiben; die Warnung steht vor dem Start', async () => {
  const { l, cwl } = leiter();
  assert.match(l.liste().find((v) => v.id === 'filter')!.einmalig!, /nur einmal/);
  const lage = await fahre(l, 'filter');
  assert.equal(lage.status, 'fertig', lage.fehler ?? '');
  assert.ok(cwl.zeilen.length > 0);
  assert.deepEqual(cwl.zeilen.filter((z) => !z.startsWith('read ')), []);
});

test('Unbekanntes abtasten: 512 hex-Anfragen an die CWL, nur 40 22 und 40 50 mit einer Kennung', async () => {
  const { l, cwl, speicher } = leiter();
  const lage = await fahre(l, 'abtasten');
  assert.equal(lage.status, 'fertig', lage.fehler ?? '');
  assert.equal(cwl.zeilen.length, 512);
  assert.ok(cwl.zeilen.every((z) => /^hex 3c40(22|50)01[0-9a-f]{2}$/.test(z)));
  assert.equal(new Set(cwl.zeilen).size, 512);
  assert.ok(speicher.ereignisse(lage.id).some((x) => x.text === '2 von 512 Kennungen mit Antwort'));
});

test('Versuchsbetrieb aus, unbekannter Versuch, schon einer am Laufen', async () => {
  assert.throws(() => leiter({ erlaubt: false }).l.starte('bestand'), (e: VersuchFehler) => e.code === 403);
  assert.throws(() => leiter({ befehle: null }).l.starte('bestand'), (e: VersuchFehler) => e.code === 403, 'ohne ebusd');
  const { l } = leiter();
  assert.throws(() => l.starte('gibtsnicht'), (e: VersuchFehler) => e.code === 404);
  const lage = l.starte('bestand');
  assert.throws(() => l.starte('filter'), (e: VersuchFehler) => e.code === 409);
  l.abbrechen(lage.id);
  await l.aktiv!.ende;
  assert.equal(lage.status, 'abgebrochen');
  assert.equal(l.starte('filter').status, 'laeuft', 'danach geht der nächste');
  l.abbrechen(l.aktiv!.lage.id);
  await l.aktiv!.ende;
});

test('ein zweites Tippen auf einen alten Schritt überspringt nichts', async () => {
  const { l } = leiter();
  const lage = l.starte('bestand');
  try {
    await kurz();
    const nr = lage.schritt!.nr;
    l.weiter(lage.id, nr, 'erste Notiz');
    assert.throws(() => l.weiter(lage.id, nr, 'doppelt'), (e: VersuchFehler) => e.code === 409);
  } finally {
    l.abbrechen(lage.id);
    await l.aktiv!.ende;
  }
});

test('Schreiben oder hex außerhalb der Freigabe: Lauf endet mit Fehler, auf den Bus geht nichts', async () => {
  for (const [name, f] of [
    ['quittieren', (k) => k.schreibe('ResetNotifications', 'Filter')],
    ['Stufe dauerhaft', (k) => k.schreibe('SetFanModeAlt', 'High')],
    ['Wert außerhalb', (k) => k.schreibe('SetFanMode', 'Auto')],
    ['Parameter schreiben', (k) => k.hex('3c408001')],
    ['anderes Gerät', (k) => k.hex('5a40220101')],
    ['hex mit Leerzeichen', (k) => k.hex('3c40220101; read')],
  ] as [string, (k: Kontext) => Promise<unknown>][]) {
    const { l, cwl } = leiter({ versuche: [{ id: 'x', titel: 'X', beschreibung: '', dauer: '', ablauf: async (k) => void (await f(k)) }] });
    const lage = l.starte('x');
    await l.aktiv!.ende;
    assert.equal(lage.status, 'fehler', name);
    assert.match(lage.fehler!, /nicht freigegeben/, name);
    assert.deepEqual(cwl.zeilen, [], name);
  }
});

test('ebusd nicht erreichbar: Lauf endet mit Fehler, das Ereignis nennt den Grund', async () => {
  const kaputt: Befehle = { befehl: async () => Promise.reject(new Error('ebusd ebusd:8888 nicht erreichbar: ECONNREFUSED')) };
  const { l, speicher } = leiter({ befehle: kaputt });
  const lage = await fahre(l, 'filter');
  assert.equal(lage.status, 'fehler');
  assert.match(lage.fehler!, /nicht erreichbar/);
  assert.ok(speicher.ereignisse(lage.id).some((e) => e.art === 'fehler' && /ECONNREFUSED/.test(e.antwort ?? '')));
});

test('beenden: bricht den laufenden Versuch ab und wartet, bis er aufgeräumt hat', async () => {
  const { l, cwl } = leiter();
  cwl.haelt = Infinity;
  const lage = l.starte('stufe-ebus');
  while (!/zurückfällt/.test(lage.schritt?.text ?? '')) {
    if (lage.schritt && lage.schritt.art !== 'warten' && lage.schritt.art !== 'arbeitet') {
      try {
        l.weiter(lage.id, lage.schritt.nr, '');
      } catch {
        // schon vorbei
      }
    }
    await kurz();
  }
  await l.beenden(2000);
  assert.equal(lage.status, 'abgebrochen');
  assert.equal(cwl.zeilen.at(-1), 'write -c excellent SetFanMode Normal');
});
