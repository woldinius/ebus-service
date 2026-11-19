// Folgt dem Rohprotokoll von ebusd (--lograwdata --lograwdatafile) wie `tail -F` und macht daraus Telegramme mit Zeit.
//
// Dateiwechsel: Ab --lograwdatasize kB benennt ebusd die Datei in <datei>.old um und beginnt eine neue (mit ebusd 26.1 am
// 2026-11-19 ausprobiert). Mitschnitt merkt sich Inode und Stelle; hat die Datei gewechselt, liest er erst den Rest der alten
// (<datei>.old mit derselben Inode), dann die neue von vorn. Zwischen zwei Lesevorgängen darf nur ein Wechsel liegen; bei 10 MB je
// Datei und einem Lesevorgang je Sekunde ist das weit weg.
//
// Zeilen: 'YYYY-MM-DD HH:MM:SS.mmm <HEX', Zeit in der Zeitzone des ebusd-Containers (UTC), HEX = Bytes zwischen zwei SYN, wie sie auf
// dem Bus standen, also mit ACK, Antwort des Slaves und A9-Escapes. Nach 64 Hex-Zeichen endet die Zeile mit '...', die nächste
// beginnt nach der Zeit mit '...<'.
import { closeSync, fstatSync, openSync, readSync, statSync } from 'node:fs';
import { vonHex } from './telegramm.ts';

export interface Position {
  inode: number;
  offset: number;
}

const MAX_LESEN = 4 * 1024 * 1024;

function stat(pfad: string): { ino: number; size: number } | null {
  try {
    return statSync(pfad);
  } catch {
    return null;
  }
}

function lesen(pfad: string, inode: number, ab: number): Uint8Array {
  let fd: number;
  try {
    fd = openSync(pfad, 'r');
  } catch {
    return new Uint8Array();
  }
  try {
    const st = fstatSync(fd);
    if (st.ino !== inode || st.size <= ab) return new Uint8Array();
    const puffer = Buffer.alloc(Math.min(st.size - ab, MAX_LESEN));
    const n = readSync(fd, puffer, 0, puffer.length, ab);
    return puffer.subarray(0, n);
  } finally {
    closeSync(fd);
  }
}

export class Mitschnitt {
  pfad: string;
  position: Position | null;
  fehler: string | null = null;

  /** 'ende': nur was ab jetzt dazukommt. Fehlt die Datei noch, gilt sie, sobald sie kommt, von Anfang an. */
  constructor(pfad: string, start: 'ende' | Position) {
    this.pfad = pfad;
    if (start === 'ende') {
      const st = stat(pfad);
      this.position = st ? { inode: st.ino, offset: st.size } : null;
    } else this.position = { ...start };
  }

  /** Was seit dem letzten Aufruf dazukam, über einen Dateiwechsel hinweg. */
  lies(): Uint8Array {
    const teile: Uint8Array[] = [];
    const st = stat(this.pfad);
    const p = this.position;
    if (p && (!st || st.ino !== p.inode)) {
      // Gewechselt (oder gerade umbenannt): erst der Rest der alten Datei
      const alt = lesen(`${this.pfad}.old`, p.inode, p.offset);
      teile.push(alt);
      p.offset += alt.length;
    }
    if (!st) {
      this.fehler = 'Mitschnitt fehlt';
      return verbinden(teile);
    }
    this.fehler = null;
    if (!p || st.ino !== p.inode) this.position = { inode: st.ino, offset: 0 };
    else if (st.size < p.offset) p.offset = 0; // gekürzt
    const pos = this.position!;
    const neu = lesen(this.pfad, pos.inode, pos.offset);
    pos.offset += neu.length;
    teile.push(neu);
    return verbinden(teile);
  }
}

function verbinden(teile: Uint8Array[]): Uint8Array {
  const gesamt = teile.reduce((n, t) => n + t.length, 0);
  const aus = new Uint8Array(gesamt);
  let i = 0;
  for (const t of teile) {
    aus.set(t, i);
    i += t.length;
  }
  return aus;
}

export interface Stueck {
  zeit: number;
  roh: Uint8Array;
}

const ZEILE = /^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d):(\d\d)\.(\d{3}) (\.\.\.)?<([0-9a-fA-F]*?)(\.\.\.)?$/;

export class Rohprotokoll {
  private dekoder = new TextDecoder();
  private puffer = '';
  private offen: { zeit: number; hex: string; bytes: number } | null = null;
  unlesbar = 0;

  /** Bytes, die noch zu keinem Telegramm wurden: die unvollständige Zeile und eine umgebrochene ohne Fortsetzung. Ab
   *  Stelle minus rest liest ein neuer Start weiter, ohne etwas doppelt oder halb zu lesen. */
  get rest(): number {
    return Buffer.byteLength(this.puffer) + (this.offen?.bytes ?? 0);
  }

  fuettere(bytes: Uint8Array): Stueck[] {
    this.puffer += this.dekoder.decode(bytes, { stream: true });
    const zeilen = this.puffer.split('\n');
    this.puffer = zeilen.pop() ?? '';
    const aus: Stueck[] = [];
    for (const z of zeilen) this.zeile(z.replace(/\r$/, ''), aus);
    return aus;
  }

  private zeile(z: string, aus: Stueck[]): void {
    if (!z) return;
    const m = ZEILE.exec(z);
    const zeit = m ? Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!, +m[7]!) : NaN;
    if (!m || Number.isNaN(zeit) || +m[2]! > 12 || +m[3]! > 31 || m[9]!.length % 2) {
      this.unlesbar++;
      return;
    }
    const fortsetzung = m[8] !== undefined;
    const weiter = m[10] !== undefined;
    const bytes = Buffer.byteLength(z) + 1;
    if (fortsetzung && this.offen) {
      this.offen.hex += m[9];
      this.offen.bytes += bytes;
    } else {
      if (this.offen) this.abschliessen(aus);
      if (fortsetzung) {
        this.unlesbar++; // Fortsetzung ohne Anfang
        return;
      }
      this.offen = { zeit, hex: m[9]!, bytes };
    }
    if (!weiter) this.abschliessen(aus);
  }

  private abschliessen(aus: Stueck[]): void {
    const o = this.offen!;
    this.offen = null;
    if (o.hex) aus.push({ zeit: o.zeit, roh: vonHex(o.hex) });
  }
}
