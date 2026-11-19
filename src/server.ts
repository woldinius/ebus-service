// HTTP: JSON-API über den Speicher und die Oberfläche aus public/. Nur GET und HEAD, keine Anmeldung: Der Dienst zeigt nur, was
// auf dem eBus mitgelesen wurde, und ändert nichts. Wer ihn erreicht, regelt der Reverse Proxy davor.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Filter, Speicher } from './speicher.ts';
import type { Status } from './telegramm.ts';

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

function senden(res: ServerResponse, code: number, typ: string, inhalt: string | Buffer, kopf = false) {
  res.writeHead(code, { 'content-type': typ, 'cache-control': 'no-store', ...KOEPFE });
  res.end(kopf ? undefined : inhalt);
}

function json(res: ServerResponse, daten: unknown, kopf: boolean) {
  senden(res, 200, 'application/json; charset=utf-8', JSON.stringify(daten), kopf);
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
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const kopf = req.method === 'HEAD';
    if (req.method !== 'GET' && !kopf) {
      res.setHeader('allow', 'GET, HEAD');
      return senden(res, 405, 'text/plain; charset=utf-8', 'nur lesen');
    }
    const url = new URL(req.url ?? '/', 'http://ebus');
    try {
      switch (url.pathname) {
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
      if (e instanceof URIError) return senden(res, 404, 'text/plain; charset=utf-8', 'nicht gefunden', kopf);
      console.error('Fehler bei', url.pathname, e);
      return senden(res, 500, 'text/plain; charset=utf-8', 'interner Fehler', kopf);
    }
  });
  server.listen(o.port, o.host);
  return server;
}
