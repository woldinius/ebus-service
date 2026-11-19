import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Definitionen } from './definitionen.ts';
import { vonHex, zerlege, type Telegramm } from './telegramm.ts';

const CSV = `type,circuit,level,name,comment,qq,zz,pbsb,id,*name,part,type,divisor/values,unit,comment
# Kommentar
*r,
r,,,RequestErrorList,Fehlerhistorie,,,4090,,value,,HEX:18,,,
r,,,FanMode,Ventilatorbetrieb,,,4022,01,value,,UIR,0=Holiday;1=Reduced;2=Normal;3=High;4=Auto,,
r,,,SettingInletFlow,Zuluftmenge,,,4022,09,value,,UIR,,m³/h,
w,,,SetFanMode,Lüftungsmodus setzen,,,4021,01,value,,UIR,0=Holiday,,
`;

function tel(s: string): Telegramm {
  const t = zerlege(vonHex(s));
  assert.ok(t);
  return t;
}

test('liest Name und Kommentar aus der CSV von ebusd', () => {
  const d = Definitionen.ausCsv(CSV);
  assert.equal(d.anzahl, 4);
  const t = tel('31 3c 40 22 01 01 00');
  assert.deepEqual(d.finde(t), { name: 'FanMode', kommentar: 'Ventilatorbetrieb' });
  assert.equal(d.finde(tel('31 3c 40 22 01 09 00'))?.name, 'SettingInletFlow');
});

test('ohne Kennung passt jede Nachricht mit dieser PB/SB, die längste Kennung gewinnt', () => {
  const d = Definitionen.ausCsv(CSV);
  assert.equal(d.finde(tel('31 3c 40 90 01 07 00'))?.name, 'RequestErrorList');
  assert.equal(d.finde(tel('31 3c 40 22 01 77 00')), null, 'Kennung 77 gibt es nicht');
});

test('eBus-Standarddienste ohne Definition', () => {
  const d = Definitionen.ausCsv('');
  assert.equal(d.finde(tel('37 fe fe 01 0a 45 30 30 30 20 20 20 20 20 20 3d'))?.name, 'Fehlermeldung');
  assert.equal(d.finde(tel('37 5a 40 a0 04 00 32 00 32 4f')), null);
});
