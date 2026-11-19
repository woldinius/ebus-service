import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Speicher } from './speicher.ts';
import { vonHex, zerlege, type Telegramm } from './telegramm.ts';

const TAG = 86_400_000;
const T0 = Date.UTC(2026, 10, 19, 6, 0, 0);

function tel(s: string): Telegramm {
  const t = zerlege(vonHex(s));
  assert.ok(t);
  return t;
}
const FEHLER = tel('37 fe fe 01 0a 45 30 30 30 20 20 20 20 20 20 3d');
const AN_5A = tel('37 5a 40 a0 04 00 32 00 32 4f');
const AN_5B = tel('37 5b 40 a0 04 00 32 00 32 99');

test('speichert und liefert die neuesten zuerst, mit Grenze', () => {
  const s = new Speicher(':memory:');
  s.speichere(T0, AN_5A);
  s.speichere(T0 + 1000, FEHLER, 'Fehlermeldung');
  s.speichere(T0 + 2000, AN_5B);
  const l = s.liste({ grenze: 2 });
  assert.deepEqual(l.map((z) => z.zeit), [T0 + 2000, T0 + 1000]);
  assert.equal(l[1]!.name, 'Fehlermeldung');
  assert.equal(l[1]!.text, 'E000');
  assert.equal(l[0]!.zz, 0x5b);
  assert.equal(l[0]!.status, 'keine-antwort');
});

test('filtert nach Zeit, PB/SB, Sender, Empfänger und Status; blättert mit vor', () => {
  const s = new Speicher(':memory:');
  for (let i = 0; i < 10; i++) s.speichere(T0 + i * 1000, i % 2 ? FEHLER : AN_5A);
  assert.equal(s.liste({ pbsb: 'fe01' }).length, 5);
  assert.equal(s.liste({ zz: 0x5a }).length, 5);
  assert.equal(s.liste({ qq: 0x37 }).length, 10);
  assert.equal(s.liste({ status: 'keine-antwort' }).length, 5);
  assert.equal(s.liste({ von: T0 + 5000 }).length, 5);
  assert.equal(s.liste({ bis: T0 + 4999 }).length, 5);
  const seite1 = s.liste({ grenze: 4 });
  const seite2 = s.liste({ grenze: 4, vor: seite1.at(-1)!.id });
  assert.deepEqual(seite2.map((z) => z.zeit), [T0 + 5000, T0 + 4000, T0 + 3000, T0 + 2000]);
});

test('Übersicht je Nachricht: Anzahl, erstes und letztes Mal, letzte Daten', () => {
  const s = new Speicher(':memory:');
  s.speichere(T0, AN_5A);
  s.speichere(T0 + 5000, AN_5A);
  s.speichere(T0 + 6000, FEHLER, 'Fehlermeldung');
  const u = s.uebersicht({});
  assert.equal(u.length, 2);
  const a = u.find((z) => z.zz === 0x5a)!;
  assert.equal(a.anzahl, 2);
  assert.equal(a.erste, T0);
  assert.equal(a.letzte, T0 + 5000);
  assert.equal(a.daten, '00 32 00 32');
  assert.equal(a.pbsb, '40a0');
  assert.equal(u[0]!.letzte, T0 + 6000, 'zuletzt gesehene zuerst');
  assert.equal(u[0]!.name, 'Fehlermeldung');
  assert.equal(u[0]!.text, 'E000');
});

test('räumt nach 7 Tagen auf, Jüngeres bleibt', () => {
  const s = new Speicher(':memory:');
  s.speichere(T0 - 8 * TAG, AN_5A);
  s.speichere(T0 - 7 * TAG - 1, AN_5A);
  s.speichere(T0 - 7 * TAG + 1, AN_5A);
  s.speichere(T0, AN_5A);
  assert.equal(s.aufraeumen(T0, 7), 2);
  assert.equal(s.liste({}).length, 2);
  assert.equal(s.aufraeumen(T0, 7), 0, 'zweiter Lauf ändert nichts');
});

test('Telegramme je Stunde für den Verlauf', () => {
  const s = new Speicher(':memory:');
  s.speichere(T0 + 10, AN_5A);
  s.speichere(T0 + 20, AN_5A);
  s.speichere(T0 + 3_600_000 + 5, FEHLER);
  assert.deepEqual(s.jeStunde({ von: T0 - 1 }), [
    { stunde: T0, anzahl: 2 },
    { stunde: T0 + 3_600_000, anzahl: 1 },
  ]);
});

test('Kennzahlen: Anzahl, ältestes, neuestes', () => {
  const s = new Speicher(':memory:');
  assert.deepEqual(s.kennzahlen(), { anzahl: 0, aeltestes: null, neuestes: null });
  s.speichere(T0, AN_5A);
  s.speichere(T0 + 9, FEHLER);
  assert.deepEqual(s.kennzahlen(), { anzahl: 2, aeltestes: T0, neuestes: T0 + 9 });
});

test('bleibt über einen Neustart erhalten (Datei)', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const ordner = mkdtempSync(join(tmpdir(), 'ebus-'));
  try {
    const a = new Speicher(join(ordner, 'ebus.db'));
    a.speichere(T0, FEHLER);
    a.schliessen();
    const b = new Speicher(join(ordner, 'ebus.db'));
    assert.equal(b.liste({}).length, 1);
    b.schliessen();
  } finally {
    rmSync(ordner, { recursive: true, force: true });
  }
});

test('merkt sich Werte wie die Lesestelle, auch über einen Neustart', () => {
  const s = new Speicher(':memory:');
  assert.equal(s.lese('stelle'), null);
  s.merke('stelle', { inode: 7, offset: 42 });
  s.merke('stelle', { inode: 7, offset: 43 });
  assert.deepEqual(s.lese('stelle'), { inode: 7, offset: 43 });
});

test('alsEinheit: alles oder nichts', () => {
  const s = new Speicher(':memory:');
  assert.throws(() =>
    s.alsEinheit(() => {
      s.speichere(T0, AN_5A);
      throw new Error('mittendrin');
    }),
  );
  assert.equal(s.liste({}).length, 0);
  s.alsEinheit(() => s.speichere(T0, AN_5A));
  assert.equal(s.liste({}).length, 1);
});
