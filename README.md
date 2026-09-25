# 🔒 Tresor – ein Geheimnis auf Raten

Du gibst dem Tresor ein Geheimnis – eine Zahl oder ein Bild. Er zerlegt es
sofort in Fragmente, verschlüsselt jedes für sich und gibt sie nur Stück für
Stück wieder heraus – gegen Geduld, gegen Wartezeit und gegen echte Rechenzeit.

Alles läuft im Browser: keine Server, kein Konto, keine Übertragung.
Eine statische Seite, kein Build-Schritt, keine Abhängigkeiten.

Die Oberfläche hält sich an eine Tresortür-Palette: tiefes Stahlblau als Grund,
Neon-Cyan für alles Mechanische – Schlösser, Fortschritt, Knöpfe – und Gold
ausschließlich für das Geheimnis selbst, also für freigegebene Ziffern und das
fertige Ergebnis.

---

## Der Ablauf

1. **Geheimnis festlegen** – entweder eine **Zahl** (3 bis 8 Ziffern eintippen
   oder ein Foto der Zahl aufnehmen, die Ziffern werden erkannt und lassen sich
   korrigieren) oder ein **Bild**, das selbst das Geheimnis ist.
2. **Schwierigkeit wählen** – welche Dimensionen (Geduld, Zeit, Glück, Logik,
   Rätsel), wie intensiv, wie viele Aufgaben pro Fragment, wie viel Rechenzeit
   pro Zeitschloss, dazu Sicherheitsstufe, Strafzeiten, geheime Fristen und
   Notausgang.
   Die Seite zeigt laufend den voraussichtlichen Gesamtaufwand.
3. **Verriegeln** – die App schmiedet pro Ziffer ein Zeitschloss, verschlüsselt
   die Ziffer damit und wirft den Klartext weg.
4. **Freispielen** – pro Fragment erst die Aufgaben, dann die Rechenzeit.
   Jede gelöste Stufe legt genau eine Ziffer frei, an ihrer richtigen Stelle –
   oder beim Bild die nächste Schärfestufe.
5. **Verlauf** – geöffnete Tresore landen im Verlauf und bleiben dort abrufbar.

---

## Ein Bild als Geheimnis

Ein Bild lässt sich nicht in Ziffern zerlegen, wohl aber in Schärfestufen:
Stufe 1 ist ein grober Farbfleck, die letzte das ganze Bild. Jede Stufe ist ein
eigenes Fragment und wird für sich verschlüsselt, die Freigabe passiert also
schrittweise wie bei einer Zahl.

### Wo die vorletzte Stufe liegt

Zuerst liefen die Stufen geometrisch von 24 px bis zur vollen Breite. Das
klingt gleichmäßig, ist es aber nicht: Bei fünf Stufen lag die vorletzte schon
bei 37 % der Endbreite. Text ist nicht allmählich lesbar, sondern ab einer
Schwelle schlagartig – wer ein Foto einer Zahlenfolge einschloss, konnte sie
nach dem vierten von fünf Fragmenten entziffern. Das letzte Fragment war dann
geschenkt.

Die Stufen vor der letzten laufen jetzt nur bis zu einem einstellbaren Anteil
der Endbreite, und die letzte macht den Sprung auf das ganze Bild:

| Regler | vorletzte Stufe bei 1280 px | Reihe bei 5 Stufen |
|---|---|---|
| 1/3 | 427 px | 24 · 63 · 164 · 427 · 1280 |
| **1/8** (Vorgabe) | **160 px** | 24 · 45 · 85 · 160 · 1280 |
| 1/24 | 53 px | 24 · 31 · 41 · 53 · 1280 |

**Ein fester Wert löst das nicht**, und das ist keine Bequemlichkeit, sondern
Physik: Ob eine Stufe zu viel verrät, hängt daran, wie groß das Motiv im Bild
steht. Sechs Ziffern über die ganze Breite sind auch bei einem Achtel noch zu
lesen; ein Gesicht in einer Landschaft ist bei der Hälfte schon verschwunden.
Deshalb ein weiter Regelbereich statt eines gut gemeinten Festwerts.

### Die Lupe

Weil nur der Fotograf weiß, wie groß sein Motiv im Bild steht, muss er es
selbst beurteilen können. Jede Stufe in der Vorschau lässt sich antippen und
erscheint dann so groß, wie sie später im Tresor herauskommt – mit Blättern
zwischen den Stufen, Pfeiltasten und Escape. Die vorletzte ist in der Reihe
golden umrandet: Sie entscheidet, ob das letzte Fragment noch etwas wert ist.

Steht dort noch lesbar, was drauf steht, hilft entweder ein kleinerer Regler
oder ein Foto aus größerer Entfernung.

## Passphrase: der Schlüsselteil, der nirgends liegt

Optional lässt sich ein Tresor zusätzlich mit einer Passphrase verschließen.
Sie geht über PBKDF2 (400 000 Runden) in **jeden** Fragmentschlüssel ein – und
in den Notausgang, sonst wäre er die Hintertür:

```
passMaterial  = PBKDF2( "passphrase|" ‖ passphrase, passSalz, 400 000 )
schluessel_i  = SHA-256( "tresor-fragment" | i | b_i | material_i | passMaterial )
```

Damit ändert sich die Lage grundlegend: Ohne Passphrase nützt der Zugriff auf
den Browser-Speicher nichts mehr – auch nicht im Modus ohne Rechenzeit, wo
sonst alles offen danebenliegt. Gespeichert werden nur zwei Salze und ein
Prüfwert (mit eigenem Salz, damit er nichts über das Material verrät);
Durchprobieren kostet pro Versuch eine volle PBKDF2-Ableitung.

Die App fragt sie beim Öffnen des Tresors einmal pro Sitzung ab, merkt sich nur
das abgeleitete Material im Arbeitsspeicher und fragt nach jedem Neuladen
erneut. **In einer Sicherung steckt sie nicht** – ohne sie ist auch die Datei
wertlos. Und, in der Oberfläche genauso deutlich: Vergessen heißt verloren, da
hilft auch der Notausgang nicht.

---

## Drei Zeitschlösser

| Modus | Was die Fragmente schützt | Notausgang | Kosten |
|---|---|---|---|
| **eisern** (Standard) | Echte, nicht abkürzbare Rechenzeit je Fragment | zweites Zeitschloss, **Rechenzeit**, höchstens 1 Tag | ein Kern unter Volllast, Akku |
| **fern** | Das drand-Netz: vor der Freigabezeit öffnet ihn niemand | eigene Runde im Netz, **bis 28 Tage** | keine – aber Internet zum Öffnen |
| **nachsichtig** | Nichts – der Schlüsselanteil liegt offen daneben | **Wartezeit**, bis 28 Tage | keine |

Alle drei stellen den Notausgang über dieselben Felder ein. Rechenzeit über
einen Tag bietet die App nicht an: Das schafft kein Handy.

Im weniger sicheren Modus sind die Aufgaben reine Oberflächenhürden: Wer den
`localStorage` liest, kommt sofort an das Geheimnis. Dafür kostet nichts Strom,
und es gibt keine Wartezeit auf den Rechner. **Antwortgebundene Rätsel wirken
auch dort**, weil ihre Lösung in den Schlüssel eingeht – ein solcher Tresor mit
Logik- und Rätselaufgaben ist also nicht ganz ungeschützt.

Den **Notausgang gibt es in allen Modi**, denn er ist ein Sicherheitsnetz für
den Fall, dass man eine Aufgabe nicht packt – kein Bonus fürs Zeitschloss. Ohne
Rechenzeit hilft nur die Uhr: Er öffnet irgendwann zwischen den beiden von dir
gesetzten Grenzen, gezogen beim Verriegeln, und der Termin wird nicht angezeigt.
Anders als beim Zeitschloss steht er allerdings im Browser-Speicher – wie alles
in diesem Modus. Die Uhr läuft auch bei geschlossener App weiter und lässt sich
nicht durch Zurückstellen der Systemuhr austricksen.

---

## Erinnerungen – abschaltbar, und aus gutem Grund

Sperrfristen, Check-in-Fenster und Zeitfenster brauchen eigentlich eine
Erinnerung; ein Fenster, das man verpassen kann, ohne gestupst zu werden, ist
sonst eine Falle. Nur: Selbst daran denken zu müssen, kann genau der Punkt
sein. Deshalb ist es eine **Einstellung des Tresors**, nicht der App – sie wird
beim Verriegeln festgelegt und lässt sich danach nicht mehr ändern. Sonst
schaltete man sie genau dann ein, wenn es bequem wird. Voreinstellung: aus.

Erinnert wird an drei Dinge: eine abgelaufene Sperrfrist, ein geöffnetes
Check-in-Fenster (und zwei Minuten vor seinem Ende noch einmal, wenn es lang
genug ist) sowie den offenen Notausgang. An die geheime Höchstzeit wird
bewusst **nicht** erinnert – sie ist geheim.

Zwei Ehrlichkeiten:

* Die Erlaubnis erteilt der Browser, nicht die App. Beim Anhaken wird gefragt;
  lehnt der Browser ab, sagt die Oberfläche das und der Schalter springt
  zurück. Auf einem neuen Gerät (etwa nach einer Sicherung) fragt der Tresor
  erneut.
* Eine Web-Benachrichtigung kann nur verschickt werden, **solange die Seite
  läuft** – ein Hintergrund-Tab genügt, ein geschlossener Browser nicht. Ohne
  Server und Push geht das nicht anders, und die App behauptet auch nichts
  anderes.

Ist die Seite gerade sichtbar, wird nichts geschickt – die Oberfläche sagt es
ja selbst –, der Anlass aber als erledigt vermerkt, damit später keine
Nachzügler kommen.

---

## Sicherung: ausgelesen und wieder eingelesen

Ein Tresor lebt sonst ausschließlich im Browser-Speicher **dieses** Geräts.
Cache geleert, Browser gewechselt, Handy verloren – und das Geheimnis ist weg,
endgültig. Deshalb lässt sich der Tresor als Datei sichern und anderswo wieder
einlesen.

Gesichert wird der Tresor **wortgetreu**: Aufgaben samt ihren Parametern, die
Zeitschlösser, die Chiffrate, der Rechenfortschritt, laufende Sperrfristen und
Check-ins. Beim Einlesen wird nichts neu gewürfelt und nichts neu gewählt –
sonst könnte man sich beim Import einen bequemen Aufgabensatz bestellen und
wäre in einer Minute durch. Auf dem neuen Gerät geht es genau dort weiter, wo
man aufgehört hat; nur die Kalibrierung wird neu gemessen, weil sie
gerätespezifisch ist und ohnehin nur die Restzeitanzeige betrifft.

Drei Dinge sagt die App dabei offen:

* **Bereits geöffnete Fragmente stehen im Klartext in der Datei.** Eine
  Sicherung ist so geheim wie der Fortschritt, den sie enthält – wer nach dem
  dritten Fragment sichert, hat drei Ziffern in der Datei. Deshalb ist die
  Verschlüsselung mit Passphrase der Normalfall (AES-256-GCM, Schlüssel aus
  PBKDF2 mit 400 000 Runden). Ohne Passphrase geht es auch, mit Warnung.
* **Der Verlauf bleibt draußen**, außer man hakt es an – dort stehen fertige
  Geheimnisse im Klartext.
* **Die Datei lässt sich von Hand ändern.** Zeitschloss und antwortgebundene
  Aufgaben überstehen das (ohne Schlüsselmaterial keine Entschlüsselung), die
  übrigen Aufgaben nicht. Das gilt aber genauso für den Browser-Speicher – die
  Sicherung macht es nicht schlimmer. Die Prüfsumme fängt Übertragungsfehler,
  keine Absicht.

Beim Einlesen nennt die App, was in der Datei steckt (Art, Fortschritt, Datum)
und lässt bestätigen, bevor sie einen vorhandenen Tresor ersetzt.

---

## Verlauf

Ein geöffneter Tresor wandert in den Verlauf, sobald das letzte Fragment
aufgeht – noch bevor irgendetwas ihn überschreiben kann. Dort bleibt das
Ergebnis abrufbar: die Zahl im Klartext, beim Bild die schärfste freigegebene
Stufe samt Sicherungs-Link. Ein versehentlich geschlossener Tab, ein neuer
Tresor oder ein gelöschter Tresor nehmen es nicht mit.

Der Verlauf ist bewusst **unverschlüsselt** – der Tresor war ja offen, das
Geheimnis ist raus. Er hält die letzten zwölf Einträge; wird der Speicher eng,
fliegen die ältesten. Jeder Eintrag lässt sich einzeln löschen.

## Fern: das Zeitschloss im Netz

Rechenzeit hält nur, solange das Gerät rechnet – mit ausgeschaltetem
Bildschirm hört ein Browser auf. Für Tage und Wochen taugt das nicht.

[drand](https://drand.love) ist ein öffentliches Netz unabhängiger Betreiber
(u. a. Cloudflare, Protocol Labs, EPFL), das alle drei Sekunden eine Signatur
veröffentlicht. Mit **tlock** lässt sich auf eine *künftige* Signatur
verschlüsseln. Solange sie nicht existiert, öffnet es niemand – nicht die App,
nicht du, keine verstellte Geräteuhr. Das Gerät rechnet nicht, der Bildschirm
darf aus sein, die App geschlossen.

**Der Zeitrahmen.** Du gibst zwei Werte an: wann der Tresor *bestenfalls*
aufgeht und wann *ohne eine einzige Prüfung*. Die Uhr startet oben. Jede
gelöste Prüfung holt ein gleiches Stück zurück – wer alle löst, landet genau
unten. Jede verhauene schiebt die Freigabe nach hinten, um einen Anteil des
oberen Werts (mild 6 %, hart 15 %, jede Wiederholung das Anderthalbfache),
höchstens bis zum Notausgang. Mit Glücksspiel darf jede Strafe einmal
verwürfelt werden: 5–6 nimmt sie zurück, 1–4 streckt sie um die Hälfte.

**Der Takt.** Ab sechs Stunden unterer Grenze kommen die Prüfungen verteilt
statt alle auf einmal – sonst wäre ein Wochentresor ein Nachmittag Arbeit und
danach nur Warten. Verteilt wird über die untere Grenze: Wer jede löst, sobald
sie kommt, ist mit der letzten genau dort. Pünktlich heißt binnen eines Taktes,
mindestens aber binnen zwölf Stunden – eine Prüfung, die um drei Uhr nachts
kommt, verfällt nicht im Schlaf. Wer später löst, bekommt die halbe
Gutschrift. Darunter stehen alle Prüfungen sofort bereit.

**Über alle Fragmente hinweg.** Die Zeit hängt am ganzen Tresor, nicht an
einem Fragment. Die Prüfungen laufen deshalb in einer Reihe über alle
Fragmente, und zur Freigabe gehen alle Fragmente auf, deren Prüfungen erledigt
sind.

**Die Leiter.** Beim Verriegeln entsteht ein Zeitschlüssel `Z` für den ganzen
Tresor. Er wird auf eine Leiter künftiger Runden verschlossen, von der unteren
Grenze bis zum Notausgang (ohne Notausgang bis zum Zehnfachen des oberen Werts). Die
Sprossen liegen rund 5 % auseinander – bei einer Stunde drei Minuten, bei drei
Tagen dreieinhalb Stunden – und es sind höchstens 90, denn jede kostet beim
Verriegeln gut 50 ms (auf dem Handy mehr). Jedes Fragment braucht `Z` *und*
seine Antworten. `Z` selbst wird nicht gespeichert, erst nach dem Abholen –
dann ist die Signatur ohnehin öffentlich.

Was davon Kryptografie ist und was App-Logik:

| | durchgesetzt durch |
|---|---|
| **bestenfalls** zur unteren Grenze | das Netz – darunter gibt es keine Sprosse |
| **spätestens** zum Notausgang | das Netz – darüber gibt es keine Sprosse |
| jede Gutschrift und Strafe dazwischen | die App: Sie bietet nur die Sprosse an, auf die das Konto zeigt. Die anderen sind nicht gelöscht |

Was man dafür eintauscht:

* **Zum Öffnen braucht es Internet.** Zum Verschließen nicht – die Kettendaten
  (quicknet) sind fest eingetragen, nicht abgefragt.
* **Verschwindet das Netz vor dem Termin, ist das Geheimnis verloren.** drand
  läuft seit 2019. Für Wochen ist das Risiko gering, für ein Jahr würde ich es
  nicht eingehen.
* Früher öffnen könnte nur eine Mehrheit der Betreiber gemeinsam. Jede
  Signatur wird gegen den öffentlichen Schlüssel der Kette geprüft; ein
  manipulierter Spiegelserver kann keinen Schlüssel zu früh liefern, nur gar
  keinen.
* „Geheim" beim Notausgang verbirgt die Dauer nur in der Anzeige. Die Runde
  steht im Chiffrat selbst – ohne sie ließe er sich nicht öffnen.

Die Bibliothek ist [tlock-js](https://github.com/drand/tlock-js) 0.9.0 mit
`@noble/curves`, mit esbuild zu `js/vendor/tlock.min.js` gebündelt (168 KB,
gzip 58 KB). Wie sie neu gebaut wird, steht in `js/drand.js`. Geprüft ist das
Zusammenspiel gegen eine eigene Kette mit bekanntem Schlüssel; **das echte
Netz ist aus der Entwicklungsumgebung nicht erreichbar** – der erste
Durchlauf am echten Gerät ist der erste echte Test.

---

## Wie das Zeitschloss funktioniert

Der interessante Teil: Zeit lässt sich nicht durch Klicken überspringen.
Jedes Fragment steckt hinter einem **Time-Lock-Puzzle nach Rivest, Shamir und
Wagner**:

* Beim Verriegeln entstehen zwei 512-Bit-Primzahlen, `N = p · q` und ein
  Startwert `a`. Gesucht ist `b = a^(2^T) mod N`.
* Wer `φ(N)` kennt – und das tut nur die App im Moment des Verriegelns –
  rechnet `e = 2^T mod φ(N)` und daraus `b` in Millisekunden.
* Danach werden `p`, `q`, `φ(N)` und `b` verworfen. Gespeichert sind nur
  `N`, `a`, `T` und das Chiffrat.
* Wer die Ziffer will, muss `T`-mal **nacheinander** quadrieren. Das ist von
  Natur aus nicht parallelisierbar: mehr Kerne helfen nicht, nur verstrichene
  Rechenzeit. `T` wird beim Einrichten auf die gemessene Geschwindigkeit des
  Geräts geeicht (typisch einige hunderttausend Quadrierungen pro Sekunde).

Aus der Lösung `b` entsteht der AES-Schlüssel:
`Schlüssel_i = SHA-256("tresor-fragment|i|" ‖ b_i)`, die Ziffer liegt als
AES-256-GCM-Chiffrat daneben. Ein falsch geratener Schlüssel fällt durch das
GCM-Tag sofort auf.

Der Rechenfortschritt wird laufend gesichert: Tab schließen, später
weitermachen – die bereits verbrauchte Rechenzeit bleibt erhalten.

### Was das an Strom und Aufmerksamkeit kostet

Rechenzeit ist echte Rechenzeit, und das merkt das Gerät:

* Es läuft **ein** Rechenkern unter Volllast, in einem Web Worker. Die
  Oberfläche bleibt flüssig, andere Programme laufen normal weiter – aber der
  Kern ist belegt und das Gerät wird warm.
* Der **Tab muss offen bleiben**. Geschlossen steht die Rechnung; verloren geht
  nichts, aber es geht auch nichts voran.
* Die Schleife im Worker läuft **ohne Timer** durch. Das ist Absicht: Browser
  drosseln Timer in Hintergrund-Tabs teils auf einen Durchlauf pro Sekunde, was
  das Zeitschloss dort auf einen Bruchteil eingebremst hätte. Pausiert wird
  deshalb per `terminate`, fortgesetzt beim letzten gemeldeten Zwischenstand –
  verloren gehen höchstens rund 250 ms Rechnung.
* **Akku**, grobe Hausnummern und stark geräteabhängig: eine Minute ist kaum
  spürbar, 30 Minuten kosten am Handy etwa zehn bis fünfundzwanzig Prozent,
  acht Stunden mehr als eine volle Ladung. Die Einrichtung schreibt das bei
  jeder Stufe dazu, statt nur „30 min Rechenzeit" anzuzeigen.
* Für den Notausgang mit Spanne heißt das: Die Obergrenze ist auch die
  Obergrenze des Aufwands – gerechnet wird aber oft weniger, weil die gezogene
  Dauer irgendwo dazwischen liegt.
* Ein Schalter in der Rechenansicht hält den **Bildschirm wach** (Wake Lock),
  damit das Handy nicht mitten in der Rechnung einschläft – als Schalter, weil
  der Bildschirm selbst Strom zieht.

Praktisch heißt das: **kurze Rechenzeit pro Fragment** (10–45 s) als
kryptografisch bindende Hürde, **lange Wartezeiten über Sperrfristen**, die
nichts kosten, und den teuren Notausgang als das, was er ist – eine Reserve,
die man in Etappen abarbeitet und hoffentlich nie braucht.

## Antwortgebundene Aufgaben

Logik- und Rätselaufgaben sind mehr als Bedienoberfläche: ihre Lösung wird beim
Verriegeln **nicht gespeichert**, sondern in den Schlüssel gerechnet.

```
material_i    = PBKDF2-SHA256( antworten_i, salz_i, 400 000 Runden )
schluessel_i  = SHA-256( "tresor-fragment" | i | b_i | material_i )
```

Gespeichert wird pro Aufgabe nur ein Prüfwert mit **eigenem Salz**, damit die
Eingabe sofort Rückmeldung bekommt, ohne das Schlüsselmaterial zu verraten. Ein
Rateversuch kostet dadurch eine volle PBKDF2-Ableitung (rund 0,3 s), und die
Ratebereiche aller gebundenen Aufgaben eines Fragments multiplizieren sich.

Die Antworten liegen im Klartext nur solange im Speicher, wie das Fragment in
Arbeit ist; sobald es sich öffnet, werden sie durch ein `true` ersetzt.

### Was das schützt – und was nicht

* **Echt** ist die Rechenzeit. Sie kostet jeden gleich viel, auch jemanden mit
  dem Entwicklerwerkzeug im Browser.
* **Teuer, aber nicht unmöglich** ist das Erraten gebundener Antworten. Der
  Haken: Die Rätsel sind für Menschen gemacht, und ein Programm *löst* die
  meisten davon schneller, als es sie erraten würde – eine Verschiebechiffre
  mit Wörterbuch in Millisekunden. Die Bindung hebt die Untergrenze gegen
  Durchprobieren, ersetzt aber kein Passwort.
* **Mastermind ist nicht gebunden**: Für die Rückmeldung muss der Code zur
  Laufzeit bekannt sein, steht also im Speicher. Im Fahrplan sind gebundene
  Aufgaben mit 🔑 markiert.
* **Nicht kryptografisch** sind Geduld, Glück, Sperrfristen, Strafzeiten und
  geheime Fristen: Sie sind Bedienoberfläche. Wer `localStorage` liest und
  selbst rechnet, kann sie überspringen. Gegen Zurückstellen der Systemuhr
  wehrt sich die Sperrfrist, mehr aber nicht.
* Der Tresor ist ein Selbstbindungs-Werkzeug, kein Schutz gegen Angreifer mit
  Zugriff auf das Gerät. **Löschen heißt löschen** – ohne Zeitschloss-Lösung
  und ohne Antworten gibt es keinen Ersatzweg zur Zahl.

---

## Dimensionen und Aufgaben

Jede Dimension lässt sich einzeln zuschalten und in fünf Intensitätsstufen
regeln. Die Stufen steuern Dauer, Toleranz und Anzahl; die letzten beiden
Fragmente werden automatisch eine Stufe härter.

**Wie die Aufgaben verteilt werden:** Ein Tresor hat so viele Fragmente wie das
Geheimnis Teile hat – bei fünf Ziffern also fünf. Jedes Fragment bekommt
`Aufgaben pro Fragment` Stück, zusammen sind das die verfügbaren
*Aufgabenplätze*. Gezogen wird reihum über die gewählten Dimensionen: Bei zwei
Dimensionen wechseln sie sich ab, bei einer kommen lauter Aufgaben aus ihr.
Gibt es mehr Dimensionen als Plätze – sechs Dimensionen bei fünf Fragmenten mit
je einer Aufgabe –, bleibt entsprechend viel außen vor. Die Einrichtung rechnet
das vor und nennt die Zahl der Aufgaben je Fragment, mit der alle drankommen.
Welche Dimension in so einem Fall ausfällt, entscheidet der Zufall: Die
Reihenfolge wird je Tresor gemischt, damit es nicht immer dieselbe trifft.

### Geduld

| Aufgabe | Worum es geht |
|---|---|
| **Stillhalten** | Knopf gedrückt halten, Loslassen setzt zurück |
| **Nichts tun** | Nicht tippen, nicht scrollen – jede Berührung setzt zurück. Geht der Bildschirm aus oder wechselst du die App, **pausiert** die Uhr, statt abzubrechen |
| **Atemtakt** | Dem Atemrhythmus folgen und an jedem Wendepunkt tippen |
| **Wachbleiben** | Auf unregelmäßige Signale innerhalb eines kurzen Fensters reagieren |
| **Gleichmaß** | Einen Regler in vorgegebener Zeit gleichmäßig durchschieben – Sollfenster und Statusanzeige liegen *über* dem Regler, damit der Daumen sie nicht verdeckt |
| **Zeitgefühl** | Eine Dauer ohne Uhr auf wenige Prozent genau schätzen |

### Zeit

| Aufgabe | Worum es geht |
|---|---|
| **Sperrfrist** | Feste Wartezeit von Minuten bis Stunden, App darf zu sein |
| **Zeitfenster** | Nur zu einer bestimmten Tageszeit zu öffnen (ab Intensität 3) |
| **Rückmeldungen** | Mehrmals vorbeischauen – frühestens nach dem Mindestabstand und dann **innerhalb eines Fensters**. Wer zu spät kommt, dessen Besuch zählt nicht: Der Abstand beginnt von vorn, dazu gibt es Strafzeit. Das Fenster wird mit der Intensität enger (Stufe 1: das 1,5-Fache des Abstands, Stufe 5: ein Viertel davon) |
| **Zeitschloss** | Die echte Rechenarbeit – immer die letzte Hürde vor der Ziffer |

### Glück

Können hilft hier nichts – nur Aushalten. Zusammen mit Strafzeiten wird daraus
eine Geduldsprobe mit offenem Ausgang.

| Aufgabe | Worum es geht |
|---|---|
| **Würfelserie** | Mehrere hohe Würfe hintereinander, ein schlechter reißt die Serie |
| **Münzserie** | Mehrere Münzwürfe in Folge richtig raten |
| **Ziehung** | Unter verdeckten Karten die richtige finden, danach wird neu gemischt |
| **Glücksrad** | Drehen, bis genau das eine freigebende Feld kommt |

### Logik

| Aufgabe | Worum es geht | 🔑 |
|---|---|---|
| **Zahlenfolge** | Die Folge um ein Glied weiterführen | ja |
| **Lügner** | Wer sagt die Wahrheit? Eine Zählaussage bricht die Symmetrie | ja |
| **Waage** | Aus Gleichungen einen Wert erschließen, Antwort immer zweistellig | ja |
| **Mastermind** | Zahlencode aus ●/○-Rückmeldungen erschließen | nein |

### Rätsel

| Aufgabe | Worum es geht | 🔑 |
|---|---|---|
| **Verschiebechiffre** | Ein verschobenes Wort zurückdrehen | ja |
| **Morsezeichen** | Ein gemorstes Wort entziffern, Tabelle bis Intensität 3 | ja |
| **Anagramm** | Buchstabensalat entwirren | ja |
| **Zahlenrätsel** | Die einzige Zahl finden, auf die alle Bedingungen passen | ja |

Lügner, Waage und Zahlenrätsel werden so lange neu gewürfelt, bis das Rätsel
nachweislich **eindeutig** ist – bei Lügner und Waage per Durchprobieren aller
Belegungen, beim Zahlenrätsel durch Sammeln von Bedingungen, bis genau ein
Kandidat übrig bleibt.

### Konzentration

Nichts davon ist schwer – aber nebenbei geht es nicht.

| Aufgabe | Worum es geht |
|---|---|
| **Tonfolge** | Simon: eine mit jeder Runde wachsende Folge nachtippen |
| **N-Back** | Im Buchstabenstrom erkennen, wenn sich etwas nach n Schritten wiederholt |
| **Stroop** | Die Schriftfarbe antippen, nicht das Wort |
| **Zahlenjagd** | Schulte-Tabelle: 1 bis n² der Reihe nach finden, gegen die Uhr |

### Sensoren

Optional, und nur wenn das Gerät sie wirklich hat. Der Schalter steht in der
Feineinstellung und lässt sich gar nicht erst setzen, wenn beim Einrichten
keine Messwerte ankommen. Die Aufgaben mischen sich dann in die Töpfe von
Konzentration und Geduld.

| Aufgabe | Dimension | Worum es geht |
|---|---|---|
| **Wasserwaage** | Konzentration | Das Gerät waagerecht halten; die Libelle darf nicht ausschlagen |
| **Lagenfolge** | Konzentration | Das Gerät der Reihe nach in vorgegebene Lagen bringen und jede kurz halten |
| **Schritte** | Geduld | Eine Strecke zu Fuß gehen; gezählt wird der Takt der Bewegung |
| **Ruhige Hand** | Geduld | Das Gerät in der Hand halten und ruhig bleiben – abgelegt zählt nicht |

Zur ruhigen Hand siehe [Toleranz messen statt raten](#toleranz-messen-statt-raten).

Details – warum das an die Fähigkeit und nicht an das Gerät gebunden ist, und
was passiert, wenn der Sensor fehlt – stehen unter
[Sensoraufgaben und der Ersatzweg](#sensoraufgaben-und-der-ersatzweg).

### Probelauf

Ob eine Übung zu schaffen ist, zeigt sich erst beim Spielen – und dann steht
der Tresor schon zu. Der Knopf „Prüfungen ausprobieren" am Fuß der Einrichtung
führt auf einen Bildschirm, der jede Prüfung einzeln startet, in jeder
Intensität, ohne Folgen: kein Tresor wird angefasst, nichts gespeichert, keine
Strafe droht.

Je Prüfung ein Regler für die Intensität, darunter die gezogenen Parameter und
die Schätzung. Nach einem Lauf meldet der Bericht, **wie lange du wirklich
gebraucht hast, was geschätzt war und wie oft es danebenging** – genau die drei
Zahlen, um die es bei der Frage „ist das fair?" geht.

Drei Anpassungen machen den Modus erst brauchbar:

* **Wartezeiten sind auf 45 Sekunden gestaucht.** Niemand testet eine
  zwölfstündige Sperrfrist in Echtzeit. Dafür dient das Budget, das
  `erzeuge(zufall, stufe, budget)` ohnehin kennt.
* **Gebundene Rätsel zeigen ihre Lösung auf Knopfdruck.** Hier geht es um
  Spielbarkeit, nicht ums Bestehen.
* **Bei Stationen zählt jede lesbare Marke.** Es gibt noch keine richtige – die
  Frage ist, ob das Gerät überhaupt NFC liest. Dafür wird ein Markenvorrat
  vorgetäuscht, der beim Verlassen wieder geleert wird, damit der nächste
  Tresor nicht auf Marken baut, die es nicht gibt.
* **Der Ersatzweg hält sich heraus** (`kontext.probe`). Wer eine Sensoraufgabe
  testen will, hat den Sensor oder nicht; zehn Minuten Rechnen beantworten die
  Frage nicht.

Die Ruhige Hand war zu streng, die Schritte hatten zu wenig Zeit – beides wäre
hier in zwei Minuten aufgefallen statt in einem verriegelten Tresor.

### Eine eigene Aufgabe hinzufügen

Alle sechs Dimensionen sind besetzt; weitere Aufgaben brauchen nur ein Objekt
mit vier Funktionen und einen `registrieren(...)`-Aufruf – gebundene Aufgaben
liefern zusätzlich `loesung` und `normalisiere`, der Tresor streicht die Lösung
vor dem Speichern:

```js
registrieren({
  id: 'mastermind',
  dimension: 'logik',
  name: 'Mastermind',
  kurz: 'Code aus Rückmeldungen erschließen',
  erzeuge: function (zufall, stufe) { return { … }; },   // jedes Mal andere Parameter
  schaetzung: function (params) { return 120; },          // Sekunden, für die Vorschau
  beschreibe: function (params) { return '…'; },          // Zeile im Fahrplan
  starte: function (kontext) { /* Oberfläche bauen */ return aufraeumen; }
});
```

Mehr muss der Tresor nicht wissen – Auswahl, Fahrplan, Fortschritt und
Speicherung laufen über die Registry.

---

## Sensoraufgaben und der Ersatzweg

### Was der Browser hergibt

| | Android (Chrome) | iPhone (Safari) |
|---|---|---|
| Neigung (`DeviceOrientationEvent`) | sofort, ohne Dialog | erst nach `requestPermission()` |
| Bewegung (`DeviceMotionEvent`) | sofort, ohne Dialog | erst nach `requestPermission()` |
| Schrittzähler | gibt es nicht | gibt es nicht |
| Luftdruck / Höhe | gibt es nicht | gibt es nicht |
| Voraussetzung | **HTTPS** | **HTTPS** |

Zwei Fallen stecken darin. Erstens liefert `file://` oder einfaches `http://`
gar nichts – über GitHub Pages läuft es, beim lokalen Öffnen der Datei nicht.
Zweitens verlangt iOS ab 13 eine Freigabe, die **aus einer echten Nutzergeste
heraus** angefordert werden muss; deshalb gibt es dort einen Knopf
„Sensor freigeben“ statt einer Abfrage beim Laden.

Und die wichtigste Falle: `'DeviceOrientationEvent' in window` ist auch im
Desktop-Chrome wahr. Die Schnittstelle existiert dort, es feuert nur nie ein
Ereignis. Geprüft wird deshalb nicht, ob es die Schnittstelle gibt, sondern ob
innerhalb von 1,6 Sekunden echte Messwerte ankommen.

### Gebunden an die Fähigkeit, nicht an das Gerät

Naheliegend wäre, einen Tresor mit Sensoraufgaben an *dieses eine Gerät* zu
binden. Das hält aber nicht: Ein Browser hat keine stabile Geräte-Kennung. Eine
Zufallsmarke im `localStorage` läge genau dort, wo auch der Tresor liegt – beim
Löschen der Browserdaten oder beim Neuaufsetzen des Handys wäre sie mit weg,
und das eigene Gerät würde die eigene Sicherung abweisen. Genau im
Katastrophenfall, für den die Sicherung da ist. Fingerprinting über
User-Agent, Bildschirm oder Canvas driftet mit jedem Browser-Update.

Die brauchbare Frage ist nicht „ist es dasselbe Gerät?“, sondern „hat dieses
Gerät den Sensor?“. Das ist direkt prüfbar. Ein Import auf einem anderen
Android läuft damit ganz normal weiter; eine Sicherung auf einem Laptop
dagegen landet im Ersatzweg.

### Der Ersatzweg

Fehlt der Sensor – Desktop, oder auf dem iPhone abgelehnte Freigabe –, wird
die Aufgabe nicht übersprungen, sondern durch Aufwand ersetzt:

* **Mit Rechenzeit**: ein Zeitschloss über das Vielfache der Aufgabendauer,
  je nach Intensität das 6- bis 20-fache, mindestens 5 Minuten, höchstens
  2 Stunden. Es wird erst zur Laufzeit geschmiedet – beim Verriegeln steht ja
  noch nicht fest, auf welchem Gerät die Aufgabe einmal landet. Der
  Zwischenstand überlebt einen Neustart.
* **Ohne Rechenzeit**: dieselbe Spanne als Wartezeit. Schwächer, weil die
  Geräteuhr sich vorstellen lässt – in diesem Modus hängt aber ohnehin alles
  an der Uhr.

Warum so teuer? Weil der Ersatzweg sonst die bequemste Abkürzung wäre: einfach
auf dem Laptop importieren und alle Sensoraufgaben abwinken. Aus demselben
Grund gilt eine abgelehnte iOS-Freigabe als „kein Sensor“ – sonst wäre der
Ablehnen-Knopf im Systemdialog der Überspringen-Knopf. Einmal begonnen, bleibt
es beim Ersatzweg; sonst könnte man ihn als Reserve nebenherlaufen lassen.

Beim Einlesen einer Sicherung prüft die App vorher, ob noch offene
Sensoraufgaben drinstehen, und sagt im Bestätigungsdialog, was das auf diesem
Gerät kosten würde.

### Toleranz messen statt raten

Die ruhige Hand unterscheidet Tisch, Hand und Bewegung an der Streuung der
Beschleunigung über ein gleitendes Fenster von 1,5 s. Der erste Entwurf setzte
dafür feste Absolutwerte – und war auf echter Hardware zu streng. Vier Ursachen,
vier Korrekturen:

**Der Drift-Bezug fror beim ersten Messwert ein.** Ein Arm sinkt über Minuten
ab, ohne dass das eine Bewegung wäre; nach zwei Minuten waren die erlaubten 22°
unvermeidlich überschritten. Der Bezug zieht jetzt langsam nach (Zeitkonstante
rund 4 s), die Grenze liegt bei 35°. Langsames Absinken ist erlaubt, ruckartiges
Umgreifen nicht – dafür ist es zu schnell, als dass der Bezug mitkäme.

**Feste Obergrenzen treffen nicht.** Wie stark ein Gerät rauscht und wie ruhig
eine Hand ist, geht weit auseinander. Die ersten vier Sekunden messen deshalb,
wie ruhig *diese* Hand auf *diesem* Gerät ist, und setzen die Grenze auf das
2,2-Fache davon (Median, damit ein einzelnes Zucken sie nicht verschiebt). Sie
kann dabei nur steigen, nie unter die Vorgabe fallen.

Der Deckel dafür muss **absolut** sein, nicht nur relativ: Im ersten Anlauf
durfte die Grenze auf das Vierfache der Vorgabe steigen, und dann ging
Herumlaufen als ruhige Hand durch – der Test hat genau das gezeigt. Über 1,3
ist es Bewegung, wie auch immer eingemessen wurde.

**Kein Flackern an der Grenze.** Wer drin ist, bleibt drin, bis er das
1,4-Fache der Grenze überschreitet. Ohne diese Hysterese kippt der Zustand
genau an der Kante hin und her, und das fühlt sich unfair an – zu Recht.

**Schonzeit statt Sofortstrafe.** Ein kurzer Ausschlag kostet nichts; erst nach
0,6 s außerhalb läuft der Fortschritt zurück, und zwar einfach statt doppelt so
schnell. Gehaltene Zeit überlebt außerdem einen Neustart, wie bei den Schritten.

Der aktuelle Messwert steht als Zahl unter der Skala („Ruhe 0,28 von höchstens
0,90"), damit sich Klagen über Strenge nachrechnen lassen statt schätzen.

### Teilfortschritt und die geheime Frist

Gegangene Schritte überleben einen Neustart. Sie wurden ja wirklich gegangen –
bei 700 Schritten wäre ein verlorener Tab sonst eine Strafe für nichts.
Abgelegt wird der Stand unter `zustand.stand`; das ist die Abmachung für alle
Aufgaben mit Teilfortschritt. `kontext.fehlschlag` löscht diesen Schlüssel,
denn genau das ist die Strafe: Läuft die geheime Frist ab, sind die Schritte
weg.

Die Schätzung liegt bei **0,8 s je Schritt plus 45 s Anlauf**. Sie war anfangs
0,7 s plus 30 s, was rechnerisch aufging, aber zu knapp war: Bei 100 Schritten
pro Minute sind 0,6 s echte Gehzeit, doch der Taktfilter verwirft drinnen bei
vielen Kehren bis zu einem Fünftel – dann sind es effektiv 0,75 s, und der
Anlauf (aufstehen, hinausgehen) fehlte ganz.

Gegen die kürzestmögliche Frist (Faktor 1,2×) gerechnet, im ungünstigsten Fall
(oberer Jitter, drinnen, 20 % verworfen, gemütliches Tempo):

| Stufe | Schritte | Mindestfrist | schlimmster Fall | Reserve |
|---|---|---|---|---|
| 1 | 46 | 98 s | 50 s | 49 % |
| 2 | 103 | 152 s | 92 s | 39 % |
| 3 | 207 | 253 s | 170 s | 33 % |
| 4 | 402 | 440 s | 317 s | 28 % |
| 5 | 805 | 827 s | 619 s | 25 % |

Vorher schrumpfte die Reserve von 32 % auf 13 %, weil der feste Anlauf mit
steigender Schrittzahl relativ verschwindet. Jetzt bleibt sie über alle Stufen
bei mindestens einem Viertel.

Die Frist läuft in **echter Zeit**, der Zähler dagegen nur bei sichtbarem
Bildschirm. Deshalb sagt die Aufgabe ausdrücklich „Bildschirm an, Gerät in der
Hand" – in der Tasche zählt nichts mit, die Frist aber schon.

### Was der Schrittzähler kann und was nicht

Es gibt keine Schrittzähler-Schnittstelle im Browser, auf keiner der beiden
Plattformen. Gezählt wird deshalb selbst: Die Länge des
Beschleunigungsvektors bekommt einen Tiefpass, jeder Ausschlag darüber ist ein
Kandidat. Damit Schütteln nicht zählt, muss der Takt stimmen – Ausschläge unter
260 ms Abstand zählen nicht und verschieben trotzdem den Bezugspunkt (sonst
wäre schnelles Wedeln billiger als Gehen), und eine Folge mit zu
ungleichmäßigem Rhythmus zählt gar nicht.

Gemessen an synthetischen Taktmustern: gleichmäßige 500 ms zählen vollständig,
ein unruhiger Takt zwischen 280 und 1400 ms kommt auf 2 von 14, Wedeln im
120-ms-Takt auf 0. Wasserdicht ist das nicht – wer lange genug gleichmäßig
wedelt, kommt durch. Das ist eine Anstrengungsaufgabe, keine
kryptografische Grenze; wie alle Aufgaben außer den antwortgebundenen wird sie
von der App durchgesetzt, nicht vom Schlüssel.

### Höhenänderung, und warum sie fehlt

Es gibt keinen Zugriff auf das Barometer – weder auf Android noch auf iOS.
Höhe liefert allein `navigator.geolocation` als `coords.altitude`, und die
stammt aus dem GPS: ±10 bis 30 Meter, drinnen gar nichts, dazu eine eigene
Standortfreigabe. Eine Aufgabe „steig drei Stockwerke“ würde häufiger falsch
als richtig messen. Waagerechte Strecke wäre deutlich genauer (±5 bis 10 m),
bliebe aber eine reine Draußen-Aufgabe.

## Stationen: NFC-Marken als Suchspiel

Eine Aufgabe, die weder Zeit noch Konzentration kostet, sondern **Weg**.
NFC-Marken kosten im Zehnerpack ein paar Euro, also verteilt man sie in der
Wohnung: hinter dem Bücherregal, im Keller, unter der Fensterbank. Beim
Einrichten bekommt jede Marke ein eigenes Zufallsgeheimnis, und jedes Fragment
wird an genau eine davon gebunden – an welche, sagt die App nicht. Das Suchen
ist die Aufgabe.

Die Dimension heißt **Ort**, der Aufgabentyp **Station**.

### Wie es gebunden ist

Kryptografisch ist eine Station dasselbe wie eine Rätselantwort: Das Geheimnis
der Marke geht über PBKDF2 in den Fragmentschlüssel ein, gespeichert wird nur
ein Prüfwert. Ohne die richtige Marke gibt es den Schlüssel nicht – das ist
keine Oberflächenhürde, die sich mit dem Entwicklerwerkzeug wegklicken ließe.

Die Geheimnisse gehen dabei **nie durch die Konfiguration**. Die landet im
Tresor und damit im Browser-Speicher; die Geheimnisse sind der Schlüssel. Sie
liegen während des Einrichtens in einem Modulvorrat (`js/aufgaben-ort.js`),
gehen als `params.loesung` in den Aufgabenplan, der sie nach dem Hashen selbst
wieder löscht, und werden nach dem Verriegeln geleert. Nachgemessen: Nach dem
Verriegeln steht keines der fünf Geheimnisse im `localStorage`.

### Falsche Marken kosten nichts

Bewusst kein Fehlversuch. Das Abklappern **ist** der Weg, nicht der Fehler –
eine Strafe für jede falsche Marke würde das Suchspiel in ein Ratespiel
verwandeln, bei dem Herumlaufen bestraft wird. Gezählt wird trotzdem, damit
man sieht, wie weit man ist: „3 Marken abgeklappert, keine davon war es.“

Der Reiz wächst mit der Zahl der Fragmente: Jedes hängt an einer eigenen,
zufällig gezogenen Station, also läuft man dieselben Orte in einer Reihenfolge
ab, die man nicht vorhersehen kann.

### Was das schützt – und was nicht

* Ein NDEF-Satz lässt sich von **jeder** NFC-App auslesen. Wer eine Marke in
  die Hand bekommt, hat ihr Geheimnis. Das hält den eigenen Impuls auf und
  Gelegenheitszugriff, nicht jemanden, der sich bei dir umsehen darf.
* Wer alle Marken in eine Schublade legt, hat das Suchspiel abgeschafft. Die
  App kann das nicht verhindern – der Tresor ist so stark wie deine Disziplin
  darüber, wo die Marken liegen.
* Nach einer gefundenen Station liegt deren Geheimnis bis zum Öffnen des
  Fragments in `zustand.antwort`. Das ist bei allen antwortgebundenen Aufgaben
  so und unvermeidlich: Der Schlüssel wird erst gebraucht, wenn der Bann fällt,
  und bis dahin muss die Antwort einen Neustart überleben.
* Eine überschriebene oder verlegte Marke macht ihr Fragment nur noch über den
  Notausgang erreichbar.

### Reichweite

Web NFC gibt es **nur in Chrome auf Android** – Safari kennt es nicht,
Desktop-Chrome auch nicht. Anders als bei den Lagesensoren ist die Prüfung
ehrlich einfach: Wo `NDEFReader` fehlt, fehlt die Fähigkeit wirklich; es gibt
keinen Fall, in dem die Schnittstelle da ist und trotzdem nie etwas ankommt.
Fehlt sie, greift derselbe [Ersatzweg](#der-ersatzweg) wie bei den
Sensoraufgaben.

**Ungetestet auf echter Hardware.** Alles außer der Funkschicht ist geprüft –
mit einem gefälschten `NDEFReader` im Test. Der erste Lauf mit echten Marken
auf einem echten Android steht noch aus.

## Was auf den Bildschirm gehört

Verlauf, Sicherung, Löschen und das technische Innenleben sind Verwaltung. Sie
müssen erreichbar sein, aber sie gehören nicht in den Weg: Auf dem Bildschirm,
auf dem man eine Prüfung ablegt, ist jede Karte, die nichts mit ihr zu tun hat,
Lärm. Sie liegen deshalb in einer einzigen zugeklappten Lade („verwaltung") am
Fuß der Seite.

Übrig bleiben drei Karten: das Band mit dem, was schon frei ist, die aktuelle
Prüfung, der Notausgang. Unter „meinen Regeln" fällt der Fahrplan ganz weg –
auch keine leere Karte, die daran erinnert. Was es nicht gibt, soll auch
keinen Platz belegen.

Der Einrichtungsbildschirm bleibt, wie er ist: Dort ist Konfigurieren die
Aufgabe, und die Sicherung einzulesen ist der Weg zurück, wenn ein Tresor
verloren ging.

## Der Ton

Die Oberfläche bedient niemanden. Sie gehört einem **Game Master**, der die
Regeln aufstellt, misst und urteilt; der Nutzer ist ein Spieler in seiner
Prüfung, kein Kunde. Alle Sätze, die im Ablauf erscheinen, stehen in
`js/stimme.js` – nicht verstreut in der Zustandslogik.

Leitplanken für neue Sätze:

* Von oben herab, aber stilvoll. Harter Lehrmeister, kein Schläger.
* Kein Lob über „ausreichend" hinaus. Ein Sieg ist das erwartete Minimum.
* Kein Mitleid, keine Hilfe, keine Motivationsfloskeln („Du schaffst das!").
* Keine Verhandlung. Die Zeit ist das Gesetz.
* **Kurz.** Wer erklärt, rechtfertigt sich. Das ist der häufigste Fehler: Ein
  Satz, der begründet, warum eine Regel gilt, nimmt ihr die Autorität.

Begriffe, die nach Innenleben klingen, heißen in der Oberfläche anders: Das
Zeitschloss ist der **Bann**, die Strafzeit die **Strafe**, Aufgaben sind
**Prüfungen**. Quadrierungen, PBKDF2 und AES stehen weiterhin da, aber
zugeklappt hinter „Was dahintersteckt". Diese README bleibt davon unberührt;
sie ist für Entwickler und darf erklären.

## Meine Regeln

Der harte Modus. Er hieß zuerst „Blindgang" – ein schlechtes Wort, weil es auf
Deutsch auch die Fehlzündung meint. Der Game Master spricht in der ersten
Person, also heißt der Modus, was er ist: **seine** Regeln. Der Schlüssel in
der Konfiguration bleibt `blind`; der beschreibt die Mechanik.

Der harte Modus. Du setzt genau einen Wert: den Notausgang. Alles andere zieht
der Wächter selbst – wie viele Aufgaben je Fragment, aus welchen Dimensionen,
mit welcher Intensität, welche Strafen, ob eine geheime Frist läuft. Und er
zeigt es nicht: kein Fahrplan, keine Schätzung, keine Anzahl. Du siehst immer
nur die Aufgabe, die gerade vor dir liegt.

Gezogen wird mit `crypto.getRandomValues`, nicht mit dem Saat-Strom des
Tresors. Das ist wichtig: Die Saat liegt gespeichert im Tresor, aus ihr ließe
sich der ganze Plan nachrechnen. Strafen sind immer an, das Glücksspiel ist immer an. Ob das Gerät dafür
stundenlang rechnen soll, bleibt dagegen eine eigene Entscheidung: Härte und
Ungewissheit sind zwei verschiedene Dinge, und der Akku ist ein echtes
Argument. In der Karte steht deshalb ein Schalter „ohne Rechenzeit".

### Das Mahlwerk

Wenn keine Zahl verrät, wie weit der Bann ist, bleibt die Frage, ob überhaupt
etwas passiert. Ungewissheit heißt nicht, dass man im Ungewissen lässt, ob das
Gerät arbeitet. An die Stelle des Fortschrittsbalkens tritt deshalb ein
unbestimmter: ein Lichtstreifen, der durchläuft, solange gerechnet wird, und
stehenbleibt, sobald es pausiert.

Er hat keine Füllung, nur Bewegung – aus seinem Lauf lässt sich nichts über den
Stand ablesen. Gesteuert wird er aus demselben Fortschrittsrückruf wie sonst
die Prozentzahl, zeigt also echtes Rechnen an und keine Dekoration.

### Keine Zahl, die die Zukunft verrät

Unter „meinen Regeln" verschwindet jede Anzeige, aus der sich ablesen ließe, wie lange
es noch dauert. Was bereits geschehen ist, bleibt stehen – drei von fünf
Fragmenten offen sieht man ohnehin am Band.

| | normal | Meine Regeln |
|---|---|---|
| Bann | Countdown und Prozent | `· · ·` und das Mahlwerk |
| Strafe | Countdown | `· · ·` |
| Sperrfrist | Countdown und Termin | `· · ·`, „Komm wieder, wenn du glaubst, dass es so weit ist." |
| Notausgang | verstrichen / verbleibend, Balken | Mahlwerk und Knopf |
| Fahrplan | alle Fragmente und Prüfungen | gibt es nicht |
| Schätzung | „ungefähr 2 h 40 min" | „Das erfährst du nicht." |

Ausgenommen sind Prüfungen, die ohne Uhrzeit **unlösbar** wären: Wer zu einem
Zeitfenster oder zu einer Rückmeldung zurückkommen soll, muss wissen, wann.
Die Regel gilt für alles, was man nur aussitzt.

Die Spanne des Notausgangs bleibt sichtbar – die hat der Spieler selbst
gesetzt. Nur der gezogene Wert und der Fortschritt dorthin fehlen.

Weil der Notausgang hier der einzige Wert ist, den der Spieler setzt, bleiben
alle drei Spielarten einstellbar – feste Dauer, gezogene Spanne, geheime
Spanne. Das war eine Weile kaputt: Die Sichtbarkeit der Felder hing an
`aufwandAktualisieren`, und die Schätzung steigt unter „meinen Regeln" früh
aus, bevor sie dort ankommt. Wer „feste Zeit" wählte, bekam kein Feld. Die
Umschaltung steht jetzt in `notausgangFelderZeigen` und wird aus beiden Wegen
aufgerufen.

Der Notausgang bleibt der einzige Boden nach unten – deshalb ist er das
Einzige, was du selbst festlegst.

## Das Glücksspiel

Optional, in den Zeitregeln zuschaltbar (unter „meinen Regeln" immer an). Bei jeder
Sperrfrist und jeder Strafe darfst du **einmal** würfeln:

* **5 oder 6** – die Wartezeit fällt weg.
* **1 bis 4** – der Rest wird um die Hälfte länger.

Der Erwartungswert ist genau die ursprüngliche Wartezeit: 2/3 × 1,5 = 1. Das
Spiel kostet im Mittel nichts und tut trotzdem weh. Gewürfelt wird mit
`crypto.getRandomValues` und Rückweisung ab 252 – ein Byte modulo sechs wäre
schief, weil 256 nicht durch 6 teilbar ist, und ausgerechnet die Gewinnseite
(5 und 6) wäre benachteiligt. Über 60 000 Würfe gemessen: Gleichverteilung
zwischen 0,164 und 0,170 je Augenzahl, Gewinnquote 0,3333.

Der Bann lässt sich nicht verwürfeln. Er ist kryptografisch, kein Timer.

## Zeitregeln

Drei Schalter, die quer über alle Dimensionen wirken:

* **Strafzeit bei Fehlversuch** (aus / mild ab 20 s / hart ab 60 s). Jeder
  weitere Fehlversuch derselben Aufgabe kostet das 1,7-Fache, gedeckelt bei
  30 Minuten. Die Aufgabe ist währenddessen gesperrt und zeigt einen Countdown.
* **Geheimes Zeitlimit für die Aufgaben** (im Dialog so benannt, damit es
  nicht mit dem Notausgang verwechselt wird). Beim Verriegeln wird eine Frist
  *zufällig gezogen* und nicht angezeigt – sichtbar sind nur die Spanne, die du gesetzt
  hast, und die verstrichene Zeit. Zwei Bezüge:

  * **Ganzer Tresor** (Standard): eine absolute Spanne, z. B. „mindestens 1 h,
    höchstens 5 h". Die Uhr startet beim Verriegeln und läuft weiter, während
    die App zu ist. Läuft sie ab, fallen **alle noch verschlossenen Fragmente
    auf Anfang zurück** – erledigte Aufgaben, eingegebene Antworten und
    laufende Sperrfristen sind weg, und wahlweise verfällt auch die bereits
    geleistete Rechenzeit. Bereits geöffnete Ziffern bleiben offen: die Frist
    kostet Arbeit, niemals das Geheimnis. Danach wird sofort eine **neue**
    Höchstzeit gezogen.
  * **Je Aufgabe**: ein zufälliges Vielfaches der geschätzten Dauer (z. B. 1,2×
    bis 3,0×), angezeigt nur als ⏳. Bei Ablauf beginnt die Aufgabe von vorn,
    es gibt Strafzeit, und es wird neu gezogen. Der Startzeitpunkt wird
    gespeichert, ein Reload schenkt also keine Zeit.

  Den Notausgang rührt der Ablauf nicht an – sonst könnte eine verpasste Frist
  den Tresor unlösbar machen. „Geheim" heißt hier: nicht angezeigt. Im
  `localStorage` steht der gezogene Wert, wie alles andere auch.

* **Notausgang** – der Ausweg, falls du an einer Aufgabe hängen bleibst: ein
  zweites, unabhängiges Zeitschloss über das *ganze* Geheimnis, ohne Aufgaben
  und ohne Sperrfristen. Wie lange er kostet, entscheidest du mit einer von
  drei Spielarten:

  | Modus | Dauer | Was du weißt |
  |---|---|---|
  | **feste Dauer** | genau der eingestellte Wert | alles, von Anfang an |
  | **zufällig, angezeigt** | beim Verriegeln aus deiner Spanne gezogen | nach dem Verriegeln genau |
  | **zufällig, geheim** | ebenso gezogen | nur die Spanne |

  In den ersten beiden Fällen zeigt die Karte Restzeit und Prozent wie ein
  gewöhnlicher Fortschritt. Im geheimen Fall gibt es beides nicht – und zwar
  nicht aus Prinzipienreiterei: Die Schrittzahl wird dort **nirgends
  gespeichert**. Abgelegt ist nur `SHA-256` der Lösung; der Worker quadriert
  und prüft alle 250 000 Schritte, ob er angekommen ist. Weder die App noch
  jemand, der den Speicher ausliest, kann die Dauer vorher ablesen – bekannt
  sind nur Unter- und Obergrenze. Gezeigt werden die geleistete Rechenzeit,
  eine Markierung für die Untergrenze und der Hinweis, ab wann es aufspringen
  kann.

  Er **rechnet im Hintergrund**: einmal gestartet, läuft er weiter, während du
  an den Aufgaben sitzt, und nimmt seinen Lauf nach einem Neuladen von selbst
  wieder auf. Anhalten geht jederzeit, der Zwischenstand bleibt. Gesteuert wird
  er direkt auf dem Tresor-Bildschirm, es gibt keine eigene Ansicht mehr.
  Laufen Fragment-Zeitschloss und Notausgang gleichzeitig, sind das zwei
  Worker – auf einem Mehrkerngerät stören sie sich nicht.

  Im Modus **ohne Rechenzeit** zahlt derselbe Notausgang in Wartezeit statt in
  Quadrierungen, mit denselben drei Spielarten; die Karte nennt dann zusätzlich
  den Termin. Dort steht er allerdings im Browser-Speicher – wie alles in
  diesem Modus.

---

## Das Zeitbudget

Wer den Notausgang auf drei Stunden setzt, sagt damit: **länger als drei
Stunden habe ich nicht.** Das ist ein Versprechen, und Aufgaben dürfen es nicht
brechen. Genau das taten sie: Ein Tresor mit fünf Minuten Höchstzeit konnte ein
Zeitfenster ziehen, das bis zum nächsten Abend wartet – neunzehn Stunden gegen
fünf Minuten. Der Aufgabenweg war damit sinnlos, weil der Ausgang immer die
bessere Wahl gewesen wäre.

**Vorgabe ist deshalb der sichere Weg**: eine feste halbe Stunde Rechenzeit.
Wer den Notausgang übersieht und dann an den Aufgaben scheitert, säße sonst
ohne Ausweg da – und ein voreingestellter Ausgang, den man bewusst abschalten
muss, ist die freundlichere Reihenfolge. Der voreingestellte Tresor schätzt
sich damit auf rund 28 Minuten, passt also zu seinem eigenen Ausgang.

Der Notausgang spannt deshalb ein Budget auf (`zeitBudget` in `js/tresor.js`).
Maßgeblich ist die **Obergrenze** der Spanne: das Schlimmste, worauf sich der
Spieler eingelassen hat. Es verteilt sich gleichmäßig auf alle Aufgabenplätze,
und jede wartende Aufgabe bekommt ihren Anteil als Deckel.

| Notausgang | je Platz | längste Sperrfrist | längste Rückmeldung | Zeitfenster |
|---|---|---|---|---|
| aus | – | 15 h | 29 h | erlaubt |
| 5 min | 60 s | 60 s | 60 s | ausgeschlossen |
| 3 h | 36 min | 36 min | 36 min | ausgeschlossen |
| 24 h | 4,8 h | 4,8 h | 4,8 h | erlaubt |

**Ohne Notausgang gibt es keine Grenze** – kein Versprechen, keine Schranke.
Wer keinen Ausgang setzt, hat sich auf alles eingelassen.

Zwei Dinge waren dabei nicht offensichtlich:

* **Was sich nicht stauchen lässt, wird ausgeschlossen.** Eine feste Tageszeit
  ist keine Dauer – wer das Fenster knapp verpasst, wartet bis zum nächsten
  Tag. Das Zeitfenster braucht deshalb ein Budget von mindestens 22 Stunden
  (`budgetBedarf`), sonst kommt es gar nicht erst in den Topf.
* **Ein Mindestabstand kann eine Deckelung aushebeln.** Bei den Rückmeldungen
  wird zuerst der Abstand gestaucht, aber unter eine Minute geht es nicht – bei
  fünf Besuchen blieben so immer vier Minuten stehen, egal wie klein das Budget
  war. Reicht der Mindestabstand nicht, sinkt jetzt die Zahl der Besuche.

Die **Summe** aller Aufgaben darf das Budget weiterhin überschreiten. Das ist
kein Widerspruch: Der Notausgang ist die Alternative zum ganzen Weg, nicht zu
einer einzelnen Prüfung. Ist der Weg länger, nimmt man eben den Ausgang – dafür
ist er da.

## Wiederholbarkeit

Damit sich zwei Durchläufe nicht gleich anfühlen:

* **Parameter statt Konserven**: Jede Aufgabe wird aus einem Zufallsstrom
  erzeugt – Dauern, Takte, Toleranzen, Abstände und Signalzeiten sind jedes Mal
  andere. Es gibt keine feste Rätselliste, die sich erschöpfen könnte.
* **Kein Typ zweimal**, solange der Topf reicht: Innerhalb eines Tresors wird
  reihum aus einem gemischten Vorrat gezogen.
* **Gedächtnis über Tresore hinweg**: Zuletzt benutzte Aufgabentypen rutschen
  im nächsten Tresor ans Ende des Vorrats.
* Der Zufallsstrom hängt an einer gespeicherten Saat – ein Reload ändert den
  Plan also nicht.

---

## Foto-Eingabe

Die Zahl darf auch von einem Foto kommen. Die Erkennung läuft komplett lokal:

Graustufen → Otsu-Schwelle **und** ortsabhängige Schwelle nach Bradley-Roth,
jeweils in beiden Polaritäten → Zusammenhangskomponenten → die Bildzeile mit den
gleichmäßigsten Ziffernabständen → Vergleich jeder Ziffer gegen Muster, die aus
sechs Schriftarten gerendert werden.

Getestet mit gerenderten Zahlen in Serifen-, Mono- und serifenlosen Schriften,
invertiert, gedreht, verrauscht, JPEG-komprimiert und mit Schlagschatten:
9 von 9 vollständig korrekt. Ein echtes Handyfoto ist schwerer – deshalb ist der
Vorschlag immer korrigierbar, und unsichere Ziffern werden rot markiert.

---

## Auf dem Handy

Zwei Eigenheiten mobiler Geräte fängt die App ab:

* Der **Bildschirm** schaltet nach wenigen Sekunden ohne Berührung ab – mitten
  in „Nichts tun" oder „Wachbleiben". Solange eine Aufgabe läuft, hält die App
  ihn deshalb per Wake Lock wach; beim Rechnen eines Zeitschlosses gibt es
  denselben Schalter zum Mitnehmen.
* Geht er trotzdem aus oder wechselst du die App, **pausieren alle Uhren**,
  statt weiterzulaufen oder abzubrechen. Beim Zurückkommen geht es dort weiter,
  wo es aufgehört hat. (Einzige Ausnahme: „Stillhalten" gilt weiterhin als
  abgebrochen, wenn du die App verlässt – der Finger war ja weg.)

## Lokal starten

Die App braucht einen Web Worker und die Web Crypto API, also einen echten
HTTP-Server (`file://` reicht nicht):

```bash
npx http-server -p 8080 .
# oder
python3 -m http.server 8080
```

Dann `http://localhost:8080/` öffnen. Auf GitHub Pages läuft das Verzeichnis
unverändert.

---

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Gerüst und Skript-Reihenfolge |
| `css/style.css` | Gestaltung |
| `js/util.js` | DOM-Helfer, Zeitformate, Hex |
| `js/stimme.js` | Die Sätze des Wächters, Benennungen für die Oberfläche |
| `js/rng.js` | Zufallsstrom mit Saat |
| `js/krypto.js` | Schlüsselableitung, PBKDF2-Antwortbindung, AES-256-GCM |
| `js/worker-timelock.js` | Primzahlen, Puzzle-Erzeugung, sequentielles Quadrieren |
| `js/zeitschloss.js` | Hülle um den Worker, pausierbarer Löser |
| `js/herausforderungen.js` | Registry, gemeinsame Bausteine, Geduld und Zeit |
| `js/aufgaben-glueck.js` | Würfel, Münze, Ziehung, Glücksrad |
| `js/aufgaben-logik.js` | Zahlenfolge, Lügner, Waage, Mastermind |
| `js/aufgaben-raetsel.js` | Chiffre, Morse, Anagramm, Zahlenrätsel |
| `js/aufgaben-konzentration.js` | Tonfolge, N-Back, Stroop, Zahlenjagd |
| `js/sensoren.js` | Lagesensoren: Fähigkeitsprüfung, iOS-Freigabe, Messungen |
| `js/aufgaben-sensor.js` | Wasserwaage, Lagenfolge, Schritte, Ruhige Hand |
| `js/nfc.js` | Web NFC: Fähigkeitsprüfung, Marken lesen und beschreiben |
| `js/aufgaben-ort.js` | Station: NFC-Marke finden, Vorrat der Stationsgeheimnisse |
| `js/ersatzweg.js` | Aufwand statt Fähigkeit, wenn Sensor oder NFC fehlen |
| `js/woerter.js` | Wortvorrat ohne Umlaute |
| `js/tresor.js` | Aufgabenplan, Verriegeln, Freigabe |
| `js/foto.js` | Ziffernerkennung im Bild, Zerlegung in Schärfestufen |
| `js/speicher.js` | `localStorage`, Verlauf, benutzte Aufgabentypen |
| `js/sicherung.js` | Export und Import als Datei, optional verschlüsselt |
| `js/erinnerung.js` | Anlässe für Benachrichtigungen, Erlaubnis, Versand |
| `js/probe.js` | Probelauf: jede Prüfung einzeln, ohne Folgen |
| `hardware/` | Tresorbox: druckbare Kiste mit Servoverschluss (noch ohne Firmware) |
| `js/app.js` | Oberfläche und Ablauf |
