# 🔒 Tresor – ein Geheimnis auf Raten

Du gibst dem Tresor ein Geheimnis – eine Zahl oder ein Bild. Er zerlegt es
sofort in Fragmente, verschlüsselt jedes für sich und gibt sie nur Stück für
Stück wieder heraus – gegen Geduld, gegen Wartezeit und gegen echte Rechenzeit.

Alles läuft im Browser: keine Server, kein Konto, keine Übertragung.
Eine statische Seite, kein Build-Schritt, keine Abhängigkeiten.

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

Ein Bild lässt sich nicht in Ziffern zerlegen, wohl aber in **Schärfestufen**:
Stufe 1 ist ein grober Farbfleck von 24 px Breite, die letzte das ganze Bild
(bis 1280 px, JPEG). Jede Stufe ist ein eigenes Fragment mit eigenem Schlüssel
und eigenem Zeitschloss, die Freigabe geht also immer von grob nach fein – eine
Zufallsreihenfolge gibt es hier nicht, sie ergäbe keinen Sinn.

Die Zerlegung passiert vor dem Verriegeln und ist in der Einrichtung zu sehen:
So weißt du vorher, wie wenig die erste Stufe verrät. Ein 900 × 600-Foto kostet
mit fünf Stufen rund 30 kB; passt der Tresor nicht in den Browser-Speicher,
sagt die App das, statt still zu scheitern. Am Ende gibt es das Bild zum
Sichern.

---

## Zwei Sicherheitsstufen

| Modus | Was die Fragmente schützt | Notausgang | Kosten |
|---|---|---|---|
| **sicher** (Standard) | Echte, nicht abkürzbare Rechenzeit je Fragment | zweites Zeitschloss, zufällige **Rechenzeit** | ein Kern unter Volllast, Akku |
| **weniger sicher** | Nichts – der Schlüsselanteil liegt offen daneben | zufällige **Wartezeit** ab dem Verriegeln | keine |

Beide Modi stellen den Notausgang über dieselben zwei Felder ein.

Im weniger sicheren Modus sind die Aufgaben reine Oberflächenhürden: Wer den
`localStorage` liest, kommt sofort an das Geheimnis. Dafür kostet nichts Strom,
und es gibt keine Wartezeit auf den Rechner. **Antwortgebundene Rätsel wirken
auch dort**, weil ihre Lösung in den Schlüssel eingeht – ein solcher Tresor mit
Logik- und Rätselaufgaben ist also nicht ganz ungeschützt.

Den **Notausgang gibt es in beiden Modi**, denn er ist ein Sicherheitsnetz für
den Fall, dass man eine Aufgabe nicht packt – kein Bonus fürs Zeitschloss. Ohne
Rechenzeit hilft nur die Uhr: Er öffnet irgendwann zwischen den beiden von dir
gesetzten Grenzen, gezogen beim Verriegeln, und der Termin wird nicht angezeigt.
Anders als beim Zeitschloss steht er allerdings im Browser-Speicher – wie alles
in diesem Modus. Die Uhr läuft auch bei geschlossener App weiter und lässt sich
nicht durch Zurückstellen der Systemuhr austricksen.

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

### Geduld

| Aufgabe | Worum es geht |
|---|---|
| **Stillhalten** | Knopf gedrückt halten, Loslassen setzt zurück |
| **Nichts tun** | Bildschirm offen lassen – jede Berührung, jeder Tabwechsel setzt zurück |
| **Atemtakt** | Dem Atemrhythmus folgen und an jedem Wendepunkt tippen |
| **Wachbleiben** | Auf unregelmäßige Signale innerhalb eines kurzen Fensters reagieren |
| **Gleichmaß** | Einen Regler in vorgegebener Zeit gleichmäßig durchschieben |
| **Zeitgefühl** | Eine Dauer ohne Uhr auf wenige Prozent genau schätzen |

### Zeit

| Aufgabe | Worum es geht |
|---|---|
| **Sperrfrist** | Feste Wartezeit von Minuten bis Stunden, App darf zu sein |
| **Zeitfenster** | Nur zu einer bestimmten Tageszeit zu öffnen (ab Intensität 3) |
| **Rückmeldungen** | Mehrmals vorbeischauen, mit Mindestabstand dazwischen |
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

### Geplant

Konzentration (Simon, N-Back, Stroop) ist in der Oberfläche vorgesehen. Eine
neue Aufgabe ist ein Objekt mit vier Funktionen und einem
`registrieren(...)`-Aufruf – gebundene Aufgaben liefern zusätzlich `loesung`
und `normalisiere`, der Tresor streicht die Lösung vor dem Speichern:

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

## Zeitregeln

Drei Schalter, die quer über alle Dimensionen wirken:

* **Strafzeit bei Fehlversuch** (aus / mild ab 20 s / hart ab 60 s). Jeder
  weitere Fehlversuch derselben Aufgabe kostet das 1,7-Fache, gedeckelt bei
  30 Minuten. Die Aufgabe ist währenddessen gesperrt und zeigt einen Countdown.
* **Geheime Höchstzeit.** Beim Verriegeln wird eine Höchstzeit *zufällig
  gezogen* und nicht angezeigt – sichtbar sind nur die Spanne, die du gesetzt
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

* **Notausgang** – die Exit-Strategie, und zwar mit unbekannter Dauer. Ein
  zweites, unabhängiges Zeitschloss über das *ganze* Geheimnis: keine Aufgaben,
  keine Sperrfristen, nur Rechenzeit. Du setzt eine Spanne – etwa „frühestens
  nach 1 h, spätestens nach 5 h" –, die tatsächliche Dauer wird beim Verriegeln
  daraus gezogen.

  Sie ist dabei **wirklich** unbekannt und nicht bloß ausgeblendet: Die
  Schrittzahl wird nirgends gespeichert. Abgelegt ist nur `SHA-256` der Lösung;
  der Worker quadriert und prüft alle 250 000 Schritte, ob er angekommen ist.
  Weder die App noch jemand, der den Speicher ausliest, kann die Dauer vorher
  ablesen – bekannt sind nur Unter- und Obergrenze. Entsprechend gibt es in der
  Ansicht keinen Countdown und keine Prozentzahl, sondern die geleistete
  Rechenzeit, eine Markierung für die Untergrenze und den Hinweis, ab wann es
  aufspringen kann.

  Er **rechnet im Hintergrund**: einmal gestartet, läuft er weiter, während du
  an den Aufgaben sitzt, und nimmt seinen Lauf nach einem Neuladen von selbst
  wieder auf. Anhalten geht jederzeit, der Zwischenstand bleibt. Gesteuert wird
  er direkt auf dem Tresor-Bildschirm, es gibt keine eigene Ansicht mehr.
  Laufen Fragment-Zeitschloss und Notausgang gleichzeitig, sind das zwei
  Worker – auf einem Mehrkerngerät stören sie sich nicht.

  Eingestellt wird er mit **zwei Feldern**: „öffnet frühestens nach" und
  „… und spätestens nach". Mehr braucht es nicht. Im Modus **ohne Rechenzeit**
  bedeuten dieselben zwei Felder Wartezeit statt Rechenzeit – siehe „Zwei
  Sicherheitsstufen".

---

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
| `js/rng.js` | Zufallsstrom mit Saat |
| `js/krypto.js` | Schlüsselableitung, PBKDF2-Antwortbindung, AES-256-GCM |
| `js/worker-timelock.js` | Primzahlen, Puzzle-Erzeugung, sequentielles Quadrieren |
| `js/zeitschloss.js` | Hülle um den Worker, pausierbarer Löser |
| `js/herausforderungen.js` | Registry, gemeinsame Bausteine, Geduld und Zeit |
| `js/aufgaben-glueck.js` | Würfel, Münze, Ziehung, Glücksrad |
| `js/aufgaben-logik.js` | Zahlenfolge, Lügner, Waage, Mastermind |
| `js/aufgaben-raetsel.js` | Chiffre, Morse, Anagramm, Zahlenrätsel |
| `js/woerter.js` | Wortvorrat ohne Umlaute |
| `js/tresor.js` | Aufgabenplan, Verriegeln, Freigabe |
| `js/foto.js` | Ziffernerkennung im Bild, Zerlegung in Schärfestufen |
| `js/speicher.js` | `localStorage`, Verlauf, benutzte Aufgabentypen |
| `js/app.js` | Oberfläche und Ablauf |
