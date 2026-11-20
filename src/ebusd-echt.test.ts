// Das echte ebusd (Docker-Image, wie im Betrieb) am nachgebauten Bus (werkzeug/busnachbau.ts): was read, write und hex
// zurückgeben und wie das Rohprotokoll aussieht, wenn ebusd selbst sendet. Ohne Docker oder ohne das Image: übersprungen.
// EBUSD_IMAGE wählt das Image (Vorgabe: v26.1, Digest wie in der Compose-Datei des Betriebs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { starteBusnachbau, type Antworter } from '../werkzeug/busnachbau.ts';
import { Ebusd } from './ebusd.ts';
import { Rohprotokoll } from './mitschnitt.ts';
import { crc8, hex, zerlege } from './telegramm.ts';

export const IMAGE = process.env.EBUSD_IMAGE ?? 'john30/ebusd@sha256:59bf92661bd49900ec64d6bb994556ee8f4f06c036f640163908439b684bc066';

export function dockerFehlt(): string | false {
  const d = spawnSync('docker', ['image', 'inspect', IMAGE], { stdio: 'ignore' });
  return d.error || d.status ? `Docker oder Image fehlt: docker pull ${IMAGE}` : false;
}

// Auszug aus der Definition der CWL (encon/3c..excellent.csv im Betrieb), Zeilen unverändert
export const CSV = `type,circuit,level,name,comment,qq,zz,pbsb,id,*name,part,type,divisor/values,unit,comment
*w,
*r,
r,,,TotalFilterDays,Filterverwendung (Tage),,,4050,22,days,,UIR,,days,Tage,min,,UIR,,days,Tage,max,,UIR,,days,Tage,step,,UIR,,days,Tage,default,,UIR,,days,Tage
r,,,FanMode,Ventilatorbetrieb,,,4022,01,value,,UIR,0=Holiday;1=Reduced;2=Normal;3=High;4=Auto,,
r,,,InletFlow,Tatsächliche Zuluftmenge,,,4022,0b,value,,UIR,,m³/h,
r,,,InsideTemperature,Ablufttemperatur,,,4022,07,value,,SIR,10,°C,
r,,,FilterStatus,Filter verdreckt,,,4022,18,value,,UIR,0=no;1=yes,,
w,,,SetFanMode,Ventilatorbetrieb,,,40a1,,value,,ULR,0=Holiday;65537=Reduced;131074=Normal;196611=High,,Temporary settings which resets after few minutes
`;

/** Startet ebusd im Container an einem nachgebauten Bus mit der CWL auf 3c. */
export async function mitEchtemEbusd(
  antworte: Antworter,
  f: (e: Ebusd, protokoll: () => string, anfragen: { pbsb: string; daten: string }[]) => Promise<void>,
) {
  const o = mkdtempSync(join(tmpdir(), 'ebusd-echt-'));
  mkdirSync(join(o, 'cfg/encon'), { recursive: true });
  mkdirSync(join(o, 'log'));
  writeFileSync(join(o, 'cfg/encon/3c..excellent.csv'), CSV);
  const bus = await starteBusnachbau({ slave: 0x3c, antworte, host: '0.0.0.0' });
  const name = `ebusd-echt-${process.pid}-${Date.now()}`;
  try {
    execFileSync('docker', ['run', '-d', '--rm', '--name', name, '-p', '127.0.0.1::8888', '--add-host=host.docker.internal:host-gateway',
      '-v', `${o}/cfg:/cfg:ro`, '-v', `${o}/log:/protokoll`, '--entrypoint', 'ebusd', IMAGE, '-f', '--scanconfig=off',
      '--configpath=/cfg', `--device=host.docker.internal:${bus.port}`, '--enablehex', '--lograwdata',
      '--lograwdatafile=/protokoll/raw.log', '--updatecheck=off', '--log=all:notice'], { stdio: 'ignore' });
    const port = Number(execFileSync('docker', ['port', name, '8888/tcp']).toString().trim().split(':').at(-1));
    const e = new Ebusd('127.0.0.1', port, 10_000);
    const bis = Date.now() + 30_000;
    for (;;) {
      const st = await e.befehl('state').catch((x: Error) => ({ text: x.message }));
      if (/signal acquired/.test(st.text)) break;
      if (Date.now() > bis) throw new Error(`ebusd ohne Signal: ${st.text}`);
      await new Promise((r) => setTimeout(r, 300));
    }
    await f(e, () => readFileSync(join(o, 'log/raw.log'), 'utf8'), bus.anfragen);
  } finally {
    spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' });
    await bus.schliessen();
    rmSync(o, { recursive: true, force: true });
  }
}

// Je Anfrage gibt es genau eine Kennung, bei der das CRC von ebusd (31 → 3c) 00 ist: einmal für 40 22, einmal für 40 50
const crcNull = (pb: number, sb: number) => [...Array(256).keys()].find((id) => crc8([0x31, 0x3c, pb, sb, 0x01, id]) === 0)!;
const CRC_NULL = crcNull(0x40, 0x22);
const CRC_NULL_LEER = crcNull(0x40, 0x50);

const CWL: Antworter = (a) => {
  if (a.pbsb === '4022') {
    const id = parseInt(a.daten, 16);
    if (id === 0x01) return [0x00, 0x02]; // FanMode Normal
    if (id === 0x0b) return [0x00, 0x32]; // 50 m³/h
    if (id === 0x07) return [0x00, 0xd2]; // 21,0 °C
    if (id === 0x18) return [0x00, 0x01]; // Filter verdreckt
    if (id === 0x99) return 'nak';
    if (id === CRC_NULL) return [0x00, 0x07];
    return [];
  }
  if (a.pbsb === '4050' && a.daten === '22') return [0x00, 0x5a, 0x00, 0x00, 0x01, 0x6d, 0x00, 0x01, 0x00, 0x5a];
  if (a.pbsb === '4050' && parseInt(a.daten, 16) === CRC_NULL_LEER) return [];
  if (a.pbsb === '40a1') return [];
  return null;
};

test('echtes ebusd: read, write und hex, wie sie die Versuche brauchen, und das Rohprotokoll dazu', { skip: dockerFehlt() }, async () => {
  await mitEchtemEbusd(CWL, async (e, protokoll, anfragen) => {
    const r = async (z: string) => (await e.befehl(z)).text;
    assert.equal(await r('read -f -c excellent FanMode'), 'Normal');
    assert.equal(await r('read -f -c excellent InletFlow'), '50');
    assert.equal(await r('read -f -c excellent InsideTemperature'), '21.0');
    assert.equal(await r('read -f -c excellent FilterStatus'), 'yes');
    assert.equal(await r('read -f -c excellent TotalFilterDays'), '90;0;365;1;90', 'mehrere Felder mit ;');
    assert.equal(await r('write -c excellent SetFanMode High'), 'done');
    assert.deepEqual(anfragen.find((a) => a.pbsb === '40a1'), { qq: 0x31, zz: 0x3c, pbsb: '40a1', daten: '00 03 00 03' },
      'High = 196611 = 00 03 00 03 (ULR, höchstes Byte zuerst)');
    assert.equal(await r('hex 3c40220101'), '020002', 'hex liefert die Antwort mit NN');
    assert.equal(await r('hex 3c40220199'), 'ERR: NAK received');
    assert.equal(await r(`hex 3c402201${hex([CRC_NULL])}`), '020007');
    assert.equal(await r(`hex 3c405001${hex([CRC_NULL_LEER])}`), '00');
    assert.match(await r('read -f -c excellent Gibtsnicht'), /^ERR: /);
    assert.match(await r('write -c excellent FanMode High'), /^ERR: /, 'FanMode lässt sich nur lesen');

    await new Promise((x) => setTimeout(x, 300)); // ebusd schreibt die Zeile beim nächsten SYN
    const roh = new Rohprotokoll();
    const t = roh.fuettere(new TextEncoder().encode(protokoll())).map((s) => zerlege(s.roh)!);
    assert.equal(roh.unlesbar, 0, protokoll());
    const von31 = t.filter((x) => x.qq === 0x31);
    const finde = (pbsb: string, daten: string) => von31.find((x) => x.pbsb === pbsb && x.daten === daten);
    assert.deepEqual([finde('4022', '01')?.status, finde('4022', '01')?.antwort], ['ok', '00 02'], protokoll());
    assert.equal(finde('4050', '22')?.antwort, '00 5a 00 00 01 6d 00 01 00 5a');
    assert.deepEqual([finde('40a1', '00 03 00 03')?.status, finde('40a1', '00 03 00 03')?.antwort], ['ok', '']);
    assert.equal(finde('4022', '99')?.status, 'nak');
    assert.deepEqual([finde('4022', hex([CRC_NULL]))?.status, finde('4022', hex([CRC_NULL]))?.antwort], ['ok', '00 07'], protokoll());
    assert.deepEqual([finde('4050', hex([CRC_NULL_LEER]))?.status, finde('4050', hex([CRC_NULL_LEER]))?.antwort], ['ok', ''], protokoll());
  });
});
