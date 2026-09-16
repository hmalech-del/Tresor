# 🔒 Tresor – ein Geheimnis auf Raten

Du gibst dem Tresor eine Zahl. Er zerlegt sie sofort in einzelne Ziffern,
verschlüsselt jede für sich und gibt sie nur Stück für Stück wieder heraus –
gegen Geduld, gegen Wartezeit und gegen echte Rechenzeit.

Alles läuft im Browser: keine Server, kein Konto, keine Übertragung.
Eine statische Seite, kein Build-Schritt, keine Abhängigkeiten.

---

## Der Ablauf

1. **Geheimnis festlegen** – 3 bis 8 Ziffern eintippen oder ein Foto der Zahl
   aufnehmen; die Ziffern werden im Bild erkannt und lassen sich korrigieren.
2. **Schwierigkeit wählen** – welche Dimensionen (Geduld, Zeit …), wie intensiv,
   wie viele Aufgaben pro Fragment, wie viel Rechenzeit pro Zeitschloss.
   Die Seite zeigt laufend den voraussichtlichen Gesamtaufwand.
3. **Verriegeln** – die App schmiedet pro Ziffer ein Zeitschloss, verschlüsselt
   die Ziffer damit und wirft den Klartext weg.
4. **Freispielen** – pro Fragment erst die Aufgaben, dann die Rechenzeit.
   Jede gelöste Stufe legt genau eine Ziffer frei, an ihrer richtigen Stelle.

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

### Was das schützt – und was nicht

* **Echt** ist die Rechenzeit. Sie kostet jeden gleich viel, auch jemanden mit
  dem Entwicklerwerkzeug im Browser.
* **Nicht kryptografisch** sind die Geduldsaufgaben und die Sperrfristen: Sie
  sind Bedienoberfläche. Wer `localStorage` liest und selbst rechnet, kann sie
  überspringen. Gegen Zurückstellen der Systemuhr wehrt sich die Sperrfrist,
  mehr aber nicht.
* Der Tresor ist ein Selbstbindungs-Werkzeug, kein Schutz gegen Angreifer mit
  Zugriff auf das Gerät. **Löschen heißt löschen** – ohne Zeitschloss-Lösung
  gibt es keinen Ersatzweg zur Zahl.

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

### Geplant

Logik (Mastermind, Zahlenfolgen, Lügner und Wahrheitssager), Rätsel (Chiffren,
Anagramme, Morse) und Konzentration (Simon, N-Back, Stroop) sind in der
Oberfläche bereits vorgesehen. Eine neue Aufgabe ist ein Objekt mit vier
Funktionen und einem `registrieren(...)`-Aufruf in
[`js/herausforderungen.js`](js/herausforderungen.js):

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
| `js/speicher.js` | `localStorage`, Gedächtnis für benutzte Aufgabentypen |
| `js/krypto.js` | Schlüsselableitung, AES-256-GCM pro Fragment |
| `js/worker-timelock.js` | Primzahlen, Puzzle-Erzeugung, sequentielles Quadrieren |
| `js/zeitschloss.js` | Hülle um den Worker, pausierbarer Löser |
| `js/herausforderungen.js` | Registry und alle Aufgaben |
| `js/tresor.js` | Aufgabenplan, Verriegeln, Freigabe |
| `js/foto.js` | Ziffernerkennung im Bild |
| `js/app.js` | Oberfläche und Ablauf |
