# Wolf CWL 300 Excellent am eBus

Was eine Wolf CWL 300 Excellent (baugleich Brink Renovent Excellent) ohne Bedienmodul auf den eBus sendet. Passiv mitgelesen am
2026-11-19 über einen ESERA-Koppler und ebusd `--readonly`, rund 45 Minuten. Die CWL ist der einzige Master am Bus.

| Telegramm | Ziel | Wie oft | Antwort | Bedeutung |
|---|---|---|---|---|
| `37 xx 40 a0 04 00 32 00 32` | `56`, `57`, … `5e` reihum | alle ~5 s, jede Adresse ~45 s | keine | Herstellerbefehl ENCON (`40`). Vermutung: die CWL verteilt als Kaskaden-Master ihren Sollwert an die möglichen Slaves 1 bis 9; ohne gekoppelte Geräte antwortet niemand. `00 32` ist 50, zweimal |
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

**Lesen statt nur hören.** Die Werte (Lüftungsstufe, Temperaturen, Luftmengen, Bypass, Filter) fragt ebusd mit der Definition
`encon/3c..excellent` aus [ebusd-configuration](https://github.com/john30/ebusd-configuration) ab; dafür muss ebusd senden dürfen.
Diesen Dienst betrifft das nicht: Er zeigt dann zusätzlich die Anfragen von ebusd und die Antworten der CWL.
