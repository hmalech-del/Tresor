---
name: tresor-app
description: Kontext für die Tresor-App (Repo hmalech-del/tresor) - eine Vanilla-JS-Web-App, die ein Geheimnis (Zahl oder Bild) wegschließt und stückweise über Prüfungen freigibt, mit Zeitschlössern (Rechenzeit, drand-Netz), Zeitkonto, Strafen, Würfeln, Kapitulieren, dem Stein und dem Willkür-Modus. Lade diesen Skill, sobald es um die Tresor-App geht - neue Funktion, Fehler, Balancing von Zeiten/Boni/Strafen, Texte des Game Masters, Tests, README - auch wenn der Nutzer nur "die App", "den Tresor", "Fragmente", "Freigabe", "Notausgang" oder "Willkür" sagt. Für die gedruckte Kiste mit Servo gibt es den Skill tresorbox.
---

# Tresor-App

Eine App, die ein Geheimnis wegschließt – eine Ziffernfolge oder ein Bild – und
es nur in Fragmenten freigibt, jedes hinter Prüfungen und einem Zeitschloss.
Der Nutzer spielt vor allem auf **Android**, spricht **Deutsch** und will es
spannend: Glücksspiel, Willkür, ein Zeitlimit-Gefühl. Die Stimme der App ist
ein autoritärer **Game Master** (Regeln in `js/stimme.js`, Kopfkommentar).

Kein Build, kein Framework, keine Abhängigkeiten zur Laufzeit außer dem
gebündelten `js/vendor/tlock.min.js`. Push auf `main` deployt über
`.github/workflows/deploy-pages.yml` auf GitHub Pages.

## Arbeitsweise, die der Nutzer so will

- **Direkt auf `main` committen und pushen** (kein PR, wenn nicht verlangt).
  Commit-Nachrichten auf Deutsch, ohne Umlaute in der ersten Zeile ist üblich.
- Vor dem Push: `tests/browser/alle.sh` (siehe unten) grün. Wenn ein Test
  scheitert, erst prüfen, ob der Test oder die App schuld ist, und das sagen.
- `README.md` ist die Produktdoku (≈1100 Zeilen, nach Überschriften
  gegliedert: `grep -n '^## \|^### ' README.md`). Jede Funktion, die man
  sieht, bekommt dort einen Absatz; Zahlenbeispiele **nachrechnen**, bevor sie
  hineingeschrieben werden – einmal stand "eine Dreiviertelstunde", richtig
  waren zehn Minuten.
- Antworten an den Nutzer auf Deutsch, knapp, mit dem, was er ausprobieren kann.

## Karte

| Datei | Wofür |
|---|---|
| `js/tresor.js` | **Logik**: Konfiguration, Aufgabenplan, `erstellen` (Verriegeln), Zeitkonto-Buchungen, Kapitulation, Stein, Notausgang. Alles exportiert als `Tresor.tresorLogik` |
| `js/app.js` | **Oberfläche und Ablauf**: Einrichten, `zeichneTresor`, `starteAktuelles`, Freigabe-, Stein-, Notausgang-, Straf-Ansichten |
| `js/zeitkonto.js` | `Konto(leiter, stand)`: exakte Wunschzeit auf einer Leiter vorab erzeugter Ziellinien |
| `js/drand.js`, `js/worker-drand.js`, `js/vendor/tlock.min.js` | Zeitschloss über das drand-Netz (quicknet, 3-s-Runden). Neu bündeln: Kopfkommentar in `drand.js` |
| `js/zeitschloss.js`, `js/worker-timelock.js` | Rechenzeit-Schloss (RSW-Puzzle, sequentielles Quadrieren) |
| `js/krypto.js` | PBKDF2, AES-256-GCM, Antwortbindung |
| `js/herausforderungen.js` | Registry der Aufgaben, Bausteine (`wuerfel`, `antwortFeld`, …), Dimensionen Geduld und Zeit |
| `js/aufgaben-*.js` | Aufgaben je Dimension (Glück, Logik, Rätsel, Konzentration, Sensor, Ort/NFC) |
| `js/stimme.js` | Alle Sätze des Game Masters, nach Anlass (`sag('stein')`) |
| `js/speicher.js`, `js/sicherung.js` | `localStorage` (`tresor.v1`), Verlauf, Export/Import |
| `js/erinnerung.js`, `js/probe.js`, `js/foto.js` | Benachrichtigungen, Probelauf, Ziffern aus Foto |

Skript-Reihenfolge steht in `index.html`; jede Datei hängt sich an
`window.Tresor` (`T.util`, `T.tresorLogik`, `T.drand`, …).

## Das Modell in fünf Minuten

**Drei Zeitschlösser** (`konfig.sicherheit`):

| Oberfläche | Wert | was hält | Strafen |
|---|---|---|---|
| eisern | `rechenzeit` | RSW-Puzzle je Fragment; das Gerät muss rechnen | Wartezeit `zustand.strafeBis` |
| fern | `drand` | drand-Beacon; Bildschirm darf aus sein, Tage/Wochen möglich | schieben die Freigabe (Zeitkonto) |
| nachsichtig | `ohne-rechenzeit` | nur App-Logik | Wartezeit |

**Fern (drand) – der ausgebauteste Modus.** `tresor.freigabe` enthält
`rahmen [unten, oben]`, `leiter` (≤ 90 Sprossen, ~5 % Abstand, von unten bis
`deckel`), zu jeder Sprosse eine drand-Runde und ein Paket mit dem
Zeitschlüssel Z, `konto.zielSek` (Uhr startet **oben**), `gutschrift`
(Normalwert je Prüfung = Spanne / Anzahl), `takt`, `z` (einmal geholt, bleibt
er). Kryptografisch fest sind nur Boden und Deckel der Leiter; alles
dazwischen ist App-Logik. Alle Fragmente öffnen **gemeinsam** zur Freigabe –
gewollt, sonst ließen sich die letzten Ziffern raten.

**Die Zeit entscheidet, nicht die Prüfungen.** Prüfungen verkürzen oder (mit
Fehlern) verlängern die Zeit; sie sind kein Tor. Ist die Uhr um, stößt die
Freigabe-Karte das Neuzeichnen an (auch mitten in einer Prüfung),
`netzAbholen` holt Z, `freigabeAlleOeffnen` öffnet alles – offene Prüfungen
bekommen `verfallen`, Rätsel gehen über ihr Pfand auf. Nur ein Rätsel ohne
Pfand (Tresor von vor dem Pfand) hält sein Fragment zu
(`freigabeOeffenbar`). Der Nutzer nannte das alte Verhalten ("Das Netz hat
freigegeben, was noch fehlt, sind deine Prüfungen") zu Recht
Etikettenschwindel – nicht wieder einführen.

- **Gutschrift** bei gelöster Prüfung, **Strafe** bei Fehlversuch – beide
  gezogen (`AUSSCHLAG`, Tabelle normal/willkür), gedeckelt je Buchung.
- **Wurf**: ab und zu wird angeboten, eine Buchung zu verwürfeln
  (Erwartungswert genau 1).
- **Takt** ab `unten ≥ 6 h`: Prüfungen kommen verteilt (`aufgabe.frei`,
  `puenktlichBis`); verspätet gibt es die halbe Gutschrift. `netzLage()` liefert
  die nächste Prüfung über alle Fragmente hinweg.
- **Kapitulieren** (`KAPITULATION`): Würfel bestimmt das Vielfache; am Netz
  schiebt es die Freigabe, sonst Wartezeit. Rätsel-Lösungen liegen dafür als
  **Pfand** verschlüsselt unter dem Zeitteil des Fragments; ohne Zeitschloss
  kein Pfand, dort sind Rätsel nicht aufgebbar.
- **Der Stein** (`STEIN`): eigene Karte, jederzeit, beliebig lange, losgelöst
  von den Prüfungen. 150 Stöße links/rechts im Wechsel = ein Gipfel; am Netz
  1,5 ‰ des Rahmens nach vorn (nie unter `unten`), sonst 30 s auf
  `tresor.steinVorrat`, der laufende oder nächste Wartezeiten bezahlt. Der
  laufende Aufstieg liegt in `zustand.stein`, damit er Neuzeichnen übersteht.
- **Notausgang**: zweiter Weg zum ganzen Geheimnis, fest/Spanne/geheim; am Netz
  als drand-Runde, sonst Rechenzeit oder Zeitstempel.

**Willkür** = `konfig.blind` (in der Oberfläche "Willkür", früher "Meine
Regeln"). Die App zieht Regeln selbst, zeigt **keine Beträge, keine
Freigabe-Uhr, keine Gesamtzahl** – nur, wann die nächste Prüfung kommt. In
`app.js` prüft das `imDunkeln()`. Jede neue Anzeige mit einer Zahl muss sich
fragen, ob sie unter Willkür etwas verrät.

**Stellschrauben** stehen als Objekte in `tresor.js` und sind über
`Tresor.tresorLogik` erreichbar (Tests stauchen sie): `TAKT`, `AUSSCHLAG`,
`KAPITULATION`, `STEIN`, `RECHENZEIT_STUFEN`, `DRAND_STRAFE_ANTEIL`,
`DRAND_DECKEL_FAKTOR`, `NOTAUSGANG_WERTE`, `TRESORZEIT_WERTE`. Beim Balancing
immer mit einem Beispiel rechnen (z. B. Rahmen 2–5 Tage, 10 Prüfungen) und
die Zahl im Kommentar und in der README nachziehen.

## Konventionen im Code

- Bezeichner und Kommentare **deutsch**. In `.js` und `.scad` Umlaute als
  `ae/oe/ue/ss` in Kommentaren und Namen; in Oberflächentexten echte Umlaute.
- Kommentare erklären das **Warum** und oft die Geschichte eines Fehlers
  ("Bisher lief es …, dann …"). Dichte und Ton beibehalten.
- DOM mit `el(tag, attrs, kinder)` aus `util.js`; `util.dauer`, `util.uhrwerk`,
  `util.zeitpunkt` für Zeiten. Deutsche Grammatik prüfen ("nach 7 **Tagen**" –
  dafür gibt es `nachDauer`).
- `zeichneTresor()` baut die ganze Ansicht neu und ruft vorher `aufraeumen()`.
  Intervalle gehören in `zustand.*Uhr` oder `zustand.aufraeumen`, sonst laufen
  sie doppelt. `freigabeKarte` zeichnet nie neu (sonst risse sie eine Aufgabe
  weg). Zustand, der ein Neuzeichnen überleben muss, gehört in `zustand`.
- Neue Game-Master-Sätze nach den Leitplanken in `stimme.js`: von oben herab,
  kein Lob über "ausreichend", kein Mitleid, kurz.
- Neue Aufgabe: `registrieren({...})`, siehe README "Eine eigene Aufgabe
  hinzufügen". Läuft sie auf Zeit, startet sie hinter `b.tor(los)` (aus
  `W.buehne`) und stellt nach einem Fehler `b.tor(los, 'Noch einmal')` –
  sonst rennt sie los, bevor man die Regel gelesen hat (so war es bei N-Back).

## Testen

```bash
tests/browser/alle.sh               # alles (einige Minuten), plus tests/test-zeitkonto.js
tests/browser/alle.sh stein drand   # nur passende Namen
```

Der Runner installiert beim ersten Mal `@noble/*` (für die gefälschte Kette),
startet `http-server` auf **:8099**, beendet ihn über die PID, schreibt Logs
nach `tests/browser/logs/`, Screenshots nach `tests/browser/schuesse/` (beides
nicht eingecheckt). Screenshots mit dem Read-Werkzeug ansehen – das ist der
schnellste Weg, Layout auf 390 px Handybreite zu prüfen.

- **Das echte drand-Netz ist aus der Sandbox nicht erreichbar.** Tests nutzen
  `scheinkette.js` (eigene BLS-Kette, `neu({period, genesisSek})`,
  `beacon(r)`, `gefaelscht(r)`) und hängen sie mit
  `Tresor.drand.testKette(info, quelle)` ein. Der erste echte Lauf passiert auf
  dem Handy des Nutzers – das offen sagen.
- Muster für neue Tests: `test-stein.js` (Logik per `page.evaluate`, dann
  Oberfläche per Klick), `pruefe(name, ok, text)`, Stellschrauben stauchen,
  Probe-Aufgaben per `H.registrieren` einhängen, `H.nachDimension` umbiegen.
- `test-durchlauf` hängt an der Rechenlast (echtes Rechenschloss im Worker);
  bei einem Ausreißer im Gesamtlauf einzeln wiederholen, bevor man sucht.

## Fallstricke aus früheren Sitzungen

- `pkill -f <muster>` trifft die eigene Shell (Exit 144). Server über
  `pgrep -x http-server` bzw. die gemerkte PID beenden. Einen gestarteten
  Server am Ende immer stoppen – der Nutzer sieht laufende Aufgaben.
- Chromium-CLI-Screenshots sind auf ~360 px begrenzt → Playwright nehmen.
- Anzeigen sollen den **gebuchten** Betrag zeigen (`gewuenscht`), nicht den
  Sprung auf der Leiter (`wirksam`).
- Offene Baustellen (nicht beauftragt): Rechenzeit-Tresore kennen keine
  Gutschriften und keinen Takt; Erinnerungen gehen nur bei offener Seite.
