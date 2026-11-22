# Wolf CWL 300 Excellent am eBus

Was eine Wolf CWL 300 Excellent (baugleich Brink Renovent Excellent) ohne Bedienmodul auf den eBus sendet. Passiv mitgelesen am
2026-11-19 über einen ESERA-Koppler und ebusd `--readonly`, rund 45 Minuten. Die CWL ist der einzige Master am Bus.

| Telegramm | Ziel | Wie oft | Antwort | Bedeutung |
|---|---|---|---|---|
| `37 xx 40 a0 04 00 32 00 32` | `56`, `57`, … `5e` reihum | alle ~5 s, jede Adresse ~45 s | keine | Herstellerbefehl ENCON (`40`): Soll-Luftmenge Zu- und Abluft in m³/h, je 16 Bit, höchstwertiges Byte zuerst (siehe unten). Vermutung: die CWL verteilt als Kaskaden-Master ihren Sollwert an die möglichen Slaves 1 bis 9; ohne gekoppelte Geräte antwortet niemand |
| `37 fe 07 04 0a 40 08 16 00 22 02 ff ff ff ff` | alle (Rundruf) | alle ~10 min | — | eBus-Standard Identifikation; `40` ist die Herstellerkennung ENCON, den Rest deutet hier noch nichts |
| `37 fe fe 01 0a "E000      "` | alle (Rundruf) | alle ~10 min, ~37 s nach `07 04` | — | eBus-Standard Fehlermeldung, zehn Zeichen Text. `E000` steht in keiner Anleitung; vermutlich „keine Störung“ |

**Adressen.** Die CWL sendet als Master `37`, ihre Slave-Adresse ist `3c` (Master plus 5, eBUS-Spezifikation 4.1.1). Eine CWL 400
meldete sich in einem Forum auf `77`/`7c`.

**Kaskade.** Bis zu zehn Geräte lassen sich koppeln: Einstellschritt 09 „Bus-Adresse“ 0 = Master, 1 bis 9 = Slave 1 bis 9; die
Slaves fahren die Luftmengen des Masters. Schritt 08 wählt eBus oder OpenTherm, Werk ist eBus. Welche Byte-Adresse zu welchem Slave
gehört, steht in der Anleitung nicht; neun aufeinanderfolgende Ziele `56` bis `5e` passen zu Slave 1 bis 9.

**Anschluss.** Klemme X1 an der Rückseite der Displayhaube, X1-1 (−) und X1-2 (+), gepolt: vertauscht funktioniert das Gerät nicht.

**Fehlercodes laut Anleitung** (Wolf, Montage- und Bedienungsanleitung CWL-300/400 Excellent, 30 63 041):

| Code | Bedeutung | verriegelnd |
|---|---|---|
| E100 / E101 | Drucksensor Zuluft / Abluft oder Schlauch verstopft | nein |
| E103 | Bypass defekt | nein |
| E104 / E105 | Abluft- / Zuluftventilator defekt (Neustart alle 5 min) | ja |
| E106 | Außenluftfühler defekt | ja |
| E107 | Abluft- bzw. Raumfühler defekt | nein |
| E108 | Fühler externe Temperatur (Nachheizregister, Erdwärmetauscher) | nein |
| E111 | Feuchtesensor defekt | nein |
| E999 | Mikroschalter (Gerätetyp) falsch gesetzt | ja |

**Filter.** Die Anzeige „FILTER“ (Filterwechsel fällig) ist kein Fehlercode: Die Fehlermeldung `fe 01` blieb dabei `E000`, und
von selbst sendet die CWL nichts zum Filter. Den Zustand gibt sie nur auf Anfrage heraus (`FilterStatus` in `40 22`,
`TotalFilterDays` in `40 50`).

## Aktiv gefragt (2026-11-22)

Mit den Versuchen dieses Dienstes, jemand stand am Gerät. ebusd (Master `31`) hat 489 Werte gelesen, `40 22 xx` und `40 50 xx`
für alle 512 Kennungen abgetastet und einmal geschrieben. Keine CRC-Fehler, kein NAK. Software `S1.07.05 0004`,
`DipswitchValue` 22 (kennt die Definition nicht).

**Stufen.** Die Stufe der Anzeige steht spätestens eine Sekunde nach dem Tastendruck in `SwitchPosition`, `FanMode` und den
Soll-Luftmengen; die Lüfter brauchen dann noch eine Minute und länger.

| Stufe | `FanMode` | Soll-Luftmenge | `40 a0` | Einstellschritt |
|---|---|---|---|---|
| 0 (Feuchteschutz) | `Holiday` | 50 m³/h | `00 32 00 32` | 01 |
| 1 (reduziert) | `Reduced` | 100 m³/h | `00 64 00 64` | 02 |
| 2 (Nennlüftung) | `Normal` | 150 m³/h | `00 96 00 96` | 03 |
| 3 (intensiv) | `High` | 225 m³/h | `00 e1 00 e1` | 04 |
| Gerät aus | — | — | `00 00 00 00` | — |

Damit ist `40 a0` die Soll-Luftmenge, der nächste Rundruf trägt schon den neuen Wert. Von selbst sendet die CWL beim Stufenwechsel
sonst nichts. Welche der beiden Zahlen Zu- und welche Abluft ist, bleibt offen: Sie waren immer gleich.

**`SetFanMode` (`40 a1`) wirkt nicht.** Auf `31 3c 40 a1 04 00 03 00 03` (High) quittiert die CWL und antwortet `22 00`, ebusd
meldet `done`, aber Anzeige, `FanMode` und `40 a0` bleiben auf Stufe 0. Noch nicht probiert: `SetFanModeAlt` (`40 cb 01 01`),
laut Definition das, was das Brink-Bedienteil AirControl sendet.

**Filter quittieren** (Taste R 5 s): `FilterStatus` `yes` → `no`, `TotalFilterDays` 190 → 0, `TotalFilterFlow` 228 000 → 0 m³,
`FilterNotificationFlow` bleibt 324 000 m³. In `40 90` (`RequestErrorList`) wird das erste Byte von `07` zu `03`, vermutlich ist
Bit 2 die Filtermeldung. Die CWL antwortet auf `40 90` mit 18 Datenbytes, mehr als die 16 der Spezifikation; ebusd nimmt sie an.

**Einstellschritte in `40 50`.** Je Kennung fünf 16-Bit-Zahlen: Wert, Minimum, Maximum, Schrittweite, Werkseinstellung. Von `07`
bis `1a` gilt Kennung = Schritt − 3 (Schritte 10 bis 29 der Wolf-Anleitung). In dieselbe Reihe passen zwei Kennungen, die die
Definition nicht kennt: `05` (0–1, Werk 1) als Schritt 08 Kommunikation eBus/OpenTherm und `06` (0–9, Werk 0) als Schritt 09
Bus-Adresse. Beides Vermutungen nach Bereich und Reihe.

**Unbekannt, aber mit Wert** (bei Stufe 0): `40 22` `12`/`13` (je 32), `17` (3), `19` (0), `22`/`23` (38, 36), `24`/`25` (2440,
4130, vielleicht die Steuerspannung der Lüfter in mV), `40` (9); `40 50` `00` (9, Bereich 0–31), `1e`–`20` (0, vorzeichenbehaftet),
`26`–`2f` (0, Schrittweite 0), `3d`/`3e` (105, 102, Bereich 75–125, Werk 100, vielleicht ein Abgleich je Lüfter in %).

**Am Bus.** Beginnen ebusd und die CWL nach demselben SYN, stehen Bruchstücke wie `31 17 fe` am Bus; ebusd wiederholt, die CWL lässt
ihren Rundruf `40 a0` ausfallen. Fragt ebusd ohne Pause (eine Abfrage alle 150 ms), kommt über eine Minute lang kein `40 a0`. Bei
`40 50 2a`, `2c` und `2e` fehlte in der Antwort jedes Mal ein Byte `00`, ebusd meldete nach drei Versuchen `read timeout`; bei `2d`
einmal, die Wiederholung kam an. Alle innerhalb von 2 s.

**Lesen statt nur hören.** Die Werte (Lüftungsstufe, Temperaturen, Luftmengen, Bypass, Filter) fragt ebusd mit der Definition
`encon/3c..excellent` aus [ebusd-configuration](https://github.com/john30/ebusd-configuration) ab; dafür muss ebusd senden dürfen.
Diesen Dienst betrifft das nicht: Er zeigt dann zusätzlich die Anfragen von ebusd und die Antworten der CWL.
