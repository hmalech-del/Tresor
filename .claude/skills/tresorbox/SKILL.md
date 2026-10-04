---
name: tresorbox
description: Kontext für die Tresorbox (hardware/ im Repo hmalech-del/tresor) - eine 3D-gedruckte elektronische Lockbox aus PETG, die ein Servo (MG90S) über eine Kurbelschleife verriegelt und ein ESP32-DevKit per Bluetooth von der Tresor-App aufsperren lassen soll. Lade diesen Skill, sobald es um die Kiste geht - OpenSCAD-Modell, STL, Toleranzen, Prüfstück, Drucken, Einkaufsliste, Servo, Verdrahtung, ESP32-Board-Wahl, Firmware oder BLE-Handschlag - auch wenn der Nutzer nur "die Box", "das Schloss", "den Riegel", "das Prüfstück" oder "den Druck" sagt.
---

# Tresorbox

Eine gedruckte Kiste (PETG), die ein Servo verriegelt. Später soll die
Tresor-App sie per Bluetooth öffnen – erst, wenn der Tresor offen ist.

**Stand:** (26. 9.) Das **Prüfstück ist gedruckt**, Riegel und Zunge laufen
von Hand ordentlich (der Slicer hatte Stützen gesetzt, die der Nutzer
wegkratzen musste – keines der Teile braucht welche). Der kurze Riegel seines
Drucks ist noch der alte, am falschen Ende gekürzte: für den Servotest
`pruefriegel.stl` nachdrucken. **4. 10.: Servotasche neu konstruiert** nach am echten MG90S
gemessenen Maßen (Rumpf 22×12×22, Laschen 32 lang, Unterseite 17 über Boden,
2 dick; Welle 5 von der Kabelseite; Hornarm 18 lang, Arm-Unterseite 10,5 über
Gehäuse; Hornlöcher 3,5–16 mm, 7 Stück, 1 mm). Vorher schnitt der Rumpf die
Riegelbahn (Achse nur 7,7 mm neben der Riegelmitte). Jetzt: Stift im
äußersten Loch (r = 16), Schwenk ±23,4°, Achse 15,3 mm neben dem Riegel,
Zunge 23 mm tief (vorher 20), M2-Stift statt M3, Hornfreiraum als Fächer,
Kabelschlitz an der Wellenseite, Einlegerinne links der Zunge (vorher hätte sich der Riegel nie einsetzen lassen: Tunnel ab Blockende, nur 12 mm Platz), Prüfstück in voller Blockhöhe
(61×85×39 mm). Der Nutzer muss alles neu drucken; noch nicht gedruckt. Die große Kiste ist noch nicht gedruckt,
**Firmware gibt es keine**. Alles über die Mechanik hinaus ist ungetestet –
das in Antworten nicht verschweigen.

## Dateien (`hardware/`)

| Datei | Wofür |
|---|---|
| `tresorbox.scad` | das parametrische Modell; alle Maße oben als Variablen, `teil = koerper \| deckel \| riegel \| pruefstueck \| pruefriegel \| alles` |
| `pruefung.py` | rechnet die kritischen Beziehungen nach (Riegel durch Zunge und wieder frei, Stift/Schlitz in beiden Endlagen, Servo in der Wand, Platinensockel, Kabelloch, Nutzraum, STL-Aktualität, Zahl getrennter Teile je STL – das Prüfstück muss drei haben; einmal war die Zunge mit dem Block verschmolzen; Abstand Spitze→Querschlitz am kurzen Riegel gleich dem langen – er war einmal am falschen Ende gekürzt) |
| `kurbelschleife.py` → `.svg` | Zeichnung des Getriebes aus denselben Parametern |
| `kollision.scad` | Kollisionsfälle (Rumpf, Laschen, Arm, Stift gegen Körper/Riegel, beide Endlagen) und `fall="ansicht"` für `servo-sitz.png`; `pruefung.py` rendert sie (`--schnell` überspringt) |
| `servotest/servotest.ino` | Arduino-Testprogramm (ESP32Servo): Mitte/zu/auf (±23°), nachstellen, 20er-Dauertest, fährt langsam und macht `detach`. **Nicht die Firmware**, hier nie kompiliert (keine Toolchain erreichbar) |
| `*.stl`, `*.png` | fertige Druckdateien und Vorschaubilder |
| `README.md` | Nutzer-Doku: Funktionsweise, Einkaufszettel, Drucken, Zusammenbau, Verdrahtung, Toleranzen |

## Wie sie hält

Am Deckel hängt eine **Zunge** quer zur Fahrtrichtung; sie fällt in einen
Schlitz im Verschlussblock. Der **Riegel** (14 × 8 × 40 mm) fährt quer durch
diesen Schlitz und durch ein Loch in der Zunge. Zug am Deckel geht über
Zunge → Riegel → Bohrungswand in den Körper, **nicht ins Servo**.

Das Servo schiebt den Riegel über eine **Kurbelschleife** (scotch yoke): ein
M2-Stift im äußersten Loch des einarmigen Horns, 16 mm von der Achse, läuft in
einem Querschlitz des Riegels (7,6 mm lang). ±23,4° Schwenk → 12,7 mm Hub;
verriegelt steht die Spitze 3,5 mm hinter der Zunge, offen 3,2 mm davor. Das
Servo steht ganz neben dem Riegel (Achse 15,3 mm von der Riegelmitte), der
Hornarm greift 1,2 mm über dem Riegel hinüber. Nur zwei Endlagen, kein Gelenk.

## Toleranzen – getrennt nach Aufgabe

`spiel_riegel 0.35` (Gleitsitz), `spiel_decke 0.8` (Bohrungsdecke ist eine
Brücke und sackt), `spiel_zunge 0.5` (**führendes** Merkmal), `spiel_loch_y 1.0`
(quer stapeln sich Riegel- und Zungenspiel), `spiel_loch_z 0.5`,
`spiel_rand 0.8` (Deckelrand bewusst lose), `spiel_servo 0.5`. Grundsatz: nur
ein Merkmal führt, alle anderen sind lose. Das **Prüfstück** (61 × 85 × 39 mm, volle Blockhöhe mit ganzer Servotasche; drei getrennte Teile; die kurze Zunge hat eine Schulter, die sie auf Deckelhöhe hält, und steht beim Druck auf ihr;
~1 h) testet genau diese Passungen, gebaut aus denselben Modulen; die
Tabelle "Befund → Stellschraube" steht in der README.

## Zusammenbau in der fertigen Kiste (README "Zusammenbau")

Elektronik zuerst: Platine auf Sockel, USB durch rechte Wand, Servo in die
Tasche (Kabel in den Schlitz), Kabel über die Blockoberkante oder links vorbei
nach hinten, Testprogramm `m`. Dann Mechanik: Horn mit M2-Stift, Riegel in die
Rinne (Spitze in Mitte des Zungenschlitzes), Horn aufstecken (Stift in den
Querschlitz), Wellenschräubchen, erst von Hand, dann `z`/`a`/`d`, Deckel.

## Elektronik

- **ESP32 DevKitC** (WROOM-32, 30/38 Pin, Stiftleisten gelötet) – Vorgabe
  `platine = "devkit"`; `"supermini"` (ESP32-C3) ist der alternative Sockel.
  Kein ESP32-S2, kein ESP8266 (kein Bluetooth), kein WROOM-32U.
- **MG90S** (gemessen, siehe Stand; SG90 fast maßgleich, aber Plastikgetriebe).
  Wellenschräubchen fürs Horn ist Pflicht. Stift: M2 × 10–14, Hornloch auf
  1,6 mm aufbohren, schneidet selbst.
- Servo: braun → GND, rot → 5V/VIN, orange → **GPIO 18** (keine
  Strapping-Pins 0/2/12/15). **Elko 1000 µF** zwischen 5V und GND nah am Servo,
  sonst Brownout-Neustart beim Anfahren. Netzteil ≥ 1 A.
- Dupont **männlich/weiblich** (Servobuchse ↔ Boardpin); zwei w/w für den Elko.
- Platine auf 4-mm-Sockel, 28 mm Steckerraum, 12-mm-Kabelloch in der
  **rechten** Wand, Zugentlastung per Kabelbinder durch den Sockeltunnel.

## Geplante Firmware (noch nicht geschrieben)

BLE-Challenge-Response ohne Pairing: Schloss würfelt eine Nonce, App antwortet
mit `HMAC-SHA256(geheimnis, nonce)`, Schloss prüft und fährt 2 s auf, danach
`detach()` des Servos. Das Schlossgeheimnis wird ein **Fragment im Tresor** –
die App kann den Handschlag erst rechnen, wenn der Tresor offen ist. App-Seite
über Web Bluetooth (Android Chrome kann das; iOS Safari nicht).

## Arbeitsablauf bei Modelländerungen

```bash
cd hardware
python3 pruefung.py                       # nach JEDER Parameteränderung
openscad -D 'teil="koerper"' -o koerper.stl tresorbox.scad   # ebenso deckel, riegel, pruefstueck
xvfb-run -a openscad -D 'teil="pruefstueck"' --render --camera=0,0,0,50,0,210,0 --viewall --autocenter --imgsize=760,560 -o pruefstueck.png tresorbox.scad
python3 kurbelschleife.py                 # wenn Kurbel-Parameter sich ändern
```

- `pruefung.py` meldet STL als veraltet über **Dateizeiten**. Nach einem
  frischen Klon sagt das nichts – dann mit `git log` vergleichen, ob `.scad`
  nach den STL geändert wurde.
- OpenSCAD ordnet Dreiecke bei jedem Lauf anders. Nach reiner
  Kommentaränderung STL **nicht** neu einchecken: Geometrie vergleichen
  (`grep vertex x.stl | sort | md5sum` alt gegen neu), bei Gleichheit
  `git checkout -- *.stl && touch *.stl`.
- PNG-Export braucht `xvfb-run` (sonst "Can't create OpenGL OffscreenView").
  Die Kurbel-SVG als PNG ansehen: `cairosvg` oder Playwright-Screenshot –
  Chromium-CLI-Screenshots sind auf ~360 px begrenzt.
- Jede Maßänderung auch in `hardware/README.md` nachziehen (Einkaufszettel,
  Nutzraum, Hub). Die README-Zahlen stammen aus dem Modell, nicht umgekehrt.

## Was der Nutzer schon gefragt hat

Einkaufsliste und Bezugsquellen (DevKit statt C3-Supermini, zwei Boards),
worauf beim Board auf Amazon achten (Modulbeschriftung WROOM-32, Render mit
leerem Blech), was dem Servo beiliegen muss, wie aus Drehen Schieben wird
(Kurbelschleife), wo die Prüfstück-STL liegt (`hardware/pruefstueck.stl`).
Die Antworten stehen in `hardware/README.md` – dort nachsehen statt neu
herleiten.
