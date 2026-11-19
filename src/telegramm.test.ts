// Tests für den eBus-Parser. Grundlage: eBUS-Spezifikation OSI 1/2, V1.3.1 (Kapitel 4, 5, 7), CRC wie ebusd.
// Die beiden Telegramme an 5a/5b sind echt: am 2026-11-19 an einer Wolf CWL 300 Excellent roh mitgelesen, ihre CRC stimmt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc8, hex, istMaster, segmente, slaveVon, vonHex, zerlege } from './telegramm.ts';

test('CRC wie ebusd: stimmt für die beiden echten Telegramme der CWL', () => {
  assert.equal(crc8(vonHex('37 5a 40 a0 04 00 32 00 32')), 0x4f);
  assert.equal(crc8(vonHex('37 5b 40 a0 04 00 32 00 32')), 0x99);
});

test('CRC läuft über die expandierte Folge: A9 und AA zählen als zwei Bytes', () => {
  assert.equal(crc8(vonHex('10 fe b5 16 02 a9 aa')), 0x72);
});

test('Master-Adressen: beide Halbbytes aus 0, 1, 3, 7, F; der Slave liegt 5 darüber, FF hat 04', () => {
  for (const a of [0x00, 0x10, 0x31, 0x37, 0x7f, 0xff]) assert.equal(istMaster(a), true, hex([a]));
  for (const a of [0x3c, 0x5a, 0x08, 0xfe, 0x15]) assert.equal(istMaster(a), false, hex([a]));
  assert.equal(slaveVon(0x37), 0x3c);
  assert.equal(slaveVon(0x10), 0x15);
  assert.equal(slaveVon(0xff), 0x04);
});

test('Rundruf der CWL: Fehlermeldung FE 01 mit dem Text E000', () => {
  const t = zerlege(vonHex('37 fe fe 01 0a 45 30 30 30 20 20 20 20 20 20 3d'));
  assert.ok(t);
  assert.equal(t.art, 'rundruf');
  assert.equal(t.status, 'ok');
  assert.equal(t.qq, 0x37);
  assert.equal(t.zz, 0xfe);
  assert.equal(t.pbsb, 'fe01');
  assert.equal(t.daten, '45 30 30 30 20 20 20 20 20 20');
  assert.equal(t.text, 'E000');
  assert.equal(t.antwort, null);
});

test('Master an Slave ohne Quittung: echtes Telegramm an 5a, niemand antwortet', () => {
  const t = zerlege(vonHex('37 5a 40 a0 04 00 32 00 32 4f'));
  assert.ok(t);
  assert.equal(t.art, 'master-slave');
  assert.equal(t.status, 'keine-antwort');
  assert.equal(t.pbsb, '40a0');
  assert.equal(t.daten, '00 32 00 32');
});

test('Master an Slave mit Antwort, AA in der Antwort escaped', () => {
  const t = zerlege(vonHex('10 08 b5 11 01 01 89 00 02 a9 01 05 c6 00'));
  assert.ok(t);
  assert.equal(t.art, 'master-slave');
  assert.equal(t.status, 'ok');
  assert.equal(t.daten, '01');
  assert.equal(t.antwort, 'aa 05');
});

test('Master an Master: nur die Quittung, keine Antwortdaten', () => {
  const t = zerlege(vonHex('37 10 07 04 00 22 00'));
  assert.ok(t);
  assert.equal(t.art, 'master-master');
  assert.equal(t.status, 'ok');
  assert.equal(t.antwort, null);
});

test('Escape-Bytes in den Daten und in der CRC', () => {
  const e = zerlege(vonHex('10 fe b5 16 02 a9 00 a9 01 72'));
  assert.ok(e);
  assert.equal(e.status, 'ok');
  assert.equal(e.daten, 'a9 aa');
  const f = zerlege(vonHex('10 fe b5 16 01 d9 a9 01'));
  assert.ok(f);
  assert.equal(f.status, 'ok', 'CRC AA kommt als A9 01');
});

test('Falsche CRC, NAK, abgebrochen', () => {
  assert.equal(zerlege(vonHex('37 5a 40 a0 04 00 32 00 32 4e'))?.status, 'crc-fehler');
  assert.equal(zerlege(vonHex('37 10 07 04 00 22 ff'))?.status, 'nak');
  assert.equal(zerlege(vonHex('37 5a 40'))?.status, 'unvollstaendig');
  assert.equal(zerlege(vonHex('10 08 b5 11 01 01 89 00 02 a9 01'))?.status, 'unvollstaendig');
  assert.equal(zerlege(vonHex('10 08 b5 11 01 01 89 00 02 a9 01 05 c7 00'))?.status, 'crc-fehler');
  assert.equal(zerlege(new Uint8Array()), null, 'zwei SYN hintereinander sind kein Telegramm');
});

test('Roh bleibt erhalten, wie es auf dem Bus stand', () => {
  assert.equal(zerlege(vonHex('10 fe b5 16 02 a9 00 a9 01 72'))?.roh, '10 fe b5 16 02 a9 00 a9 01 72');
});

test('Ein Bytestrom zerfällt an den SYN-Zeichen', () => {
  const s = segmente(vonHex('aa aa 37 fe fe 01 00 aa aa aa 37 5a aa'));
  assert.deepEqual(s.map((x) => hex(x)), ['37 fe fe 01 00', '37 5a']);
});
