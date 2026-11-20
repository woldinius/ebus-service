// HTTP: JSON-API über den Speicher und die Oberfläche aus public/. Lesen per GET und HEAD, ohne Anmeldung; wer den Dienst
// erreicht, regelt der Reverse Proxy davor. POST gibt es nur für die Versuche (starten, weiter, abbrechen), und nur, wenn der
// Versuchsbetrieb an ist (VERSUCHE=an). Damit keine fremde Seite im selben Browser einen Versuch auslöst, nimmt POST nur JSON von
// derselben Herkunft an: Ein fremdes fetch mit JSON braucht eine CORS-Vorabfrage, die dieser Dienst nie erlaubt.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Befehle } from './ebusd.ts';
import { RAND, type Filter, type Speicher } from './speicher.ts';
import type { Status } from './telegramm.ts';
import { VersuchFehler, type Versuchsleiter } from './versuche.ts';

export interface Lage {
  quelle: string;
  verbunden: boolean;
  letzteDaten: number | null;
  fehler: string | null;
}

export interface Optionen {
  speicher: Speicher;
  lage: () => Lage;
  port: number;
  host: string;
  aufbewahrungTage: number;
  titel?: string;
  teilnehmer?: Record<string, string>;
  oeffentlich?: string;
  versuche?: Versuchsleiter;
  ebusd?: Befehle | null; // für den Zustand von ebusd in der Oberfläche (Befehl state)
  jetzt?: () => number;
}

const OEFFENTLICH = fileURLToPath(new URL('../public/', import.meta.url));
const TYPEN: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};
const STATUS: Status[] = ['ok', 'keine-antwort', 'nak', 'crc-fehler', 'unvollstaendig'];
const KOEPFE = {
  'content-security-policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
};

class Ungueltig extends Error {}

function zahl(q: URLSearchParams, name: string, min: number, max: number): number | undefined {
  const w = q.get(name);
  if (w === null || w === '') return undefined;
  if (!/^-?\d+$/.test(w)) throw new Ungueltig(`${name} ist keine ganze Zahl`);
  const n = Number(w);
  if (n < min || n > max) throw new Ungueltig(`${name} außerhalb ${min}…${max}`);
  return n;
}

function adresse(q: URLSearchParams, name: string): number | undefined {
  const w = q.get(name);
  if (w === null || w === '') return undefined;
  if (!/^[0-9a-fA-F]{1,2}$/.test(w)) throw new Ungueltig(`${name} ist keine Adresse (zwei Hex-Ziffern)`);
  return parseInt(w, 16);
}

function filter(q: URLSearchParams): Filter {
  const pbsb = q.get('pbsb') || undefined;
  if (pbsb !== undefined && !/^[0-9a-fA-F]{4}$/.test(pbsb)) throw new Ungueltig('pbsb sind vier Hex-Ziffern');
  const status = (q.get('status') || undefined) as Status | undefined;
  if (status !== undefined && !STATUS.includes(status)) throw new Ungueltig(`status ist eins von ${STATUS.join(', ')}`);
  return {
    von: zahl(q, 'von', 0, 8.64e15),
    bis: zahl(q, 'bis', 0, 8.64e15),
    pbsb: pbsb?.toLowerCase(),
    qq: adresse(q, 'qq'),
    zz: adresse(q, 'zz'),
    status,
    grenze: zahl(q, 'grenze', 1, 5000),
    vor: zahl(q, 'vor', 1, Number.MAX_SAFE_INTEGER),
  };
}

function senden(res: ServerResponse, code: number, typ: string, inhalt: string | Buffer, kopf = false, extra: Record<string, string> = {}) {
  res.writeHead(code, { 'content-type': typ, 'cache-control': 'no-store', ...KOEPFE, ...extra });
  res.end(kopf ? undefined : inhalt);
}

function json(res: ServerResponse, daten: unknown, kopf: boolean, extra: Record<string, string> = {}) {
  senden(res, 200, 'application/json; charset=utf-8', JSON.stringify(daten), kopf, extra);
}

class Verboten extends Error {}

/** POST nur als JSON von derselben Herkunft, höchstens 4 kB. */
async function koerper(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (!/^application\/json\b/.test(req.headers['content-type'] ?? '')) throw new Ungueltig('nur application/json');
  const site = req.headers['sec-fetch-site'];
  if (site && site !== 'same-origin' && site !== 'none') throw new Verboten('nur von dieser Seite');
  const herkunft = req.headers.origin;
  if (herkunft) {
    let host = '';
    try {
      host = new URL(herkunft).host;
    } catch {
      // bleibt leer
    }
    if (host !== req.headers.host) throw new Verboten('nur von dieser Seite');
  }
  let text = '';
  for await (const teil of req) {
    text += teil;
    if (text.length > 4096) throw new Ungueltig('zu groß');
  }
  let daten: unknown;
  try {
    daten = JSON.parse(text);
  } catch {
    throw new Ungueltig('kein JSON');
  }
  if (!daten || typeof daten !== 'object' || Array.isArray(daten)) throw new Ungueltig('JSON-Objekt erwartet');
  return daten as Record<string, unknown>;
}

function ganzzahl(d: Record<string, unknown>, name: string): number {
  const w = d[name];
  if (typeof w !== 'number' || !Number.isInteger(w) || w < 1) throw new Ungueltig(`${name} fehlt`);
  return w;
}

async function datei(res: ServerResponse, wurzel: string, pfad: string, kopf: boolean) {
  const name = pfad === '/' ? 'index.html' : decodeURIComponent(pfad.slice(1));
  const voll = normalize(join(wurzel, name));
  if (!voll.startsWith(wurzel.endsWith(sep) ? wurzel : wurzel + sep) || !TYPEN[extname(voll)]) {
    return senden(res, 404, 'text/plain; charset=utf-8', 'nicht gefunden', kopf);
  }
  try {
    senden(res, 200, TYPEN[extname(voll)]!, await readFile(voll), kopf);
  } catch {
    senden(res, 404, 'text/plain; charset=utf-8', 'nicht gefunden', kopf);
  }
}

export function starteServer(o: Optionen): Server {
  const wurzel = o.oeffentlich ?? OEFFENTLICH;
  const jetzt = o.jetzt ?? Date.now;
  // Zustand von ebusd (state: Signal, Symbolrate, Master), höchstens alle 10 s neu gefragt, ohne auf die Antwort zu warten
  const ebusdLage = { text: null as string | null, ok: false, zeit: 0, fragt: false };
  const frageEbusd = () => {
    if (!o.ebusd || ebusdLage.fragt || jetzt() - ebusdLage.zeit < 10_000) return;
    ebusdLage.fragt = true;
    o.ebusd
      .befehl('state')
      .then((a) => Object.assign(ebusdLage, { text: a.text, ok: a.ok }))
      .catch((e: Error) => Object.assign(ebusdLage, { text: e.message, ok: false }))
      .finally(() => Object.assign(ebusdLage, { zeit: jetzt(), fragt: false }));
  };
  const versuche = () => {
    frageEbusd();
    const lage = o.versuche?.lage() ?? { erlaubt: false, versuche: [], lauf: null };
    return { ...lage, ebusd: o.ebusd ? { text: ebusdLage.text, ok: ebusdLage.ok } : null };
  };
  const post = async (req: IncomingMessage, res: ServerResponse, pfad: string) => {
    const l = o.versuche;
    if (!l) throw new VersuchFehler(403, 'Versuchsbetrieb ist aus');
    const d = await koerper(req);
    if (pfad === '/api/versuche/start') {
      if (typeof d.versuch !== 'string') throw new Ungueltig('versuch fehlt');
      l.starte(d.versuch);
    } else if (pfad === '/api/versuche/weiter') {
      l.weiter(ganzzahl(d, 'lauf'), ganzzahl(d, 'schritt'), typeof d.notiz === 'string' ? d.notiz : '');
    } else if (pfad === '/api/versuche/abbrechen') {
      l.abbrechen(ganzzahl(d, 'lauf'));
    } else return senden(res, 404, 'text/plain; charset=utf-8', 'nicht gefunden');
    return json(res, versuche(), false);
  };
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const kopf = req.method === 'HEAD';
    const url = new URL(req.url ?? '/', 'http://ebus');
    const istPost = req.method === 'POST' && url.pathname.startsWith('/api/versuche/');
    if (req.method !== 'GET' && !kopf && !istPost) {
      res.setHeader('allow', url.pathname.startsWith('/api/versuche/') ? 'POST' : 'GET, HEAD');
      return senden(res, 405, 'text/plain; charset=utf-8', 'nur lesen');
    }
    try {
      if (istPost) return await post(req, res, url.pathname);
      const lauf = /^\/api\/laeufe\/(\d{1,12})$/.exec(url.pathname);
      if (lauf) {
        const z = o.speicher.lauf(Number(lauf[1]));
        if (!z) return senden(res, 404, 'text/plain; charset=utf-8', 'nicht gefunden', kopf);
        const protokoll = {
          lauf: z,
          ereignisse: o.speicher.ereignisse(z.id),
          telegramme: o.speicher.telegrammeZwischen(z.start - RAND, (z.ende ?? jetzt()) + RAND),
          teilnehmer: o.teilnehmer ?? {},
        };
        const datei: Record<string, string> = url.searchParams.has('download')
          ? { 'content-disposition': `attachment; filename="ebus-lauf-${z.id}-${z.versuch.replace(/[^a-z0-9-]/gi, '')}.json"` }
          : {};
        return json(res, protokoll, kopf, datei);
      }
      switch (url.pathname) {
        case '/api/versuche':
          return json(res, versuche(), kopf);
        case '/api/laeufe':
          return json(res, o.speicher.laeufe(), kopf);
        case '/gesund':
          return senden(res, 200, 'text/plain; charset=utf-8', 'ok', kopf);
        case '/api/telegramme':
          return json(res, o.speicher.liste(filter(url.searchParams)), kopf);
        case '/api/uebersicht':
          return json(res, o.speicher.uebersicht(filter(url.searchParams)), kopf);
        case '/api/verlauf':
          return json(res, o.speicher.jeStunde(filter(url.searchParams)), kopf);
        case '/api/status':
          return json(
            res,
            {
              ...o.speicher.kennzahlen(),
              ...o.lage(),
              aufbewahrungTage: o.aufbewahrungTage,
              titel: o.titel ?? 'eBus',
              teilnehmer: o.teilnehmer ?? {},
            },
            kopf,
          );
        default:
          if (url.pathname.startsWith('/api/')) return senden(res, 404, 'text/plain; charset=utf-8', 'nicht gefunden', kopf);
          return await datei(res, wurzel, url.pathname, kopf);
      }
    } catch (e) {
      if (e instanceof Ungueltig) return senden(res, 400, 'text/plain; charset=utf-8', e.message, kopf);
      if (e instanceof Verboten) return senden(res, 403, 'text/plain; charset=utf-8', e.message, kopf);
      if (e instanceof VersuchFehler) return senden(res, e.code, 'text/plain; charset=utf-8', e.message, kopf);
      if (e instanceof URIError) return senden(res, 404, 'text/plain; charset=utf-8', 'nicht gefunden', kopf);
      console.error('Fehler bei', url.pathname, e);
      return senden(res, 500, 'text/plain; charset=utf-8', 'interner Fehler', kopf);
    }
  });
  server.listen(o.port, o.host);
  return server;
}
