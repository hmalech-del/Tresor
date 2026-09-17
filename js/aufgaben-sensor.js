/* =====================  SENSORAUFGABEN  =====================
 *
 * Aufgaben, die die Lagesensoren des Geräts benutzen. Sie kommen nur in den
 * Topf, wenn beim Einrichten "Sensoraufgaben zulassen" gesetzt war - und der
 * Schalter lässt sich nur setzen, wenn das Gerät die Sensoren wirklich hat.
 *
 * Gebunden wird dabei an die Fähigkeit, nicht an das Gerät: Ein Browser hat
 * keine stabile Geräte-Kennung. Eine Zufallsmarke im Speicher läge genau
 * dort, wo auch der Tresor liegt - beim Löschen der Browserdaten wäre sie
 * mit weg, und dein eigenes Gerät würde deine eigene Sicherung abweisen.
 * "Hat dieses Gerät den Sensor?" ist dagegen direkt prüfbar.
 *
 * Fehlt der Sensor (Desktop, oder auf dem iPhone abgelehnte Freigabe), gibt
 * es den Ersatzweg unten. Der muss wehtun, sonst wäre der Import auf einem
 * Laptop die bequemste Abkürzung durch den ganzen Tresor. Bezahlt wird
 * deshalb in Rechenzeit - der einzigen Währung dieser App, die sich nicht
 * durch Vorstellen der Geräteuhr fälschen lässt. */
(function (global) {
  'use strict';
  var T = global.Tresor || (global.Tresor = {});
  var util = T.util;
  var el = util.el;
  var H = T.herausforderungen;
  var werkzeug = H.werkzeug;
  var buehne = werkzeug.buehne;
  var balken = werkzeug.balken;
  var takt = werkzeug.takt;
  var ton = werkzeug.ton;
  var jitter = werkzeug.jitter;
  var proStufe = werkzeug.proStufe;

  var ERSATZ_MINDESTENS = 300;      // fünf Minuten, auch für die kürzeste Aufgabe
  var ERSATZ_HOECHSTENS = 7200;     // zwei Stunden sind genug Schmerz

  /* Wie teuer der Ersatzweg gemessen an der Aufgabe ist. Wird beim Verriegeln
   * in die Aufgabe geschrieben und ist danach nicht mehr verhandelbar. */
  function strafFaktor(stufe) { return proStufe(stufe, [6, 8, 10, 14, 20]); }

  function ersatzSekunden(modul, params) {
    var roh = (params.strafe || 10) * modul.schaetzung(params);
    return Math.round(util.grenze(roh, ERSATZ_MINDESTENS, ERSATZ_HOECHSTENS));
  }

  /* ---------- Rahmen: Sensor prüfen, freigeben oder ausweichen ---------- */

  /* Baut die Bühne und ruft `weiter(b, aufraeumer)` erst auf, wenn wirklich
   * Messwerte ankommen. Liefert den Aufräumer der ganzen Aufgabe zurück. */
  function mitSensor(kontext, modul, bedarf, titel, hinweis, weiter) {
    var b = buehne(kontext, titel, hinweis);
    var innen = null;                 // Aufräumer dessen, was gerade läuft
    var lebt = true;

    function raeumeInnen() {
      if (innen) { innen(); innen = null; }
    }

    function zeigePruefung(text) {
      util.leeren(b.koerper);
      b.koerper.appendChild(el('p', { class: 'sensor-pruefung flaut', text: text }));
    }

    function pruefen(mitGeste) {
      zeigePruefung('Sensor wird geprüft ...');
      b.sag('');
      T.sensoren.lage({ freigeben: !!mitGeste, frisch: true }).then(function (ergebnis) {
        if (!lebt) return;
        var brauchbar = bedarf === 'bewegung' ? ergebnis.bewegung : ergebnis.neigung;
        if (brauchbar) {
          util.leeren(b.koerper);
          innen = weiter(b) || null;
          return;
        }
        if (ergebnis.grund === 'freigabe') { zeigeFreigabe(); return; }
        zeigeErsatz(T.sensoren.grundText(ergebnis.grund)
          || 'Dieses Gerät liefert keine passenden Messwerte.');
      });
    }

    /* iOS fragt nach - und zwar nur, wenn die Anfrage aus einem echten Klick
     * kommt. Deshalb dieser Knopf statt einer Abfrage beim Laden. */
    function zeigeFreigabe() {
      util.leeren(b.koerper);
      b.koerper.appendChild(el('p', { class: 'flaut', text:
        'Dieses Gerät fragt erst nach, bevor eine Seite die Lagesensoren lesen darf.' }));
      var knopf = el('button', { class: 'knopf gross', type: 'button', text: 'Sensor freigeben' });
      knopf.addEventListener('click', function () { pruefen(true); });
      b.koerper.appendChild(knopf);
      b.koerper.appendChild(el('p', { class: 'flaut klein', text:
        'Wird die Freigabe abgelehnt, bleibt nur der Ersatzweg - und der kostet deutlich mehr Zeit als die Aufgabe.' }));
    }

    function zeigeErsatz(grund) {
      raeumeInnen();
      innen = ersatzBuehne(kontext, b, modul, grund, function () { pruefen(true); });
    }

    pruefen(false);

    return function () {
      lebt = false;
      raeumeInnen();
    };
  }

  /* ---------- Der Ersatzweg ---------- */

  function ersatzBuehne(kontext, b, modul, grund, nochmalPruefen) {
    var z = kontext.zustand;
    var sekunden = ersatzSekunden(modul, kontext.params);
    var mitRechenzeit = T.tresorLogik.rechenzeitModus(kontext.konfig || {});
    var laufendesAufraeumen = null;

    function zeigeAngebot() {
      util.leeren(b.koerper);
      b.sag('');
      b.koerper.appendChild(el('p', { class: 'warnung', text: grund }));
      b.koerper.appendChild(el('p', { text: 'Es gibt einen Ersatzweg, aber er ist absichtlich teuer: '
        + (mitRechenzeit
            ? util.dauer(sekunden) + ' echte Rechenarbeit statt dieser Aufgabe.'
            : util.dauer(sekunden) + ' Wartezeit statt dieser Aufgabe.')
        + ' Sonst wäre ein Gerät ohne Sensor die bequemste Abkürzung durch den ganzen Tresor.' }));
      var los = el('button', { class: 'knopf gross haupt', type: 'button',
        text: mitRechenzeit ? 'Ersatz beginnen (' + util.dauer(sekunden) + ' rechnen)'
                            : 'Ersatz beginnen (' + util.dauer(sekunden) + ' warten)' });
      var erneut = el('button', { class: 'knopf', type: 'button', text: 'Sensor noch einmal prüfen' });
      b.koerper.appendChild(el('div', { class: 'knopfzeile' }, [los, erneut]));
      b.koerper.appendChild(el('p', { class: 'flaut klein', text:
        'Einmal begonnen, bleibt es beim Ersatzweg - der angefangene Aufwand verfällt sonst mit jedem Wechsel.' }));
      los.addEventListener('click', function () { starten(); });
      erneut.addEventListener('click', function () {
        if (laufendesAufraeumen) { laufendesAufraeumen(); laufendesAufraeumen = null; }
        nochmalPruefen();
      });
    }

    function starten() {
      if (mitRechenzeit) { rechnen(); return; }
      if (!z.ersatzFrei) { z.ersatzFrei = Date.now() + sekunden * 1000; kontext.speichern(); }
      warten();
    }

    /* Wartezeit - schwächer als Rechenzeit, aber im weniger sicheren Modus
     * ist ohnehin alles an die Uhr geknüpft. */
    function warten() {
      util.leeren(b.koerper);
      b.koerper.appendChild(el('p', { text: 'Ersatzweg: Warten. Du kannst die App verlassen, die Uhr läuft weiter.' }));
      var fortschritt = balken(b.koerper, '');
      var stopp = takt(function () {
        var uebrig = (z.ersatzFrei - Date.now()) / 1000;
        if (uebrig <= 0) { stopp(); ton(660, 0.3); kontext.fertig(); return; }
        fortschritt.setze(1 - uebrig / sekunden);
        fortschritt.text(util.uhrwerk(uebrig) + ' übrig');
        b.sag('Frei ' + util.zeitpunkt(z.ersatzFrei) + '.', '');
      });
      laufendesAufraeumen = stopp;
    }

    /* Rechenzeit - dasselbe Zeitschloss wie überall sonst, nur hier erst zur
     * Laufzeit geschmiedet: Beim Verriegeln steht ja noch nicht fest, auf
     * welchem Gerät die Aufgabe einmal landet. */
    function rechnen() {
      util.leeren(b.koerper);
      b.koerper.appendChild(el('p', { text: 'Ersatzweg: Rechenarbeit. Sie läuft weiter, solange dieser Tab offen ist, '
        + 'und der Zwischenstand überlebt einen Neustart.' }));
      var fortschritt = balken(b.koerper, '');
      b.sag('Zeitschloss wird geschmiedet ...', '');

      var rate = kontext.rate || 0;
      var vorbereiten;
      if (z.ersatz) {
        vorbereiten = Promise.resolve();
      } else {
        vorbereiten = (rate > 0 ? Promise.resolve(rate) : T.zeitschloss.messen()).then(function (gemessen) {
          var schritte = Math.max(50000, Math.round(gemessen * sekunden));
          return T.zeitschloss.erzeugen(schritte).then(function (puzzle) {
            z.ersatz = {
              schloss: { n: puzzle.n, a: puzzle.a, t: puzzle.t },
              stand: { erledigt: 0, x: puzzle.a },
              schritte: schritte
            };
            puzzle.b = null;
            kontext.speichern();
          });
        });
      }

      var loeser = null, gesichert = 0, abgebrochen = false;
      vorbereiten.then(function () {
        if (abgebrochen) return;
        loeser = new T.zeitschloss.Loeser(z.ersatz.schloss, z.ersatz.stand, function (stand) {
          z.ersatz.stand = { erledigt: stand.erledigt, x: stand.x };
          var anteil = stand.erledigt / z.ersatz.schritte;
          fortschritt.setze(anteil);
          fortschritt.text(Math.floor(anteil * 100) + ' %');
          b.sag('Rechnet. Noch etwa ' + util.dauer(Math.max(0, sekunden * (1 - anteil))) + '.', 'laeuft');
          if (Date.now() - gesichert > 3000) { gesichert = Date.now(); kontext.speichern(); }
        });
        return loeser.starten();
      }).then(function (ergebnis) {
        if (abgebrochen || !ergebnis) return;
        z.ersatzFertig = true;
        kontext.speichern();
        ton(660, 0.3);
        kontext.fertig();
      }).catch(function (fehler) {
        b.sag('Der Ersatzweg ist gestolpert: ' + (fehler.message || fehler), 'fehler');
      });

      laufendesAufraeumen = function () {
        abgebrochen = true;
        if (loeser) { loeser.anhalten(); z.ersatz.stand = loeser.stand(); kontext.speichern(); }
      };
    }

    // Schon begonnen? Dann gibt es kein Zurück mehr.
    if (z.ersatzFertig) { kontext.fertig(); return function () {}; }
    if (z.ersatz) rechnen();
    else if (z.ersatzFrei) warten();
    else zeigeAngebot();

    return function () { if (laufendesAufraeumen) laufendesAufraeumen(); };
  }

  /* ---------- Winkelwerkzeug ---------- */

  function anzeigeWinkel(beta, gamma) {
    return 'vor/zurück ' + Math.round(beta) + '°, links/rechts ' + Math.round(gamma) + '°';
  }

  /* =====================  WASSERWAAGE  ===================== */

  H.registrieren({
    id: 'wasserwaage',
    dimension: 'konzentration',
    name: 'Wasserwaage',
    kurz: 'Das Gerät waagerecht halten, ohne dass die Libelle ausschlaegt',
    sensor: true,
    sensorBedarf: 'neigung',
    erzeuge: function (zufall, stufe) {
      return {
        sekunden: jitter(zufall, proStufe(stufe, [15, 25, 40, 60, 90]), 0.2),
        toleranz: proStufe(stufe, [8, 6, 4, 3, 2]),
        strafe: strafFaktor(stufe)
      };
    },
    schaetzung: function (p) { return Math.round(p.sekunden * 1.6) + 20; },
    beschreibe: function (p) {
      return util.dauer(p.sekunden) + ' waagerecht halten (±' + p.toleranz + '°)';
    },
    starte: function (kontext) {
      var p = kontext.params;
      var modul = this;
      return mitSensor(kontext, modul, 'neigung', 'Wasserwaage',
        'Leg das Gerät flach auf die Hand und halte es ' + util.dauer(p.sekunden)
        + ' lang innerhalb von ±' + p.toleranz + '°. Kippt es weg, läuft der Fortschritt zurück - doppelt so schnell, wie er steigt.',
        function (b) {
          var dose = el('div', { class: 'libellendose' });
          var blase = el('i', { class: 'libelle' });
          var ring = el('span', { class: 'libellenring' });
          dose.appendChild(ring);
          dose.appendChild(blase);
          b.koerper.appendChild(dose);
          var werte = el('p', { class: 'flaut klein sensorwerte', text: 'warte auf Messwerte ...' });
          b.koerper.appendChild(werte);
          var fortschritt = balken(b.koerper, '');

          var beta = 90, gamma = 90, verstrichen = 0, drin = false;
          var ab = T.sensoren.neigung(function (w) {
            beta = w.beta; gamma = w.gamma;
            /* Eine echte Libelle steigt zur hohen Seite, sie rollt nicht
             * zur tiefen. beta > 0 heisst: Oberkante oben, gamma > 0 heisst:
             * rechte Kante unten. Beide Vorzeichen drehen sich deshalb um. */
            var x = util.grenze(-gamma / 25, -1, 1);
            var y = util.grenze(-beta / 25, -1, 1);
            blase.style.transform = 'translate(' + (x * 46) + 'px,' + (y * 46) + 'px)';
            drin = Math.abs(beta) <= p.toleranz && Math.abs(gamma) <= p.toleranz;
            dose.classList.toggle('ist-mittig', drin);
            werte.textContent = anzeigeWinkel(beta, gamma);
          });

          var stopp = takt(function (delta) {
            verstrichen = util.grenze(verstrichen + (drin ? delta : -delta * 2), 0, p.sekunden);
            fortschritt.setze(verstrichen / p.sekunden);
            fortschritt.text(util.uhrwerk(Math.max(0, p.sekunden - verstrichen)) + ' übrig');
            b.sag(drin ? 'Ruhig so.' : 'Zu schief - es läuft zurück.', drin ? 'gut' : 'fehler');
            if (verstrichen >= p.sekunden) { stopp(); ab(); ton(660, 0.3); kontext.fertig(); }
          });

          return function () { stopp(); ab(); };
        });
    }
  });

  /* =====================  LAGENFOLGE  ===================== */

  /* Die Lagen werden mit CSS gezeichnet statt mit Sonderzeichen: Glyphen wie
   * ▯ oder ◺ fehlen auf vielen Android-Schriften und kämen als leeres
   * Kästchen an. */
  var LAGEN = [
    { id: 'flach', name: 'flach hinlegen',
      passt: function (b, g, t) { return Math.abs(b) <= t && Math.abs(g) <= t; } },
    { id: 'hoch', name: 'aufrecht stellen',
      passt: function (b, g, t) { return Math.abs(b - 72) <= t && Math.abs(g) <= t * 1.5; } },
    { id: 'links', name: 'auf die linke Kante',
      passt: function (b, g, t) { return g <= -(68 - t) && Math.abs(b) <= t * 1.5; } },
    { id: 'rechts', name: 'auf die rechte Kante',
      passt: function (b, g, t) { return g >= 68 - t && Math.abs(b) <= t * 1.5; } },
    { id: 'ruecklage', name: 'nach hinten kippen',
      passt: function (b, g, t) { return Math.abs(b + 55) <= t && Math.abs(g) <= t * 1.5; } }
  ];

  H.registrieren({
    id: 'lagenfolge',
    dimension: 'konzentration',
    name: 'Lagenfolge',
    kurz: 'Das Geraet der Reihe nach in vorgegebene Lagen bringen',
    sensor: true,
    sensorBedarf: 'neigung',
    erzeuge: function (zufall, stufe) {
      var anzahl = proStufe(stufe, [3, 4, 5, 6, 8]);
      var folge = [];
      for (var i = 0; i < anzahl; i++) {
        var naechste;
        do { naechste = zufall.ganz(0, LAGEN.length - 1); } while (folge.length && naechste === folge[folge.length - 1]);
        folge.push(naechste);
      }
      return {
        folge: folge,
        halten: proStufe(stufe, [1.0, 1.2, 1.5, 1.8, 2.2]),
        toleranz: proStufe(stufe, [26, 22, 19, 16, 13]),
        strafe: strafFaktor(stufe)
      };
    },
    schaetzung: function (p) { return Math.round(p.folge.length * (p.halten + 4)) + 20; },
    beschreibe: function (p) { return p.folge.length + ' Lagen nacheinander halten'; },
    starte: function (kontext) {
      var p = kontext.params;
      var modul = this;
      return mitSensor(kontext, modul, 'neigung', 'Lagenfolge',
        'Bring das Gerät der Reihe nach in die angezeigten Lagen und halte jede '
        + p.halten.toFixed(1).replace('.', ',') + ' Sekunden. Die Reihenfolge zählt.',
        function (b) {
          var leiste = el('div', { class: 'lagenleiste' });
          var marken = p.folge.map(function (nummer) {
            var m = el('span', { class: 'lagenmarke', title: LAGEN[nummer].name },
              [el('i', { class: 'lagenbild ist-' + LAGEN[nummer].id })]);
            leiste.appendChild(m);
            return m;
          });
          b.koerper.appendChild(leiste);
          var ziel = el('p', { class: 'lagenziel', text: '' });
          b.koerper.appendChild(ziel);
          var werte = el('p', { class: 'flaut klein sensorwerte', text: 'warte auf Messwerte ...' });
          b.koerper.appendChild(werte);
          var fortschritt = balken(b.koerper, '');

          var schritt = 0, gehalten = 0, beta = 90, gamma = 90;

          function zeigeZiel() {
            marken.forEach(function (m, i) { m.classList.toggle('ist-fertig', i < schritt); });
            marken.forEach(function (m, i) { m.classList.toggle('ist-dran', i === schritt); });
            ziel.textContent = schritt < p.folge.length
              ? (schritt + 1) + '. ' + LAGEN[p.folge[schritt]].name
              : 'fertig';
          }
          zeigeZiel();

          var ab = T.sensoren.neigung(function (w) {
            beta = w.beta; gamma = w.gamma;
            werte.textContent = anzeigeWinkel(beta, gamma);
          });

          var stopp = takt(function (delta) {
            if (schritt >= p.folge.length) return;
            var lage = LAGEN[p.folge[schritt]];
            if (lage.passt(beta, gamma, p.toleranz)) {
              gehalten += delta;
              b.sag('Halten ...', 'gut');
            } else {
              if (gehalten > 0) b.sag('Weggerutscht - diese Lage von vorn.', 'fehler');
              gehalten = 0;
            }
            fortschritt.setze((schritt + Math.min(gehalten / p.halten, 1)) / p.folge.length);
            fortschritt.text(schritt + ' von ' + p.folge.length + ' Lagen');
            if (gehalten >= p.halten) {
              schritt++; gehalten = 0; ton(760, 0.12); zeigeZiel();
              if (schritt >= p.folge.length) { stopp(); ab(); ton(660, 0.3); kontext.fertig(); }
            }
          });

          return function () { stopp(); ab(); };
        });
    }
  });

  /* =====================  SCHRITTE  =====================
   *
   * Es gibt keine Schrittzähler-Schnittstelle im Browser - weder auf Android
   * noch auf iOS. Gezählt wird deshalb selbst: Die Länge des Beschleunigungs-
   * vektors bekommt einen Tiefpass, und jeder Ausschlag darüber ist ein
   * Schrittkandidat. Damit Schütteln nicht zählt, muss der Takt stimmen:
   * Ausschläge unter 260 ms Abstand werden verworfen, und eine Folge mit zu
   * ungleichmäßigem Rhythmus zählt gar nicht. Wasserdicht ist das nicht -
   * wer lange genug gleichmäßig wedelt, kommt durch. Das ist eine
   * Anstrengungsaufgabe, keine Sicherheitsgrenze. */

  var SCHWELLE = 1.6;          // m/s² Abweichung von der geglätteten Länge
  var MIN_ABSTAND = 260;       // ms - schneller geht kein Mensch
  var MAX_ABSTAND = 2200;      // ms - danach gilt der Takt als abgerissen

  H.registrieren({
    id: 'schritte',
    dimension: 'geduld',
    name: 'Schritte',
    kurz: 'Eine Strecke zu Fuss zuruecklegen, das Geraet zaehlt mit',
    sensor: true,
    sensorBedarf: 'bewegung',
    erzeuge: function (zufall, stufe) {
      return {
        schritte: jitter(zufall, proStufe(stufe, [40, 90, 180, 350, 700]), 0.15),
        strafe: strafFaktor(stufe)
      };
    },
    schaetzung: function (p) { return Math.round(p.schritte * 0.7) + 30; },
    beschreibe: function (p) { return p.schritte + ' Schritte gehen'; },
    starte: function (kontext) {
      var p = kontext.params;
      var modul = this;
      return mitSensor(kontext, modul, 'bewegung', 'Schritte',
        'Steck das Gerät ein oder nimm es in die Hand und geh ' + p.schritte
        + ' Schritte. Gezählt wird der Takt deiner Bewegung - Schütteln hilft nicht weiter.',
        function (b) {
          var zaehlwerk = el('p', { class: 'schrittzaehler', text: '0' });
          b.koerper.appendChild(zaehlwerk);
          b.koerper.appendChild(el('p', { class: 'flaut klein', text: 'von ' + p.schritte + ' Schritten' }));
          var fortschritt = balken(b.koerper, '');

          var geglaettet = 9.81, ueber = false, letzterAusschlag = 0;
          var intervalle = [], gezaehlt = 0, verworfen = 0;

          function zaehle(abstand) {
            intervalle.push(abstand);
            if (intervalle.length > 5) intervalle.shift();
            if (intervalle.length >= 3) {
              var mittel = intervalle.reduce(function (s, v) { return s + v; }, 0) / intervalle.length;
              var streuung = Math.sqrt(intervalle.reduce(function (s, v) {
                return s + (v - mittel) * (v - mittel);
              }, 0) / intervalle.length);
              if (streuung / mittel > 0.45) { verworfen++; return; }
            }
            gezaehlt++;
          }

          var ab = T.sensoren.beschleunigung(function (w) {
            var laenge = Math.sqrt(w.x * w.x + w.y * w.y + w.z * w.z);
            geglaettet = geglaettet * 0.9 + laenge * 0.1;
            var ausschlag = laenge - geglaettet;
            var jetzt = performance.now();
            if (!ueber && ausschlag > SCHWELLE) {
              ueber = true;
              var abstand = jetzt - letzterAusschlag;
              if (abstand > MAX_ABSTAND) { intervalle.length = 0; letzterAusschlag = jetzt; return; }
              /* Zu schnell: Der Bezugspunkt rueckt trotzdem mit. Sonst waere
               * schnelles Wedeln billiger als Gehen - jeder dritte Ausschlag
               * haette den Mindestabstand von selbst wieder erreicht. */
              if (abstand < MIN_ABSTAND) { letzterAusschlag = jetzt; verworfen++; return; }
              letzterAusschlag = jetzt;
              zaehle(abstand);
            } else if (ueber && ausschlag < SCHWELLE * 0.4) {
              ueber = false;
            }
          });

          var stopp = takt(function () {
            zaehlwerk.textContent = String(Math.min(gezaehlt, p.schritte));
            fortschritt.setze(gezaehlt / p.schritte);
            fortschritt.text(Math.max(0, p.schritte - gezaehlt) + ' übrig');
            if (verworfen > 4 && gezaehlt < p.schritte) {
              b.sag('Der Takt ist zu unruhig - gleichmäßig gehen zählt besser.', '');
            }
            if (gezaehlt >= p.schritte) { stopp(); ab(); ton(660, 0.3); kontext.fertig(); }
          });

          return function () { stopp(); ab(); };
        });
    }
  });

  T.sensorAufgaben = { ersatzSekunden: ersatzSekunden, LAGEN: LAGEN };
})(typeof window !== 'undefined' ? window : globalThis);
