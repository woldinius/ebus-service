// Start im Container. Alles Einstellbare kommt aus der Umgebung (docker-compose.yml), Vorgaben passend zum Beispiel in README.md.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Definitionen } from './definitionen.ts';
import { Dienst } from './dienst.ts';
import { teilnehmer } from './konfig.ts';
import { starteServer } from './server.ts';
import { Speicher } from './speicher.ts';

const env = process.env;
const PROTOKOLL = env.PROTOKOLL ?? '/protokoll/raw.log';
const DATENBANK = env.DATENBANK ?? '/data/ebus.db';
const DEFINITIONEN = env.DEFINITIONEN ?? '/definitionen';
const HOST = env.HOST ?? '0.0.0.0';
const PORT = Number(env.PORT ?? 3000);
const TAGE = Number(env.AUFBEWAHRUNG_TAGE ?? 7);
const TITEL = env.TITEL || 'eBus';
const TEILNEHMER = teilnehmer(env.TEILNEHMER);
if (!Number.isInteger(PORT) || !Number.isInteger(TAGE) || TAGE < 1) throw new Error('PORT und AUFBEWAHRUNG_TAGE sind ganze Zahlen');

function ladeDefinitionen(ordner: string): Definitionen {
  try {
    const csv = readdirSync(ordner)
      .filter((n) => n.endsWith('.csv'))
      .map((n) => readFileSync(join(ordner, n), 'utf8'));
    return Definitionen.ausCsv(csv.join('\n'));
  } catch (e) {
    console.warn(`Keine Definitionen aus ${ordner}: ${(e as Error).message}`);
    return Definitionen.ausCsv('');
  }
}

const speicher = new Speicher(DATENBANK);
const definitionen = ladeDefinitionen(DEFINITIONEN);
const dienst = new Dienst({ speicher, protokoll: PROTOKOLL, definitionen, aufbewahrungTage: TAGE });
console.log(`ebus-service: liest ${PROTOKOLL}, speichert in ${DATENBANK} für ${TAGE} Tage, ${definitionen.anzahl} Definitionen`);
console.log(`ebus-service: ${dienst.aufraeumen()} alte Telegramme gelöscht`);

const lesen = setInterval(() => {
  try {
    dienst.schritt();
  } catch (e) {
    console.error('Lesen gescheitert:', e);
  }
}, 1000);
const aufraeumen = setInterval(() => {
  try {
    const n = dienst.aufraeumen();
    if (n) console.log(`ebus-service: ${n} Telegramme älter als ${TAGE} Tage gelöscht`);
  } catch (e) {
    console.error('Aufräumen gescheitert:', e);
  }
}, 3_600_000);

const server = starteServer({
  speicher,
  lage: () => dienst.lage(),
  port: PORT,
  host: HOST,
  aufbewahrungTage: TAGE,
  titel: TITEL,
  teilnehmer: TEILNEHMER,
});
server.on('listening', () => console.log(`ebus-service: Oberfläche auf ${HOST}:${PORT}`));

function ende(signal: string) {
  console.log(`ebus-service: ${signal}, beende`);
  clearInterval(lesen);
  clearInterval(aufraeumen);
  server.close(() => {
    try {
      dienst.schritt();
    } finally {
      speicher.schliessen();
      process.exit(0);
    }
  });
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', () => ende('SIGTERM'));
process.on('SIGINT', () => ende('SIGINT'));
