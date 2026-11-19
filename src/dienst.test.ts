import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Definitionen } from './definitionen.ts';
import { Dienst } from './dienst.ts';
import { Speicher } from './speicher.ts';

const DEF = Definitionen.ausCsv('type,circuit,level,name,comment,qq,zz,pbsb,id\nr,,,FanMode,Ventilatorbetrieb,,,4022,01,value,,UIR,,,\n');
const Z = (zeit: string, hex: string) => `2026-11-19 ${zeit} <${hex}\n`;
const ZEIT = (hms: string) => Date.parse(`2026-11-19T${hms}Z`);

function aufbau(t: { after: (f: () => void) => void }) {
  const o = mkdtempSync(join(tmpdir(), 'dienst-'));
  t.after(() => rmSync(o, { recursive: true, force: true }));
  const log = join(o, 'raw.log');
  const db = join(o, 'ebus.db');
  writeFileSync(log, Z('07:00:00.000', '37fefe010a453030302020202020203d'));
  return { o, log, db };
}

test('liest neue Zeilen, speichert mit der Zeit von ebusd und dem Namen aus der Definition', (t) => {
  const { log, db } = aufbau(t);
  const s = new Speicher(db);
  const d = new Dienst({ speicher: s, protokoll: log, definitionen: DEF, aufbewahrungTage: 7, jetzt: () => ZEIT('07:01:00') });
  assert.equal(d.schritt(), 0, 'Was vor dem ersten Start im Protokoll stand, bleibt liegen');
  appendFileSync(log, Z('07:00:30.250', '375a40a004003200324f') + Z('07:00:31.000', '313c402201019c00'));
  assert.equal(d.schritt(), 2);
  const l = s.liste({});
  assert.equal(l[0]!.zeit, ZEIT('07:00:31.000'));
  assert.equal(l[0]!.name, 'FanMode');
  assert.equal(l[1]!.zeit, ZEIT('07:00:30.250'));
  assert.equal(l[1]!.status, 'keine-antwort');
  s.schliessen();
});

test('nach einem Neustart weiter ab der gemerkten Stelle: nichts doppelt, nichts verloren', (t) => {
  const { log, db } = aufbau(t);
  const jetzt = () => ZEIT('07:01:00');
  const a = new Speicher(db);
  const d1 = new Dienst({ speicher: a, protokoll: log, definitionen: DEF, aufbewahrungTage: 7, jetzt });
  appendFileSync(log, Z('07:00:30.000', '375a40a004003200324f') + '2026-11-19 07:00:31.000 <375b40');
  d1.schritt();
  a.schliessen();
  // Dienst aus, ebusd schreibt weiter und wechselt dabei die Datei
  appendFileSync(log, 'a004003200329' + '9\n' + Z('07:00:40.000', '37fefe010a453030302020202020203d'));
  renameSync(log, `${log}.old`);
  writeFileSync(log, Z('07:00:50.000', '375c40a0040032003216'));
  const b = new Speicher(db);
  const d2 = new Dienst({ speicher: b, protokoll: log, definitionen: DEF, aufbewahrungTage: 7, jetzt });
  d2.schritt();
  const zz = b.liste({}).map((e) => e.zz.toString(16)).reverse();
  assert.deepEqual(zz, ['5a', '5b', 'fe', '5c']);
  b.schliessen();
});

test('Lage: empfängt, solange Telegramme kommen; sonst still, mit der Zeit des letzten', (t) => {
  const { log, db } = aufbau(t);
  let jetzt = ZEIT('07:01:00');
  const s = new Speicher(db);
  const d = new Dienst({ speicher: s, protokoll: log, definitionen: DEF, aufbewahrungTage: 7, jetzt: () => jetzt });
  d.schritt();
  assert.equal(d.lage().verbunden, false, 'noch nichts gelesen');
  appendFileSync(log, Z('07:00:59.000', '375a40a004003200324f'));
  d.schritt();
  assert.deepEqual(d.lage(), { quelle: 'ebusd', verbunden: true, letzteDaten: ZEIT('07:00:59.000'), fehler: null });
  jetzt = ZEIT('07:05:00');
  d.schritt();
  assert.equal(d.lage().verbunden, false, 'vier Minuten nichts');
  rmSync(log);
  d.schritt();
  assert.equal(d.lage().fehler, 'Mitschnitt fehlt');
  s.schliessen();
});

test('räumt auf: älter als die Aufbewahrung geht', (t) => {
  const { log, db } = aufbau(t);
  const s = new Speicher(db);
  const d = new Dienst({ speicher: s, protokoll: log, definitionen: DEF, aufbewahrungTage: 7, jetzt: () => ZEIT('07:01:00') });
  appendFileSync(log, '2026-11-10 07:00:00.000 <375a40a004003200324f\n' + Z('07:00:30.000', '375a40a004003200324f'));
  d.schritt();
  assert.equal(s.liste({}).length, 2);
  assert.equal(d.aufraeumen(), 1);
  assert.equal(s.liste({}).length, 1);
  s.schliessen();
});
