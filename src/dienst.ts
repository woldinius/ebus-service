// Der eigentliche Ablauf: Rohprotokoll von ebusd lesen, Telegramme zerlegen und benennen, speichern, die Lesestelle merken.
// main.ts ruft schritt() jede Sekunde und aufraeumen() jede Stunde; hier steht nichts von Uhren oder Signalen, damit es testbar ist.
import type { Definitionen } from './definitionen.ts';
import { Mitschnitt, Rohprotokoll, type Position } from './mitschnitt.ts';
import type { Lage } from './server.ts';
import type { Speicher } from './speicher.ts';
import { zerlege } from './telegramm.ts';

export interface DienstOptionen {
  speicher: Speicher;
  protokoll: string; // Pfad der Datei aus --lograwdatafile
  definitionen: Definitionen;
  aufbewahrungTage: number;
  jetzt?: () => number;
  stilleMs?: number; // so lange ohne Telegramm gilt der Bus noch als „empfängt“
}

const STELLE = 'stelle';

export class Dienst {
  o: Required<DienstOptionen>;
  mitschnitt: Mitschnitt;
  roh = new Rohprotokoll();
  letzteDaten: number | null;

  constructor(o: DienstOptionen) {
    this.o = { jetzt: Date.now, stilleMs: 120_000, ...o };
    const stelle = o.speicher.lese<Position>(STELLE);
    this.mitschnitt = new Mitschnitt(o.protokoll, stelle ?? 'ende');
    this.letzteDaten = o.speicher.kennzahlen().neuestes;
  }

  /** Liest, was dazukam, und speichert es in einem Zug. Gibt die Zahl gespeicherter Telegramme zurück. */
  schritt(): number {
    const stuecke = this.roh.fuettere(this.mitschnitt.lies());
    const { speicher, definitionen } = this.o;
    return speicher.alsEinheit(() => {
      let n = 0;
      for (const s of stuecke) {
        const t = zerlege(s.roh);
        if (!t) continue;
        speicher.speichere(s.zeit, t, definitionen.finde(t)?.name ?? null);
        this.letzteDaten = Math.max(this.letzteDaten ?? 0, s.zeit);
        n++;
      }
      const p = this.mitschnitt.position;
      if (p) speicher.merke(STELLE, { inode: p.inode, offset: Math.max(0, p.offset - this.roh.rest) });
      return n;
    });
  }

  aufraeumen(): number {
    return this.o.speicher.aufraeumen(this.o.jetzt(), this.o.aufbewahrungTage);
  }

  lage(): Lage {
    const d = this.letzteDaten;
    return {
      quelle: 'ebusd',
      verbunden: d !== null && this.o.jetzt() - d < this.o.stilleMs,
      letzteDaten: d,
      fehler: this.mitschnitt.fehler,
    };
  }
}
