// Nachgebauter eBus für Tests mit dem echten ebusd: ein TCP-Server, an den ebusd sich als Netzgerät hängt (-d HOST:PORT).
// Er spielt den Bus: jedes Byte kommt als Echo zurück, wie auf der Leitung; ist der Bus 45 ms still, sendet er SYN (AA), so oft
// wie die echte CWL (am 2026-11-19 gemessen: rund 21 SYN je Sekunde). Fragt ein Master den nachgebauten Slave, antwortet der mit
// ACK, Daten und CRC; was er antwortet, bestimmt der Test. Nicht nachgebaut: Kollisionen und Arbitrierung zweier Master.
// Gehört nicht ins Image (Dockerfile kopiert nur src/ und public/).
import { createServer, type AddressInfo, type Socket } from 'node:net';
import { crc8, entschluesseln, hex } from '../src/telegramm.ts';

export interface Anfrage {
  qq: number;
  zz: number;
  pbsb: string;
  daten: string;
}

/** Daten der Antwort (ohne NN und CRC), 'nak' für eine Ablehnung oder null für keine Antwort. */
export type Antworter = (a: Anfrage) => number[] | 'nak' | null;

export interface Busnachbau {
  port: number;
  anfragen: Anfrage[];
  schliessen(): Promise<void>;
}

const SYN = 0xaa;
const ESC = 0xa9;

function expandieren(bytes: number[]): number[] {
  return bytes.flatMap((b) => (b === ESC ? [ESC, 0x00] : b === SYN ? [ESC, 0x01] : [b]));
}

export function starteBusnachbau(o: { slave: number; antworte: Antworter; synMs?: number; host?: string }): Promise<Busnachbau> {
  const synMs = o.synMs ?? 45;
  const anfragen: Anfrage[] = [];
  const offen = new Set<Socket>();

  const server = createServer((s) => {
    offen.add(s);
    let strom: number[] = []; // was seit dem letzten SYN auf dem Bus stand, expandiert
    let beantwortet = false;
    let zuletzt = Date.now();
    const senden = (bytes: number[]) => {
      s.write(Buffer.from(bytes));
      strom.push(...bytes);
      zuletzt = Date.now();
    };
    const uhr = setInterval(() => {
      if (Date.now() - zuletzt < synMs) return;
      s.write(Buffer.from([SYN]));
      strom = [];
      beantwortet = false;
      zuletzt = Date.now();
    }, 5);
    const pruefe = () => {
      const b = entschluesseln(Uint8Array.from(strom));
      if (b.length < 6 || b[4]! > 16 || b.length !== 5 + b[4]! + 1) return;
      beantwortet = true;
      if (b[1] !== o.slave) return;
      if (crc8(b.slice(0, 5 + b[4]!)) !== b[5 + b[4]!]) return senden([0xff]);
      const a: Anfrage = { qq: b[0]!, zz: b[1]!, pbsb: hex([b[2]!, b[3]!]).replace(' ', ''), daten: hex(b.slice(5, 5 + b[4]!)) };
      anfragen.push(a);
      const antwort = o.antworte(a);
      if (antwort === null) return;
      if (antwort === 'nak') {
        senden([0xff]);
        strom = []; // der Master wiederholt sein Telegramm
        beantwortet = false;
        return;
      }
      const teil = [antwort.length, ...antwort];
      senden([0x00, ...expandieren([...teil, crc8(teil)])]);
    };
    s.on('data', (d: Buffer) => {
      s.write(d); // Echo: was ein Teilnehmer sendet, liest er auf dem Bus zurück
      zuletzt = Date.now();
      for (const b of d) {
        if (b === SYN) {
          strom = [];
          beantwortet = false;
          continue;
        }
        strom.push(b);
        if (!beantwortet) pruefe();
      }
    });
    s.on('error', () => {});
    s.on('close', () => {
      clearInterval(uhr);
      offen.delete(s);
    });
  });

  return new Promise((fertig) => {
    server.listen(0, o.host ?? '127.0.0.1', () => {
      fertig({
        port: (server.address() as AddressInfo).port,
        anfragen,
        schliessen: () =>
          new Promise<void>((r) => {
            for (const s of offen) s.destroy();
            server.close(() => r());
          }),
      });
    });
  });
}
