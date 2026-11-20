import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Befehle } from './ebusd.ts';
import { Speicher } from './speicher.ts';
import { starteServer, type Lage, type Optionen } from './server.ts';
import { vonHex, zerlege } from './telegramm.ts';
import { Versuchsleiter, type Versuch } from './versuche.ts';

const T0 = Date.UTC(2026, 10, 19, 6, 0, 0);

async function mitServer(f: (basis: string, s: Speicher) => Promise<void>, extra: (s: Speicher) => Partial<Optionen> = () => ({})) {
  const s = new Speicher(':memory:');
  const lage: Lage = { quelle: 'ebusd', verbunden: true, letzteDaten: T0, fehler: null };
  const server = starteServer({
    speicher: s, lage: () => lage, port: 0, host: '127.0.0.1', aufbewahrungTage: 7, titel: 'Lüftung', teilnehmer: { '37': 'CWL' },
    ...extra(s),
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

// --- Versuche ---------------------------------------------------------------------------------------------
const ZEILEN: string[] = [];
const BEFEHLE: Befehle = {
  befehl: async (z) => {
    ZEILEN.push(z);
    return { text: z === 'state' ? 'signal acquired, 21 symbols/sec (24 max), 2 masters' : 'Normal', ok: true, ms: 1 };
  },
};
const PROBE: Versuch = {
  id: 'probe', titel: 'Probe', beschreibung: 'liest einmal', dauer: 'kurz',
  async ablauf(k) {
    await k.lies(['FanMode']);
    await k.erledigt('Am Gerät etwas tun');
  },
};
const mitVersuchen = (erlaubt: boolean) => (s: Speicher) => ({
  versuche: new Versuchsleiter({ befehle: BEFEHLE, speicher: s, versuche: [PROBE], lesbar: ['FanMode'], erlaubt }),
  ebusd: BEFEHLE,
});
const json = (basis: string, pfad: string, daten: unknown, kopf: Record<string, string> = {}) =>
  fetch(`${basis}${pfad}`, { method: 'POST', headers: { 'content-type': 'application/json', ...kopf }, body: JSON.stringify(daten) });

test('Versuche über HTTP: starten, Schritt bestätigen, Protokoll mit Ereignissen und Telegrammen herunterladen', async () => {
  await mitServer(async (basis, s) => {
    const v = await (await fetch(`${basis}/api/versuche`)).json();
    assert.equal(v.erlaubt, true);
    assert.deepEqual(v.versuche.map((x: { id: string }) => x.id), ['probe']);
    assert.equal(v.lauf, null);
    const r = await json(basis, '/api/versuche/start', { versuch: 'probe' }, { origin: basis });
    assert.equal(r.status, 200, await r.clone().text());
    const lauf = (await r.json()).lauf;
    assert.equal(lauf.status, 'laeuft');
    let lage = lauf;
    while (lage.schritt?.art !== 'erledigt') lage = (await (await fetch(`${basis}/api/versuche`)).json()).lauf;
    assert.equal((await json(basis, '/api/versuche/weiter', { lauf: lage.id, schritt: lage.schritt.nr, notiz: 'getan' })).status, 200);
    const doppelt = await json(basis, '/api/versuche/weiter', { lauf: lage.id, schritt: lage.schritt.nr, notiz: 'doppelt' });
    assert.equal(doppelt.status, 409);
    await doppelt.text();
    while (lage.status === 'laeuft') lage = (await (await fetch(`${basis}/api/versuche`)).json()).lauf;
    assert.equal(lage.status, 'fertig');
    s.speichere(lage.start + 10, zerlege(vonHex('37 5a 40 a0 04 00 32 00 32 4f'))!);
    const laeufe = await (await fetch(`${basis}/api/laeufe`)).json();
    assert.deepEqual(laeufe.map((l: { id: number }) => l.id), [lage.id]);
    const p = await fetch(`${basis}/api/laeufe/${lage.id}?download`);
    assert.match(p.headers.get('content-disposition') ?? '', new RegExp(`attachment; filename="ebus-lauf-${lage.id}-probe.json"`));
    const protokoll = await p.json();
    assert.equal(protokoll.lauf.titel, 'Probe');
    assert.deepEqual(protokoll.ereignisse.map((e: { art: string }) => e.art), ['lesen', 'schritt', 'erledigt']);
    assert.equal(protokoll.ereignisse.at(-1).text, 'getan');
    assert.equal(protokoll.telegramme.length, 1);
    assert.deepEqual(protokoll.teilnehmer, { '37': 'CWL' });
    assert.equal((await fetch(`${basis}/api/laeufe/999`)).status, 404);
    const st = await (await fetch(`${basis}/api/versuche`)).json();
    assert.equal(st.ebusd.text, 'signal acquired, 21 symbols/sec (24 max), 2 masters', 'Zustand von ebusd aus state');
  }, mitVersuchen(true));
});

test('Versuche: aus, fremde Herkunft, kein JSON, Unsinn, falscher Weg', async () => {
  await mitServer(async (basis) => {
    const v = await (await fetch(`${basis}/api/versuche`)).json();
    assert.equal(v.erlaubt, false);
    const r = await json(basis, '/api/versuche/start', { versuch: 'probe' });
    assert.equal(r.status, 403);
    assert.match(await r.text(), /Versuchsbetrieb ist aus/);
  }, mitVersuchen(false));
  ZEILEN.length = 0;
  await mitServer(async (basis) => {
    for (const [name, antwort] of [
      ['fremde Seite', json(basis, '/api/versuche/start', { versuch: 'probe' }, { origin: 'http://boese.example' })],
      ['fremde Seite laut Browser', json(basis, '/api/versuche/start', { versuch: 'probe' }, { 'sec-fetch-site': 'cross-site' })],
    ] as [string, Promise<Response>][]) {
      const a = await antwort;
      assert.equal(a.status, 403, name);
      await a.text();
    }
    for (const [name, antwort, code] of [
      ['Formular', fetch(`${basis}/api/versuche/start`, { method: 'POST', body: 'versuch=probe', headers: { 'content-type': 'application/x-www-form-urlencoded' } }), 400],
      ['kaputtes JSON', fetch(`${basis}/api/versuche/start`, { method: 'POST', body: '{', headers: { 'content-type': 'application/json' } }), 400],
      ['zu groß', json(basis, '/api/versuche/start', { versuch: 'x'.repeat(5000) }), 400],
      ['ohne Lauf', json(basis, '/api/versuche/weiter', { schritt: 1 }), 400],
      ['unbekannt', json(basis, '/api/versuche/start', { versuch: 'gibtsnicht' }), 404],
      ['kein Lauf', json(basis, '/api/versuche/abbrechen', { lauf: 5 }), 409],
      ['falscher Weg', json(basis, '/api/versuche/loeschen', {}), 404],
      ['POST anderswo', json(basis, '/api/laeufe', {}), 405],
      ['GET auf start', fetch(`${basis}/api/versuche/start`), 404],
    ] as [string, Promise<Response>, number][]) {
      const a = await antwort;
      assert.equal(a.status, code, name);
      await a.text();
    }
    assert.deepEqual(ZEILEN.filter((z) => z !== 'state'), [], 'nichts davon erreicht ebusd');
  }, mitVersuchen(true));
});

test('ohne Versuchsleiter (alter Betrieb): Liste leer, POST verboten', async () => {
  await mitServer(async (basis) => {
    assert.deepEqual(await (await fetch(`${basis}/api/versuche`)).json(), { erlaubt: false, versuche: [], lauf: null, ebusd: null });
    const r = await json(basis, '/api/versuche/start', { versuch: 'probe' });
    assert.equal(r.status, 403);
    await r.text();
  });
});
