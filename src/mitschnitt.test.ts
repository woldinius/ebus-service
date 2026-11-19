// Das Rohprotokoll von ebusd (--lograwdata --lograwdatafile): ab --lograwdatasize kB benennt ebusd die Datei in <datei>.old um
// und beginnt neu, genau wie beim Binärmitschnitt --dump (beides am 2026-11-19 mit ebusd 26.1 ausprobiert). Mitschnitt folgt der
// Datei byteweise, Rohprotokoll macht daraus Zeit und Bytes je Telegramm.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, renameSync, rmSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Mitschnitt, Rohprotokoll } from './mitschnitt.ts';
import { hex, vonHex } from './telegramm.ts';

function ordner(t: { after: (f: () => void) => void }): string {
  const o = mkdtempSync(join(tmpdir(), 'mitschnitt-'));
  t.after(() => rmSync(o, { recursive: true, force: true }));
  return o;
}

test('liest nur, was dazukommt; ab Ende heißt: Altes bleibt liegen', (t) => {
  const datei = join(ordner(t), 'dump.bin');
  writeFileSync(datei, vonHex('aa 37 fe'));
  const m = new Mitschnitt(datei, 'ende');
  assert.equal(hex(m.lies()), '');
  appendFileSync(datei, vonHex('fe 01 aa'));
  assert.equal(hex(m.lies()), 'fe 01 aa');
  assert.equal(hex(m.lies()), '');
});

test('Dateiwechsel: erst der Rest der alten Datei, dann die neue', (t) => {
  const o = ordner(t);
  const datei = join(o, 'dump.bin');
  writeFileSync(datei, vonHex('aa'));
  const m = new Mitschnitt(datei, 'ende');
  appendFileSync(datei, vonHex('37 5a'));
  assert.equal(hex(m.lies()), '37 5a');
  appendFileSync(datei, vonHex('40 a0'));
  renameSync(datei, `${datei}.old`);
  writeFileSync(datei, vonHex('04 00'));
  assert.equal(hex(m.lies()), '40 a0 04 00');
  appendFileSync(datei, vonHex('32'));
  assert.equal(hex(m.lies()), '32');
});

test('gekürzte Datei (ebusd neu gestartet): von vorn', (t) => {
  const datei = join(ordner(t), 'dump.bin');
  writeFileSync(datei, vonHex('aa aa aa aa'));
  const m = new Mitschnitt(datei, 'ende');
  truncateSync(datei, 0);
  appendFileSync(datei, vonHex('aa 37'));
  assert.equal(hex(m.lies()), 'aa 37');
});

test('fehlende Datei ist kein Absturz; sie kann später kommen', (t) => {
  const datei = join(ordner(t), 'dump.bin');
  const m = new Mitschnitt(datei, 'ende');
  assert.equal(hex(m.lies()), '');
  assert.equal(m.fehler, 'Mitschnitt fehlt');
  writeFileSync(datei, vonHex('aa 37'));
  assert.equal(hex(m.lies()), 'aa 37', 'eine neue Datei liest er von vorn');
  assert.equal(m.fehler, null);
});

test('weiter ab gespeicherter Stelle, auch wenn die Datei inzwischen gewechselt hat', (t) => {
  const datei = join(ordner(t), 'dump.bin');
  writeFileSync(datei, vonHex('aa 37 fe'));
  const a = new Mitschnitt(datei, 'ende');
  a.lies();
  const stelle = a.position!;
  appendFileSync(datei, vonHex('fe 01'));
  assert.equal(hex(new Mitschnitt(datei, stelle).lies()), 'fe 01');
  renameSync(datei, `${datei}.old`);
  writeFileSync(datei, vonHex('aa'));
  assert.equal(hex(new Mitschnitt(datei, stelle).lies()), 'fe 01 aa');
});

// Zeilen wie am 2026-11-19 von ebusd 26.1 geschrieben (--lograwdata --lograwdatafile): Zeit in UTC, '<' und die Bytes zwischen
// zwei SYN; nach 64 Hex-Zeichen bricht ebusd mit '...' um und setzt in der nächsten Zeile mit '...<' fort.
const ZEILEN = [
  '2026-11-19 07:28:40.118 <37fefe010a453030302020202020203d',
  '2026-11-19 07:28:40.170 <375a40a004003200324f',
  '2026-11-19 07:29:08.655 <1008b511100102030405060708090a0b0c0d0e0f105500102021222324252627...',
  '2026-11-19 07:29:08.656 ...<28292a2b2c2d2e2f6600',
];
const text = (s: string) => new TextEncoder().encode(s);

test('Rohprotokoll: Zeit von ebusd in UTC, Bytes wie auf dem Bus', () => {
  const r = new Rohprotokoll();
  const s = r.fuettere(text(`${ZEILEN[0]}\n${ZEILEN[1]}\n`));
  assert.equal(s.length, 2);
  assert.equal(s[0]!.zeit, Date.UTC(2026, 10, 19, 7, 28, 40, 118));
  assert.equal(hex(s[0]!.roh), '37 fe fe 01 0a 45 30 30 30 20 20 20 20 20 20 3d');
  assert.equal(hex(s[1]!.roh), '37 5a 40 a0 04 00 32 00 32 4f');
});

test('Rohprotokoll: eine Zeile über zwei Lesevorgänge', () => {
  const r = new Rohprotokoll();
  assert.deepEqual(r.fuettere(text(ZEILEN[1]!.slice(0, 30))), []);
  assert.equal(r.rest, 30);
  const s = r.fuettere(text(`${ZEILEN[1]!.slice(30)}\n`));
  assert.equal(hex(s[0]!.roh), '37 5a 40 a0 04 00 32 00 32 4f');
  assert.equal(r.rest, 0);
});

test('Rohprotokoll: umgebrochene Zeile wird eins, mit der Zeit der ersten Zeile', () => {
  const r = new Rohprotokoll();
  assert.deepEqual(r.fuettere(text(`${ZEILEN[2]}\n`)), [], 'wartet auf die Fortsetzung');
  const s = r.fuettere(text(`${ZEILEN[3]}\n`));
  assert.equal(s.length, 1);
  assert.equal(s[0]!.zeit, Date.UTC(2026, 10, 19, 7, 29, 8, 655));
  assert.equal(s[0]!.roh.length, 42);
  assert.equal(hex(s[0]!.roh.subarray(-3)), '2f 66 00');
});

test('Rohprotokoll: Fremdes überspringt es und zählt es', () => {
  const r = new Rohprotokoll();
  const s = r.fuettere(text(`Unsinn\n2026-11-19 07:28:40.118 >3710\n${ZEILEN[1]}\n2026-13-99 xx <37\n`));
  assert.equal(s.length, 1);
  assert.equal(r.unlesbar, 3);
});

test('Rohprotokoll: bleibt eine Fortsetzung aus, gilt die erste Hälfte für sich', () => {
  const r = new Rohprotokoll();
  r.fuettere(text(`${ZEILEN[2]}\n`));
  const s = r.fuettere(text(`${ZEILEN[1]}\n`));
  assert.equal(s.length, 2);
  assert.equal(s[0]!.roh.length, 32);
});

test('Rohprotokoll: eine umgebrochene Zeile ohne Fortsetzung zählt zum Rest', () => {
  const r = new Rohprotokoll();
  r.fuettere(text(`${ZEILEN[2]}\n${ZEILEN[3]!.slice(0, 10)}`));
  assert.equal(r.rest, Buffer.byteLength(ZEILEN[2]!) + 1 + 10);
});
