# ebus-service

Schreibt mit, was auf einem eBus passiert, hält jedes Telegramm eine Woche lang vor und zeigt es im Browser. Dazu geführte
Versuche: Wer am Gerät steht, startet sie im Browser (auch auf dem Handy), der Dienst fragt über ebusd Werte ab und bittet um
Handgriffe am Gerät, und alles landet mit Zeit in einem Protokoll, aus dem sich das Protokoll des Geräts entschlüsseln lässt.

Der Dienst liest das Rohprotokoll von [ebusd](https://github.com/john30/ebusd), zerlegt jedes Telegramm (Absender, Empfänger,
Befehl, Daten, Antwort, Prüfsumme, Quittung), speichert es in SQLite und löscht es nach der eingestellten Zahl Tage. Selbst
sendet er nie auf den Bus. Nur für Versuche und nur mit `VERSUCHE=an` schickt er Befehle an den Befehlsport von ebusd
(`read`, `write`, `hex`, wie `ebusctl`); ebusd sendet sie dann.

```
eBus-Koppler → ebusd (--lograwdata) → raw.log → ebus-service → SQLite → Browser
                 ↑ Befehlsport 8888 ← ebus-service (nur Versuche, VERSUCHE=an)
```

## Warum das Rohprotokoll

`ebusctl listen`, `grab`, `direct` und die HTTP-Schnittstelle von ebusd fassen je Nachricht zusammen, haben keine Zeit je
Telegramm und lassen Telegramme weg, auf die niemand antwortet. Das Rohprotokoll (`--lograwdata --lograwdatafile=…`) schreibt
dagegen jede Bytefolge zwischen zwei SYN als eigene Zeile, mit Zeit auf die Millisekunde:

```
2026-11-19 07:28:40.118 <37fefe010a453030302020202020203d
2026-11-19 07:28:40.170 <375a40a004003200324f
2026-11-19 07:29:08.655 <1008b511100102030405060708090a0b0c0d0e0f105500102021222324252627...
2026-11-19 07:29:08.656 ...<28292a2b2c2d2e2f6600
```

Sendet ebusd selbst, steht das Telegramm in derselben Zeile, die Richtung wechselt mittendrin: `>` gesendet, `<` empfangen, zum
Beispiel `>313c402201019c<000200022e>00` für Anfrage, Antwort des Slaves und Quittung von ebusd. Das Echo der eigenen Bytes
lässt ebusd weg, und dabei jedes empfangene Byte, das dem zuletzt gesendeten gleicht: Ist das CRC einer Anfrage `00`, fehlt die
Quittung `00` des Slaves, bei leerer Antwort auch deren NN und CRC (`>313c4022019d0000`). Beides füllt ebus-service wieder auf
(ebusd 26.1, `src/lib/ebus/protocol.cpp`, `notifyDeviceData`; am nachgebauten Bus mit dem echten ebusd geprüft).

Nach 64 Hex-Zeichen bricht ebusd um, ab `--lograwdatasize` kB wird die Datei zu `.old`. ebus-service fügt umgebrochene Zeilen
zusammen, folgt dem Dateiwechsel und merkt sich die Lesestelle in der Datenbank: Nach einem Neustart liest er dort weiter, nichts
doppelt. Beim allerersten Start beginnt er am Ende der Datei. (Verhalten mit ebusd 26.1 ausprobiert.)

## Starten mit Docker Compose

```yaml
services:
  ebusd:
    image: john30/ebusd:v26.1
    devices:
      - /dev/serial/by-id/<dein-koppler>:/dev/ttyUSB0
    command: ["--scanconfig=off"]
    environment:
      EBUSD_DEVICE: "/dev/ttyUSB0"
      EBUSD_READONLY: ""
      EBUSD_LOGRAWDATA: ""
      EBUSD_LOGRAWDATAFILE: "/protokoll/raw.log"
      EBUSD_LOGRAWDATASIZE: "10240"
    volumes:
      - protokoll:/protokoll

  ebus-service:
    build: https://github.com/woldinius/ebus-service.git
    ports:
      - "127.0.0.1:3010:3000"
    environment:
      TITEL: "Lüftung"
      TEILNEHMER: "37=Lüftung,3c=Lüftung,fe=alle"
    volumes:
      - protokoll:/protokoll:ro
      - ebus-daten:/data
    read_only: true
    cap_drop: [ALL]
    security_opt: [no-new-privileges:true]

volumes:
  protokoll:
  ebus-daten:
```

Dann `http://127.0.0.1:3010`. Für den Betrieb das Image auf einen Commit festlegen statt den Zweig zu bauen.

So hört ebusd nur zu. Für Versuche bei ebusd `EBUSD_READONLY` weglassen (und `EBUSD_ENABLEHEX: ""` fürs Abtasten), bei
ebus-service `EBUSD: "ebusd:8888"` und `VERSUCHE: "an"` setzen; der Befehlsport bleibt im Compose-Netz, ohne `ports:`.

## Einstellungen

| Variable | Vorgabe | Bedeutung |
|---|---|---|
| `PROTOKOLL` | `/protokoll/raw.log` | Rohprotokoll von ebusd (`--lograwdatafile`) |
| `DATENBANK` | `/data/ebus.db` | SQLite-Datei |
| `DEFINITIONEN` | `/definitionen` | Ordner mit CSV-Definitionen von ebusd; Nachrichten bekommen daraus einen Namen (PB/SB und Kennung) |
| `AUFBEWAHRUNG_TAGE` | `7` | Älteres löscht der Dienst stündlich |
| `TITEL` | `eBus` | steht im Kopf der Seite |
| `TEILNEHMER` | leer | Namen für Adressen, z. B. `37=Lüftung,3c=Lüftung,fe=alle` |
| `HOST`, `PORT` | `0.0.0.0`, `3000` | im Container |
| `EBUSD` | leer | Befehlsport von ebusd als `HOST:PORT`, z. B. `ebusd:8888`; leer = keine Versuche |
| `VERSUCHE` | `aus` | `an` schaltet die Knöpfe für Versuche frei (braucht `EBUSD`) |
| `KREIS` | `excellent` | Circuit der Definition in ebusd (`read -c KREIS NAME`) |
| `CWL` | `3c` | Slave-Adresse des Geräts für `hex` beim Abtasten |

Die Zeiten stammen von ebusd und gelten als UTC (so schreibt das Image von ebusd ohne gesetzte Zeitzone).

## Oberfläche und API

Die Seite zeigt Telegramme je Stunde über die ganze Aufbewahrung, eine Übersicht je Nachricht (Absender, Empfänger, Befehl,
Anzahl, zuletzt gesehen, letzte Daten) und die Liste aller Telegramme mit Zeitraum und Status. Ein Klick auf eine Nachricht filtert
die Liste. Sie lädt alle 10 Sekunden nach, braucht nichts aus dem Internet und lässt sich auf dem Handy zum Home-Bildschirm
hinzufügen.

| Pfad | Inhalt |
|---|---|
| `/api/telegramme` | Telegramme, neueste zuerst. Filter: `von`, `bis` (ms seit 1970), `qq`, `zz` (Adresse), `pbsb`, `status`, `grenze`, `vor` (id, zum Blättern) |
| `/api/uebersicht` | je Absender, Empfänger und Befehl: Anzahl, erstes und letztes Mal, letzte Daten |
| `/api/verlauf` | Anzahl je Stunde |
| `/api/status` | Anzahl, ältestes, neuestes, ob gerade Telegramme kommen, Einstellungen für die Oberfläche |
| `/api/versuche` | ob Versuche erlaubt sind, die Liste, der laufende oder letzte Lauf (Schritt, Werte, letzte Ereignisse), Zustand von ebusd (`state`) |
| `POST /api/versuche/start` | `{"versuch": "bestand"}` startet; höchstens einer zur Zeit |
| `POST /api/versuche/weiter` | `{"lauf": 1, "schritt": 3, "notiz": "…"}` bestätigt genau diesen Schritt; ein zweites Tippen zählt nicht |
| `POST /api/versuche/abbrechen` | `{"lauf": 1}`; was der Versuch verstellt hat, stellt er zurück |
| `/api/laeufe` | alle Läufe, neueste zuerst |
| `/api/laeufe/<id>` | das Protokoll eines Laufs: Lauf, Ereignisse, alle Telegramme von 2 min davor bis 2 min danach; `?download` als Datei |
| `/gesund` | `ok`, für den Healthcheck |

Lesen per `GET` und `HEAD`, ohne Anmeldung: Wer den Dienst erreichen darf, regelt der Reverse Proxy davor. `POST` nur für die
Versuche, nur mit `VERSUCHE=an`, nur als JSON und nur von derselben Herkunft (`Origin`, `Sec-Fetch-Site`): Eine fremde Seite im
selben Browser bräuchte für JSON eine CORS-Vorabfrage, die der Dienst nie erlaubt.

## Versuche

Ein Versuch läuft im Dienst, nicht im Browser: Sperrt sich das Handy, läuft er weiter, und die Seite zeigt beim Aufwachen den
aktuellen Schritt. Er liest Werte (`read -f`), bittet um Handgriffe am Gerät und wartet auf „Erledigt“, liest in Wartezeiten
alle paar Sekunden weiter und hält jede Anfrage, Antwort und Notiz als Ereignis fest. Telegramme aus der Zeit eines Laufs (mit
2 Minuten Rand) löscht das Aufräumen nicht.

Für die Wolf CWL Excellent ([`src/cwl-versuche.ts`](src/cwl-versuche.ts)): Bestandsaufnahme (alle Lesebefehle der Definition),
Stufe am Gerät (0 bis 3 von Hand), Stufe per eBus (`SetFanMode High`, warten bis die CWL zurückfällt, dann den Ausgangswert),
Stufe wie das Bedienteil (`SetFanModeAlt High`, das nicht von selbst zurückfällt; einmal eine Taste am Gerät, dann den
Ausgangswert), Filter quittieren (von Hand am Gerät, die App liest davor und danach) und Unbekanntes abtasten (`hex` an `40 22 xx`
und `40 50 xx`, braucht `--enablehex`). Geschrieben werden nur `SetFanMode` und `SetFanModeAlt` mit Holiday, Reduced, Normal oder
High, `hex` nur an das Gerät mit `40 22`/`40 50` und einer Kennung ([`src/versuche.ts`](src/versuche.ts), `SCHREIBBAR`).
`SetFanModeAlt` braucht die Zeile dazu in der Definition.

## eBus in Kürze

Nach der eBUS-Spezifikation OSI 1/2 V1.3.1 ([`docs/`](docs/Spec_Prot_12_V1_3_1.pdf)):

- `AA` (SYN) trennt die Telegramme; in Daten steht `A9` als `A9 00` und `AA` als `A9 01`.
- Telegramm: `QQ ZZ PB SB NN` + `NN` Datenbytes + CRC. Rundruf an `FE` ohne Quittung; an einen Master folgt `00` (ACK) oder `FF`
  (NAK); an einen Slave folgt nach dem ACK dessen Antwort `NN` + Daten + CRC und das ACK des Masters.
- Master-Adressen haben beide Halbbytes aus 0, 1, 3, 7, F; ihr Slave liegt 5 darüber (`37` → `3c`, `FF` → `04`).
- CRC-8 mit dem Polynom 0x9B über die expandierte Folge, gerechnet wie ebusd: `crc = T[crc] ^ byte`.

Der Status jedes Telegramms ist `ok`, `keine-antwort`, `nak`, `crc-fehler` oder `unvollstaendig`.

Was eine Wolf CWL Excellent sendet, steht in [`docs/wolf-cwl-excellent.md`](docs/wolf-cwl-excellent.md).

## Entwickeln

Node ab 24.14, sonst nichts: Node führt TypeScript direkt aus und bringt SQLite (`node:sqlite`) und den Testlauf mit. Keine
npm-Pakete, kein Build-Schritt; die Oberfläche in [`public/`](public/) ist reines HTML, CSS und JavaScript.

```sh
npm test
PROTOKOLL=/tmp/raw.log DATENBANK=/tmp/ebus.db DEFINITIONEN=. PORT=3010 npm start
```

Zum Ausprobieren ohne Bus Zeilen wie oben an `/tmp/raw.log` anhängen. Typen prüft `tsc -p .` (TypeScript 5.9 mit `@types/node`
24), das gehört nicht zum Image.

[`src/ebusd-echt.test.ts`](src/ebusd-echt.test.ts) startet das echte ebusd in Docker an einem nachgebauten Bus
([`werkzeug/busnachbau.ts`](werkzeug/busnachbau.ts): Echo, SYN alle 45 ms, ein Slave, der antwortet, was der Test vorgibt) und
prüft, was `read`, `write` und `hex` liefern und wie das Rohprotokoll dann aussieht. Ohne Docker oder ohne das Image
(`EBUSD_IMAGE`, Vorgabe v26.1) wird er übersprungen.

## Geschichte

2018 als Java-Dienst begonnen (Spring Boot, serielle Schnittstelle über RXTX, Datenpunkte des Wolf ISM8), nie fertig geworden.
2026 neu geschrieben: ebusd übernimmt den Bus, dieser Dienst das Mitschreiben und Anzeigen, seit 2026-11-20 auch geführte Versuche
für die aktive Kommunikation. Der alte Stand liegt in der Git-Geschichte.

## Lizenz

GPL-3.0, siehe [`LICENSE`](LICENSE). In [`docs/`](docs/) liegen die eBUS-Spezifikation der eBUS Interest Group und die Unterlagen
zum ESERA-Koppler 12001; sie gehören ihren Herausgebern.
