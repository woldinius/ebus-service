// Draht zum Befehlsport von ebusd (wie ebusctl): eine Zeile hin, die Antwort endet mit einer Leerzeile (ebusd 26.1,
// src/ebusd/mainloop.cpp: "\n\n" nach jeder Antwort). Fehler beginnen mit "ERR: " (src/lib/ebus/result.cpp).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type AddressInfo, type Socket } from 'node:net';
import { Ebusd } from './ebusd.ts';

async function mitEbusd(antworte: (zeile: string, s: Socket) => void, f: (e: Ebusd, zeilen: string[]) => Promise<void>) {
  const zeilen: string[] = [];
  const server = createServer((s) => {
    let puffer = '';
    s.on('data', (d) => {
      puffer += d.toString();
      let i;
      while ((i = puffer.indexOf('\n')) >= 0) {
        const zeile = puffer.slice(0, i);
        puffer = puffer.slice(i + 1);
        zeilen.push(zeile);
        antworte(zeile, s);
      }
    });
    s.on('error', () => {});
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const { port } = server.address() as AddressInfo;
  try {
    await f(new Ebusd('127.0.0.1', port, 500), zeilen);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
}

test('schickt eine Zeile und liefert die Antwort bis zur Leerzeile', async () => {
  await mitEbusd(
    (z, s) => {
      // ebusd schreibt die Antwort manchmal in Stücken
      s.write(z === 'read -f -c excellent FanMode' ? 'Nor' : 'ERR: element not found');
      setTimeout(() => s.write(z === 'read -f -c excellent FanMode' ? 'mal\n\n' : '\n\n'), 10);
    },
    async (e, zeilen) => {
      const a = await e.befehl('read -f -c excellent FanMode');
      assert.equal(a.text, 'Normal');
      assert.equal(a.ok, true);
      assert.ok(a.ms >= 0);
      const b = await e.befehl('read -f -c excellent Gibtsnicht');
      assert.equal(b.text, 'ERR: element not found');
      assert.equal(b.ok, false);
      assert.deepEqual(zeilen, ['read -f -c excellent FanMode', 'read -f -c excellent Gibtsnicht']);
    },
  );
});

test('mehrzeilige Antworten (state, info) bleiben ganz', async () => {
  await mitEbusd(
    (_z, s) => s.write('version: ebusd 26.1.26.1\nsignal: acquired\n\n'),
    async (e) => {
      assert.equal((await e.befehl('info')).text, 'version: ebusd 26.1.26.1\nsignal: acquired');
    },
  );
});

test('Befehle laufen nacheinander, auch wenn sie gleichzeitig kommen', async () => {
  let offen = 0;
  let hoechstens = 0;
  await mitEbusd(
    (z, s) => {
      offen++;
      hoechstens = Math.max(hoechstens, offen);
      setTimeout(() => {
        offen--;
        s.write(`${z}!\n\n`);
      }, 20);
    },
    async (e) => {
      const r = await Promise.all(['a', 'b', 'c'].map((x) => e.befehl(`hex ${x}`)));
      assert.deepEqual(r.map((a) => a.text), ['hex a!', 'hex b!', 'hex c!']);
      assert.equal(hoechstens, 1);
    },
  );
});

test('antwortet ebusd nicht: Fehler nach dem Zeitlimit, der nächste Befehl geht wieder', async () => {
  let n = 0;
  await mitEbusd(
    (_z, s) => {
      if (n++ > 0) s.write('done\n\n');
    },
    async (e) => {
      await assert.rejects(e.befehl('state'), /antwortet nicht/);
      assert.equal((await e.befehl('state')).text, 'done');
    },
  );
});

test('ebusd nicht erreichbar: verständlicher Fehler', async () => {
  const e = new Ebusd('127.0.0.1', 1, 500);
  await assert.rejects(e.befehl('state'), /ebusd 127\.0\.0\.1:1 nicht erreichbar/);
});

test('nur einzeilige druckbare Befehle', async () => {
  const e = new Ebusd('127.0.0.1', 1, 500);
  for (const z of ['', 'read\nwrite', 'read ä']) await assert.rejects(e.befehl(z), /ungültiger Befehl/, JSON.stringify(z));
});
