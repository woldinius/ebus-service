// Versuche in der Oberfläche: starten, Schritt für Schritt bestätigen, abbrechen, Protokoll herunterladen.
// Der Lauf lebt im Dienst; diese Seite zeigt nur seinen Stand (alle 1,5 s, solange er läuft) und schickt „Erledigt“.
// Texte vom Dienst kommen nur über textContent ins Dokument, nie als HTML.

const $ = (id) => document.getElementById(id);
const uhr = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const datum = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const STATUS = { laeuft: 'läuft', fertig: 'fertig', abgebrochen: 'abgebrochen', fehler: 'Fehler', unterbrochen: 'unterbrochen' };
const KNOPF = { erledigt: 'Erledigt', eingabe: 'Speichern', warten: 'Weiter' };
const NOTIZ = { erledigt: 'Notiz (optional)', eingabe: 'Antwort', warten: 'Notiz (optional)' };
const ART = {
  schritt: '▶', lesen: 'lesen', schreiben: 'schreiben', hex: 'hex', erledigt: 'erledigt', eingabe: 'Antwort', weiter: 'weiter',
  notiz: 'Notiz', fehler: 'Fehler', abbruch: 'Abbruch',
};

const z = { lage: null, schrittNr: null, geschlossen: null, sendet: false, laeufeStand: '' };

async function hole(pfad) {
  const r = await fetch(`api/${pfad}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${pfad}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function schicke(pfad, daten) {
  const r = await fetch(`api/versuche/${pfad}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(daten),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

function melde(text) {
  $('lauf-meldung').textContent = text;
  $('lauf-meldung').hidden = !text;
}

function vor(ms) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  return s < 60 ? `vor ${s} s` : `vor ${Math.round(s / 60)} min`;
}

// --- Liste der Versuche ---------------------------------------------------------------------------------
function zeigeListe(lage) {
  const ul = $('versuch-liste');
  const laeuft = lage.lauf?.status === 'laeuft';
  ul.replaceChildren();
  for (const v of lage.versuche) {
    const li = document.createElement('li');
    const kopf = document.createElement('div');
    kopf.className = 'versuch-kopf';
    const t = document.createElement('strong');
    t.textContent = v.titel;
    const d = document.createElement('span');
    d.className = 'leise';
    d.textContent = v.dauer;
    kopf.append(t, ' ', d);
    const b = document.createElement('p');
    b.className = 'beschreibung';
    b.textContent = v.beschreibung;
    const k = document.createElement('button');
    k.type = 'button';
    k.className = 'haupt';
    k.textContent = 'Starten';
    k.disabled = !lage.erlaubt || laeuft || z.sendet;
    k.addEventListener('click', () => starte(v));
    li.append(kopf, b);
    if (v.einmalig) {
      const w = document.createElement('p');
      w.className = 'warnung';
      w.textContent = v.einmalig;
      li.append(w);
    }
    li.append(k);
    ul.append(li);
  }
  $('versuche-aus').hidden = lage.erlaubt;
  const e = lage.ebusd;
  $('ebusd-lage').textContent = e ? `· ebusd: ${e.text ?? 'wird gefragt …'}` : '';
  $('ebusd-lage').className = e && !e.ok && e.text ? 'fehler' : 'leise';
}

async function starte(v) {
  if (v.einmalig && !confirm(`${v.einmalig}\n\n„${v.titel}“ jetzt starten?`)) return;
  z.sendet = true;
  try {
    melde('');
    z.geschlossen = null;
    zeige(await schicke('start', { versuch: v.id }));
    $('versuche').scrollIntoView({ block: 'start', behavior: 'smooth' });
  } catch (e) {
    alert(`Start gescheitert: ${e.message}`);
  } finally {
    z.sendet = false;
  }
}

// --- Laufender Versuch ----------------------------------------------------------------------------------
function zeigeLauf(l) {
  const box = $('lauf');
  if (!l || z.geschlossen === l.id) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const laeuft = l.status === 'laeuft';
  $('lauf-titel').textContent = l.titel;
  $('lauf-status').textContent = `${STATUS[l.status] ?? l.status} · seit ${uhr.format(l.start)}${l.fehler ? ` · ${l.fehler}` : ''}`;
  $('lauf-status').className = l.status === 'fehler' ? 'fehler' : 'leise';
  box.classList.toggle('vorbei', !laeuft);

  const s = l.schritt;
  $('schritt-text').textContent = s ? s.text : laeuft ? '…' : 'Versuch beendet.';
  const wartet = laeuft && s && s.art !== 'arbeitet';
  $('schritt-form').hidden = !laeuft;
  $('notiz-feld').hidden = !wartet;
  $('weiter').hidden = !wartet;
  if (wartet) {
    $('weiter').textContent = KNOPF[s.art];
    $('notiz-label').textContent = NOTIZ[s.art];
  }
  if (s && s.nr !== z.schrittNr) {
    z.schrittNr = s.nr;
    $('notiz').value = '';
    $('weiter').disabled = false;
    if (navigator.vibrate) navigator.vibrate(80);
  }
  const zeit = [];
  if (s) zeit.push(`Schritt ${s.nr}, seit ${vor(s.seit).replace('vor ', '')}`);
  if (s?.bis) zeit.push(`spätestens in ${Math.max(0, Math.round((s.bis - Date.now()) / 1000))} s weiter`);
  $('schritt-zeit').textContent = zeit.join(' · ');
  const f = s?.fortschritt;
  $('schritt-fortschritt').hidden = !f;
  if (f) {
    $('schritt-fortschritt').max = f.gesamt;
    $('schritt-fortschritt').value = f.fertig;
    $('schritt-zeit').textContent += ` · ${f.fertig} von ${f.gesamt}`;
  }

  const tb = $('werte').tBodies[0];
  tb.replaceChildren();
  for (const w of l.werte) {
    const tr = document.createElement('tr');
    for (const [text, klasse] of [[w.name], [w.wert, w.ok ? 'wert' : 'wert fehler'], [vor(w.zeit), 'leise']]) {
      const td = document.createElement('td');
      td.textContent = text;
      if (klasse) td.className = klasse;
      tr.append(td);
    }
    tb.append(tr);
  }
  $('werte-box').hidden = !l.werte.length;

  const ol = $('ereignisse');
  ol.replaceChildren();
  for (const e of [...l.ereignisse].reverse().slice(0, 15)) {
    const li = document.createElement('li');
    if (e.ok === false) li.className = 'fehler';
    const t = document.createElement('span');
    t.className = 'leise';
    t.textContent = `${uhr.format(e.zeit)} ${ART[e.art] ?? e.art} `;
    li.append(t, [e.text, e.antwort].filter((x) => x).join(' → '));
    ol.append(li);
  }

  $('lauf-ende').hidden = laeuft;
  $('protokoll-link').href = `api/laeufe/${l.id}?download`;
}

function zeige(lage) {
  z.lage = lage;
  zeigeListe(lage);
  zeigeLauf(lage.lauf);
}

$('schritt-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const l = z.lage?.lauf;
  if (!l?.schritt || $('weiter').disabled) return;
  $('weiter').disabled = true; // ein zweites Tippen zählt nicht
  try {
    melde('');
    zeige(await schicke('weiter', { lauf: l.id, schritt: l.schritt.nr, notiz: $('notiz').value }));
  } catch (e) {
    melde(e.message);
    $('weiter').disabled = false;
  }
});

$('abbrechen').addEventListener('click', async () => {
  const l = z.lage?.lauf;
  if (!l || !confirm(`„${l.titel}“ abbrechen? Was der Versuch verstellt hat, stellt er zurück.`)) return;
  try {
    zeige(await schicke('abbrechen', { lauf: l.id }));
  } catch (e) {
    melde(e.message);
  }
});

$('schliessen').addEventListener('click', () => {
  z.geschlossen = z.lage?.lauf?.id ?? null;
  $('lauf').hidden = true;
});

// --- Frühere Läufe --------------------------------------------------------------------------------------
async function zeigeLaeufe() {
  const liste = await hole('laeufe');
  const stand = JSON.stringify(liste.map((l) => [l.id, l.status]));
  if (stand === z.laeufeStand) return;
  z.laeufeStand = stand;
  const ul = $('laeufe');
  ul.replaceChildren();
  for (const l of liste) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `api/laeufe/${l.id}?download`;
    a.textContent = `${l.titel}`;
    li.append(a, ` · ${datum.format(l.start)} · ${STATUS[l.status] ?? l.status}${l.fehler ? ` (${l.fehler})` : ''}`);
    ul.append(li);
  }
  $('laeufe-box').hidden = !liste.length;
}

// --- Ablauf ---------------------------------------------------------------------------------------------
let wecker = null;
async function aktualisiere() {
  clearTimeout(wecker);
  try {
    zeige(await hole('versuche'));
    await zeigeLaeufe();
  } catch (e) {
    melde(`Keine Verbindung zum Dienst: ${e.message}`);
  }
  const laeuft = z.lage?.lauf?.status === 'laeuft';
  if (!document.hidden) wecker = setTimeout(aktualisiere, laeuft ? 1500 : 5000);
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) aktualisiere();
});
aktualisiere();
