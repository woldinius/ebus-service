// Oberfläche des eBus-Dienstes: liest nur die JSON-API, kein Build, keine fremden Bibliotheken.
// Texte vom Bus kommen nur über textContent ins Dokument, nie als HTML.

const STUNDE = 3_600_000;
const TAG = 24 * STUNDE;
const AKTUALISIEREN_MS = 10_000;
const SEITE = 200;

// Namen für Adressen kommen aus der Umgebung des Dienstes (TEILNEHMER), über /api/status; ohne Namen steht nur die Adresse
let TEILNEHMER = {};
const ART = { rundruf: 'Rundruf', 'master-master': 'Master → Master', 'master-slave': 'Master → Slave' };
const STATUS = { ok: 'ok', 'keine-antwort': 'keine Antwort', nak: 'NAK', 'crc-fehler': 'CRC-Fehler', unvollstaendig: 'unvollständig' };

const zustand = { auswahl: null, aeltesteId: null, tage: 7 };
const $ = (id) => document.getElementById(id);
const zweistellig = (n) => n.toString(16).padStart(2, '0');
const adresse = (n) => (TEILNEHMER[zweistellig(n)] ? `${zweistellig(n)} ${TEILNEHMER[zweistellig(n)]}` : zweistellig(n));
const befehl = (pbsb) => (pbsb ? `${pbsb.slice(0, 2)} ${pbsb.slice(2)}` : '');

const zeitFormat = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const tagFormat = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
const tagKurz = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });
const schmal = window.matchMedia('(max-width: 640px)');
const zahlFormat = new Intl.NumberFormat('de-DE');

function vorWieLange(ms) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `vor ${s} s`;
  if (s < 3600) return `vor ${Math.round(s / 60)} min`;
  if (s < 86400) return `vor ${Math.round(s / 3600)} h`;
  return `vor ${Math.round(s / 86400)} Tagen`;
}

async function hole(pfad, parameter = {}) {
  const q = new URLSearchParams(Object.entries(parameter).filter(([, w]) => w !== undefined && w !== null && w !== ''));
  const r = await fetch(`api/${pfad}${q.size ? `?${q}` : ''}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${pfad}: ${r.status} ${await r.text()}`);
  return r.json();
}

function zelle(tr, inhalt, klasse) {
  const td = document.createElement('td');
  if (inhalt instanceof Node) td.append(inhalt);
  else td.textContent = inhalt ?? '';
  if (klasse) td.className = klasse;
  tr.append(td);
  return td;
}

function statusMarke(status) {
  const s = document.createElement('span');
  s.className = `status ${status}`;
  s.textContent = STATUS[status] ?? status;
  return s;
}

function antwortOderText(z) {
  if (z.text) return `„${z.text}“`;
  return z.antwort ?? '';
}

function leereZeile(tbody, spalten, text) {
  const tr = document.createElement('tr');
  const td = zelle(tr, text, 'leer');
  td.colSpan = spalten;
  tbody.append(tr);
}

// --- Lage -----------------------------------------------------------------------------------------------
async function zeigeLage() {
  const st = await hole('status');
  zustand.tage = st.aufbewahrungTage;
  TEILNEHMER = st.teilnehmer ?? {};
  const titel = st.titel && st.titel !== 'eBus' ? `· ${st.titel}` : '';
  if ($('titel').textContent !== titel) {
    $('titel').textContent = titel;
    document.title = titel ? `eBus ${titel}` : 'eBus';
  }
  $('tage').textContent = st.aufbewahrungTage;
  const p = $('lage');
  p.replaceChildren();
  const punkt = document.createElement('span');
  punkt.className = `punkt${st.verbunden ? ' an' : ''}`;
  const teile = [
    st.verbunden ? `verbunden mit ${st.quelle}` : `getrennt von ${st.quelle}${st.fehler ? ` (${st.fehler})` : ''}`,
    `${zahlFormat.format(st.anzahl)} Telegramme`,
  ];
  if (st.aeltestes) teile.push(`seit ${zeitFormat.format(st.aeltestes)}`);
  if (st.neuestes) teile.push(`zuletzt ${vorWieLange(st.neuestes)}`);
  p.append(punkt, teile.join(' · '));
}

// --- Verlauf --------------------------------------------------------------------------------------------
async function zeigeVerlauf() {
  const bis = Math.floor(Date.now() / STUNDE) * STUNDE;
  const von = bis - (zustand.tage * 24 - 1) * STUNDE;
  const daten = await hole('verlauf', { von });
  const jeStunde = new Map(daten.map((d) => [d.stunde, d.anzahl]));
  const stunden = zustand.tage * 24;
  const max = Math.max(1, ...daten.map((d) => d.anzahl));
  const summe = daten.reduce((a, d) => a + d.anzahl, 0);
  $('verlauf-summe').textContent = `· ${zahlFormat.format(summe)} in ${zustand.tage} Tagen, höchstens ${zahlFormat.format(max)} je Stunde`;

  // Balken als SVG (frei skaliert), die Tage als HTML darunter, damit die Schrift nicht mitgestaucht wird
  const ns = 'http://www.w3.org/2000/svg';
  const breite = 1000;
  const hoehe = 100;
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${breite} ${hoehe}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  const achse = document.createElement('div');
  achse.className = 'achse';
  const w = breite / stunden;
  for (let i = 0; i < stunden; i++) {
    const stunde = von + i * STUNDE;
    const n = jeStunde.get(stunde) ?? 0;
    if (n) {
      const h = Math.max(1, ((hoehe - 4) * n) / max);
      const r = document.createElementNS(ns, 'rect');
      r.setAttribute('x', (i * w).toFixed(2));
      r.setAttribute('y', (hoehe - h).toFixed(2));
      r.setAttribute('width', Math.max(0.5, w - 0.6).toFixed(2));
      r.setAttribute('height', h.toFixed(2));
      const titel = document.createElementNS(ns, 'title');
      titel.textContent = `${zeitFormat.format(stunde).slice(0, -3)}: ${n}`;
      r.append(titel);
      svg.append(r);
    }
    if (new Date(stunde).getHours() === 0) {
      const l = document.createElementNS(ns, 'line');
      l.setAttribute('x1', (i * w).toFixed(2));
      l.setAttribute('x2', (i * w).toFixed(2));
      l.setAttribute('y1', '0');
      l.setAttribute('y2', String(hoehe));
      l.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.append(l);
      const tag = document.createElement('span');
      tag.style.left = `${((i / stunden) * 100).toFixed(2)}%`;
      tag.textContent = (schmal.matches ? tagKurz : tagFormat).format(stunde);
      tag.title = tagFormat.format(stunde);
      achse.append(tag);
    }
  }
  $('verlauf').replaceChildren(svg, achse);
}

// --- Nachrichten ----------------------------------------------------------------------------------------
async function zeigeNachrichten() {
  const von = Date.now() - zustand.tage * TAG;
  const liste = await hole('uebersicht', { von });
  const tbody = $('nachrichten').tBodies[0];
  tbody.replaceChildren();
  if (!liste.length) return leereZeile(tbody, 8, 'Noch keine Telegramme.');
  for (const z of liste) {
    const tr = document.createElement('tr');
    const schluessel = `${z.qq}-${z.zz}-${z.pbsb}`;
    if (zustand.auswahl?.schluessel === schluessel) tr.className = 'gewaehlt';
    zelle(tr, `${adresse(z.qq)} → ${adresse(z.zz)}`);
    zelle(tr, befehl(z.pbsb), 'hex');
    zelle(tr, z.name ?? '–');
    zelle(tr, zahlFormat.format(z.anzahl), 'zahl');
    zelle(tr, vorWieLange(z.letzte)).title = zeitFormat.format(z.letzte);
    zelle(tr, z.daten, 'hex');
    zelle(tr, antwortOderText(z), z.text ? '' : 'hex');
    zelle(tr, statusMarke(z.status));
    tr.addEventListener('click', () => {
      zustand.auswahl = zustand.auswahl?.schluessel === schluessel ? null : { schluessel, qq: z.qq, zz: z.zz, pbsb: z.pbsb, name: z.name };
      zeigeAuswahl();
      zeigeNachrichten().catch(melde);
      zeigeTelegramme(false).catch(melde);
    });
    tbody.append(tr);
  }
}

function zeigeAuswahl() {
  const a = zustand.auswahl;
  $('auswahl').hidden = !a;
  if (a) $('auswahl-text').textContent = `${adresse(a.qq)} → ${adresse(a.zz)} · ${befehl(a.pbsb)}${a.name ? ` · ${a.name}` : ''}`;
}

// --- Telegramme -----------------------------------------------------------------------------------------
function filterWerte(vor) {
  const f = new FormData($('filter'));
  const a = zustand.auswahl;
  return {
    von: Date.now() - Number(f.get('zeitraum')),
    status: f.get('status'),
    qq: a ? zweistellig(a.qq) : undefined,
    zz: a ? zweistellig(a.zz) : undefined,
    pbsb: a?.pbsb,
    grenze: SEITE,
    vor,
  };
}

async function zeigeTelegramme(anhaengen) {
  const liste = await hole('telegramme', filterWerte(anhaengen ? zustand.aeltesteId : undefined));
  const tbody = $('telegramme').tBodies[0];
  if (!anhaengen) tbody.replaceChildren();
  if (!anhaengen && !liste.length) leereZeile(tbody, 8, 'Keine Telegramme in diesem Zeitraum.');
  for (const z of liste) {
    const tr = document.createElement('tr');
    zelle(tr, zeitFormat.format(z.zeit));
    zelle(tr, `${adresse(z.qq)} → ${adresse(z.zz)}`);
    zelle(tr, ART[z.art] ?? z.art);
    zelle(tr, befehl(z.pbsb), 'hex');
    zelle(tr, z.name ?? '–');
    zelle(tr, z.daten, 'hex').title = `roh: ${z.roh}`;
    zelle(tr, antwortOderText(z), z.text ? '' : 'hex');
    zelle(tr, statusMarke(z.status));
    tbody.append(tr);
  }
  if (liste.length) zustand.aeltesteId = liste.at(-1).id;
  $('mehr').hidden = liste.length < SEITE;
}

// --- Ablauf ---------------------------------------------------------------------------------------------
function melde(e) {
  console.error(e);
  $('lage').textContent = `Fehler: ${e.message}`;
}

async function alles() {
  await zeigeLage();
  await Promise.all([zeigeVerlauf(), zeigeNachrichten(), zeigeTelegramme(false)]);
}

$('filter').addEventListener('change', () => zeigeTelegramme(false).catch(melde));
$('mehr').addEventListener('click', () => zeigeTelegramme(true).catch(melde));
$('auswahl-weg').addEventListener('click', () => {
  zustand.auswahl = null;
  zeigeAuswahl();
  zeigeNachrichten().catch(melde);
  zeigeTelegramme(false).catch(melde);
});

alles().catch(melde);
setInterval(() => {
  if (document.hidden) return;
  // Beim Blättern in älteren Telegrammen nicht nach oben springen
  const blaettert = !$('mehr').hidden && $('telegramme').tBodies[0].rows.length > SEITE;
  zeigeLage()
    .then(() => Promise.all([zeigeVerlauf(), zeigeNachrichten(), blaettert ? null : zeigeTelegramme(false)]))
    .catch(melde);
}, AKTUALISIEREN_MS);
