// eBus-Telegramme zerlegen. Grundlage: eBUS-Spezifikation OSI 1/2, V1.3.1 (eBUS Interest Group, 2007), in diesem Repo unter
// docs/Spec_Prot_12_V1_3_1.pdf:
//   - SYN AA trennt die Telegramme; in Daten wird A9 zu A9 00 und AA zu A9 01 (5.1)
//   - Master-Master: QQ ZZ PB SB NN DB… CRC, dann ACK des Empfängers (4.1)
//   - Master-Slave:  dasselbe, nach dem ACK antwortet der Slave mit NN DB… CRC, dann ACK des Masters (4.2)
//   - Rundruf an FE: ohne ACK (4.3); NN höchstens 16 (5.6), bei Antworten des Slaves nicht geprüft (Wolf CWL: 18); ACK 00, NAK FF (5.8)
//   - CRC-8 mit x⁸+x⁷+x⁴+x³+x+1 (0x9B) über die expandierte Folge (5.7, 7.2), gerechnet wie ebusd: crc = T[crc] ^ byte
//   - Master-Adresse: beide Halbbytes aus 0, 1, 3, 7, F; ihr Slave liegt 5 darüber, FF hat 04 (4.1.1)

export type Art = 'rundruf' | 'master-master' | 'master-slave';
export type Status = 'ok' | 'keine-antwort' | 'nak' | 'crc-fehler' | 'unvollstaendig';

export interface Telegramm {
  roh: string; // wie auf dem Bus, also expandiert, Bytes durch Leerzeichen getrennt
  qq: number;
  zz: number;
  pbsb: string; // vier Hex-Ziffern, z. B. 'fe01'
  daten: string; // Nutzdaten des Masters, entschlüsselt
  antwort: string | null; // Nutzdaten des Slaves, entschlüsselt
  text: string | null; // Daten als Text, wenn sie nur aus druckbaren ASCII-Zeichen bestehen (Rundruf FE 01: Fehlercode)
  art: Art;
  status: Status;
}

export const SYN = 0xaa;
const ESC = 0xa9;
const RUNDRUF = 0xfe;

const TABELLE = (() => {
  const t = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let b = 0; b < 8; b++) c = c & 0x80 ? ((c << 1) ^ 0x9b) & 0xff : (c << 1) & 0xff;
    t[i] = c;
  }
  return t;
})();

/** CRC über entschlüsselte Bytes; A9 und AA gehen expandiert ein, wie sie auf dem Bus stehen. */
export function crc8(bytes: ArrayLike<number>): number {
  let c = 0;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!;
    if (b === ESC) c = TABELLE[TABELLE[c]! ^ ESC]! ^ 0x00;
    else if (b === SYN) c = TABELLE[TABELLE[c]! ^ ESC]! ^ 0x01;
    else c = TABELLE[c]! ^ b;
  }
  return c;
}

const MASTER_HALBBYTES = new Set([0x0, 0x1, 0x3, 0x7, 0xf]);
export function istMaster(a: number): boolean {
  return MASTER_HALBBYTES.has(a >> 4) && MASTER_HALBBYTES.has(a & 0x0f);
}
export function slaveVon(master: number): number {
  return (master + 5) & 0xff;
}

export function hex(bytes: ArrayLike<number>): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ');
}
export function vonHex(s: string): Uint8Array {
  const rein = s.replace(/[^0-9a-fA-F]/g, '');
  if (rein.length % 2) throw new Error(`ungerade Anzahl Hex-Ziffern: ${s}`);
  return Uint8Array.from(rein.match(/../g) ?? [], (x) => parseInt(x, 16));
}

/** Zerlegt einen Bytestrom an SYN; leere Stücke (mehrere SYN hintereinander) fallen weg. */
export function segmente(strom: Uint8Array): Uint8Array[] {
  const aus: Uint8Array[] = [];
  let start = 0;
  for (let i = 0; i <= strom.length; i++) {
    if (i === strom.length || strom[i] === SYN) {
      if (i > start) aus.push(strom.subarray(start, i));
      start = i + 1;
    }
  }
  return aus;
}

/** Entschlüsselt A9 00 → A9 und A9 01 → AA. Ein A9 am Ende oder mit anderem Folgebyte bleibt stehen. */
export function entschluesseln(roh: Uint8Array): number[] {
  const aus: number[] = [];
  for (let i = 0; i < roh.length; i++) {
    const b = roh[i]!;
    if (b === ESC && i + 1 < roh.length && (roh[i + 1] === 0x00 || roh[i + 1] === 0x01)) {
      aus.push(roh[i + 1] === 0x00 ? ESC : SYN);
      i++;
    } else aus.push(b);
  }
  return aus;
}

function alsText(daten: number[]): string | null {
  if (!daten.length || !daten.every((b) => b >= 0x20 && b < 0x7f)) return null;
  const t = String.fromCharCode(...daten).trimEnd();
  return t || null;
}

/** Steht in roh genau ein vollständiger Master-Teil (QQ ZZ PB SB NN, NN Datenbytes, CRC), auf den eine Quittung folgen muss? */
export function wartetAufQuittung(roh: Uint8Array): boolean {
  const b = entschluesseln(roh);
  return b.length >= 6 && b[1] !== RUNDRUF && b[4]! <= 16 && b.length === 5 + b[4]! + 1;
}

/** Zerlegt, was zwischen zwei SYN stand. null, wenn nichts dazwischen stand. */
export function zerlege(roh: Uint8Array): Telegramm | null {
  if (!roh.length) return null;
  const b = entschluesseln(roh);
  const kopf = { roh: hex(roh), qq: b[0]!, zz: b[1] ?? 0, pbsb: '', daten: '', antwort: null, text: null };
  const art: Art = kopf.zz === RUNDRUF ? 'rundruf' : istMaster(kopf.zz) ? 'master-master' : 'master-slave';
  const t: Telegramm = { ...kopf, art, status: 'unvollstaendig' };
  if (b.length < 5) return t;
  t.pbsb = hex([b[2]!, b[3]!]).replace(' ', '');
  const nn = b[4]!;
  if (nn > 16 || b.length < 5 + nn + 1) return t;
  const daten = b.slice(5, 5 + nn);
  t.daten = hex(daten);
  t.text = alsText(daten);
  if (crc8(b.slice(0, 5 + nn)) !== b[5 + nn]) return { ...t, status: 'crc-fehler' };
  if (art === 'rundruf') return { ...t, status: 'ok' };

  let i = 5 + nn + 1;
  if (i >= b.length) return { ...t, status: 'keine-antwort' };
  if (b[i] === 0xff) return { ...t, status: 'nak' };
  if (b[i] !== 0x00) return t;
  if (art === 'master-master') return { ...t, status: 'ok' };

  i++;
  if (i >= b.length) return t;
  // Die Antwort darf länger sein als die 16 Bytes der Spezifikation: Die Wolf CWL schickt auf 40 90 achtzehn, ebusd nimmt sie an.
  // Ob sie stimmt, sagt die CRC.
  const nn2 = b[i]!;
  if (b.length < i + 1 + nn2 + 1) return t;
  const antwort = b.slice(i + 1, i + 1 + nn2);
  t.antwort = hex(antwort);
  if (crc8(b.slice(i, i + 1 + nn2)) !== b[i + 1 + nn2]) return { ...t, status: 'crc-fehler' };
  const ackMaster = b[i + 1 + nn2 + 1];
  return { ...t, status: ackMaster === 0xff ? 'nak' : 'ok' };
}
