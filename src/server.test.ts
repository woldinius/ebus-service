import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { Speicher } from './speicher.ts';
import { starteServer, type Lage } from './server.ts';
import { vonHex, zerlege } from './telegramm.ts';

const T0 = Date.UTC(2026, 10, 19, 6, 0, 0);

async function mitServer(f: (basis: string, s: Speicher) => Promise<void>) {
  const s = new Speicher(':memory:');
  const lage: Lage = { quelle: 'ebusd', verbunden: true, letzteDaten: T0, fehler: null };
  const server = starteServer({
    speicher: s, lage: () => lage, port: 0, host: '127.0.0.1', aufbewahrungTage: 7, titel: 'Lüftung', teilnehmer: { '37': 'CWL' },
  });
  await new Promise<void>((r) => server.once('listening', () => r()));
  const { port } = server.address() as AddressInfo;
  try {
    await f(`http://127.0.0.1:${port}`, s);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    s.schliessen();
  }
}

test('liefert Telegramme als JSON, mit Filter', async () => {
  await mitServer(async (basis, s) => {
    s.speichere(T0, zerlege(vonHex('37 5a 40 a0 04 00 32 00 32 4f'))!);
    s.speichere(T0 + 1, zerlege(vonHex('37 fe fe 01 0a 45 30 30 30 20 20 20 20 20 20 3d'))!, 'Fehlermeldung');
    const alle = await (await fetch(`${basis}/api/telegramme`)).json();
    assert.equal(alle.length, 2);
    const r = await fetch(`${basis}/api/telegramme?pbsb=fe01&grenze=10`);
    assert.equal(r.headers.get('content-type'), 'application/json; charset=utf-8');
    const l = await r.json();
    assert.equal(l.length, 1);
    assert.equal(l[0].name, 'Fehlermeldung');
    assert.equal((await (await fetch(`${basis}/api/telegramme?zz=5a`)).json()).length, 1);
  });
});

test('Übersicht, Verlauf und Status', async () => {
  await mitServer(async (basis, s) => {
    s.speichere(T0, zerlege(vonHex('37 5a 40 a0 04 00 32 00 32 4f'))!);
    const u = await (await fetch(`${basis}/api/uebersicht`)).json();
    assert.equal(u[0].anzahl, 1);
    const v = await (await fetch(`${basis}/api/verlauf?von=${T0 - 1}`)).json();
    assert.deepEqual(v, [{ stunde: T0, anzahl: 1 }]);
    const st = await (await fetch(`${basis}/api/status`)).json();
    assert.equal(st.anzahl, 1);
    assert.equal(st.aufbewahrungTage, 7);
    assert.equal(st.verbunden, true);
    assert.equal(st.quelle, 'ebusd');
    assert.equal(st.titel, 'Lüftung');
    assert.deepEqual(st.teilnehmer, { '37': 'CWL' });
  });
});

test('falsche Parameter: 400 statt Fehler in der Datenbank', async () => {
  await mitServer(async (basis) => {
    for (const q of ['pbsb=xyz', 'zz=300', 'qq=-1', 'von=gestern', 'status=kaputt', 'grenze=0']) {
      const r = await fetch(`${basis}/api/telegramme?${q}`);
      assert.equal(r.status, 400, q);
      await r.text();
    }
  });
});

test('Oberfläche und Gesundheit; nur GET; Sicherheitsköpfe', async () => {
  await mitServer(async (basis) => {
    const r = await fetch(`${basis}/`);
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type') ?? '', /^text\/html/);
    assert.match(await r.text(), /<title>eBus/);
    assert.match(r.headers.get('content-security-policy') ?? '', /default-src 'self'/);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    const js = await fetch(`${basis}/app.js`);
    assert.match(js.headers.get('content-type') ?? '', /javascript/);
    await js.text();
    const g = await fetch(`${basis}/gesund`);
    assert.equal(await g.text(), 'ok');
    const p = await fetch(`${basis}/api/telegramme`, { method: 'POST' });
    assert.equal(p.status, 405);
    await p.text();
    for (const pfad of ['/../package.json', '/%2e%2e/package.json', '/gibtsnicht']) {
      const x = await fetch(`${basis}${pfad}`);
      assert.equal(x.status, 404, pfad);
      await x.text();
    }
  });
});
