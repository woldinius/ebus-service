# ebus-service

Schreibt mit, was auf einem eBus passiert, hält jedes Telegramm eine Woche lang vor und zeigt es im Browser.

Der Dienst liest das Rohprotokoll von [ebusd](https://github.com/john30/ebusd), zerlegt jedes Telegramm (Absender, Empfänger,
Befehl, Daten, Antwort, Prüfsumme, Quittung), speichert es in SQLite und löscht es nach der eingestellten Zahl Tage. Er sendet
nichts auf den Bus und spricht nicht mit ebusd; er liest nur dessen Protokolldatei.

```
eBus-Koppler → ebusd (--readonly, --lograwdata) → raw.log → ebus-service → SQLite → Browser
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
| `/gesund` | `ok`, für den Healthcheck |

Nur `GET` und `HEAD`. Eine Anmeldung gibt es nicht: Wer den Dienst erreichen darf, regelt der Reverse Proxy davor.

## eBus in Kürze

Nach der eBUS-Spezifikation OSI 1/2 V1.3.1 ([`docs/`](docs/Spec_Prot_12_V1_3_1.pdf)):

- `AA` (SYN) trennt die Telegramme; in Daten steht `A9` als `A9 00` und `AA` als `A9 01`.
- Telegramm: `QQ ZZ PB SB NN` + `NN` Datenbytes + CRC. Rundruf an `FE` ohne Quittung; an einen Master folgt `00` (ACK) oder `FF`
  (NAK); an einen Slave folgt nach dem ACK dessen Antwort `NN` + Daten + CRC und das ACK des Masters.
- Master-Adressen haben beide Halbbytes aus 0, 1, 3, 7, F; ihr Slave liegt 5 darüber (`37` → `3c`, `FF` → `04`).
- CRC-8 mit dem Polynom 0x9B über die expandierte Folge, gerechnet wie ebusd: `crc = T[crc] ^ byte`.

Der Status jedes Telegramms ist `ok`, `keine-antwort`, `nak`, `crc-fehler` oder `unvollstaendig`.

## Entwickeln

Node ab 24.14, sonst nichts: Node führt TypeScript direkt aus und bringt SQLite (`node:sqlite`) und den Testlauf mit. Keine
npm-Pakete, kein Build-Schritt; die Oberfläche in [`public/`](public/) ist reines HTML, CSS und JavaScript.

```sh
npm test
PROTOKOLL=/tmp/raw.log DATENBANK=/tmp/ebus.db DEFINITIONEN=. PORT=3010 npm start
```

Zum Ausprobieren ohne Bus Zeilen wie oben an `/tmp/raw.log` anhängen. Typen prüft `tsc -p .` (TypeScript 5.9 mit `@types/node`
24), das gehört nicht zum Image.

## Geschichte

2018 als Java-Dienst begonnen (Spring Boot, serielle Schnittstelle über RXTX, Datenpunkte des Wolf ISM8), nie fertig geworden.
2026 neu geschrieben: ebusd übernimmt den Bus, dieser Dienst nur das Mitschreiben und Anzeigen. Der alte Stand liegt in der
Git-Geschichte.

## Lizenz

GPL-3.0, siehe [`LICENSE`](LICENSE). In [`docs/`](docs/) liegen die eBUS-Spezifikation der eBUS Interest Group und die Unterlagen
zum ESERA-Koppler 12001; sie gehören ihren Herausgebern.
