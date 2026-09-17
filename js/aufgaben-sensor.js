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

  var strafFaktor = T.ersatzweg.strafFaktor;
  var ersatzSekunden = T.ersatzweg.ersatzSekunden;
  var ersatzBuehne = T.ersatzweg.ersatzBuehne;

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
        'Flach in die Hand. ' + util.dauer(p.sekunden) + ' innerhalb von ±' + p.toleranz
        + '°. Wackelst du, verlierst du doppelt so schnell, wie du gewinnst.',
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
        'Der Reihe nach. Jede Lage ' + p.halten.toFixed(1).replace('.', ',') + ' Sekunden halten.',
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
    schaetzung: function (p) { return Math.round(p.schritte * 0.8) + 45; },
    beschreibe: function (p) { return p.schritte + ' Schritte gehen'; },
    starte: function (kontext) {
      var p = kontext.params;
      var modul = this;
      return mitSensor(kontext, modul, 'bewegung', 'Schritte',
        p.schritte + ' Schritte. Bildschirm an, Gerät in der Hand - ich zähle nur, was ich sehe. '
        + 'Und ich zähle den Takt, nicht die Ausschläge: Schütteln erkenne ich.',
        function (b) {
          var zaehlwerk = el('p', { class: 'schrittzaehler', text: '0' });
          b.koerper.appendChild(zaehlwerk);
          b.koerper.appendChild(el('p', { class: 'flaut klein', text: 'von ' + p.schritte + ' Schritten' }));
          var fortschritt = balken(b.koerper, '');

          var geglaettet = 9.81, ueber = false, letzterAusschlag = 0;
          var intervalle = [], verworfen = 0, gesichert = 0;
          var gezaehlt = kontext.zustand.stand || 0;

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
            if (gezaehlt !== gesichert) {
              gesichert = gezaehlt;
              kontext.zustand.stand = gezaehlt;
              kontext.speichern();
            }
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

  /* =====================  RUHIGE HAND  =====================
   *
   * Ein Gerät, das auf dem Tisch liegt, leistet nichts - das wäre eine
   * Aufgabe, die man aussitzt. Verlangt wird deshalb das Gegenteil: Es muss
   * in der Hand liegen und trotzdem ruhig bleiben.
   *
   * Unterscheiden lässt sich das an der Streuung der Beschleunigung über ein
   * gleitendes Fenster. Ein liegendes Gerät misst fast nur Sensorrauschen,
   * eine ruhige Hand zittert messbar darüber, und jede echte Bewegung schlägt
   * weit darüber aus. Gefordert ist also ein Band, keine Untergrenze:
   * oberhalb des Tisches, unterhalb der Bewegung. Dazu darf die Neigung nicht
   * wegdriften - sonst wäre "in die Tasche stecken und stehenbleiben" die
   * Lösung. */

  var HAND_UNTEN = 0.045;      // darunter liegt es auf etwas
  var HAND_FENSTER = 40;       // Messwerte im gleitenden Fenster (gut 1 s)
  var HAND_DRIFT = 22;         // Grad, die die Neigung insgesamt wandern darf

  H.registrieren({
    id: 'ruhigehand',
    dimension: 'geduld',
    name: 'Ruhige Hand',
    kurz: 'Das Geraet in der Hand halten und ruhig bleiben - abgelegt zaehlt nicht',
    sensor: true,
    sensorBedarf: 'bewegung',
    erzeuge: function (zufall, stufe) {
      return {
        sekunden: jitter(zufall, proStufe(stufe, [20, 40, 75, 130, 210]), 0.2),
        obergrenze: proStufe(stufe, [0.85, 0.65, 0.5, 0.38, 0.28]),
        strafe: strafFaktor(stufe)
      };
    },
    schaetzung: function (p) { return Math.round(p.sekunden * 1.7) + 25; },
    beschreibe: function (p) { return util.dauer(p.sekunden) + ' ruhig in der Hand halten'; },
    starte: function (kontext) {
      var p = kontext.params;
      var modul = this;
      return mitSensor(kontext, modul, 'bewegung', 'Ruhige Hand',
        'In die Hand, ' + util.dauer(p.sekunden) + ' ruhig halten. Ablegen zählt nicht - '
        + 'ich kenne den Unterschied zwischen einer Hand und einem Tisch.',
        function (b) {
          var skala = el('div', { class: 'ruheskala' }, [
            el('span', { class: 'ruhezone' }),
            el('i', { class: 'ruhezeiger' })
          ]);
          b.koerper.appendChild(skala);
          b.koerper.appendChild(el('div', { class: 'ruhebeschriftung flaut klein' }, [
            el('span', { text: 'abgelegt' }),
            el('span', { text: 'ruhige Hand' }),
            el('span', { text: 'Bewegung' })
          ]));
          var zeiger = skala.querySelector('.ruhezeiger');
          var zone = skala.querySelector('.ruhezone');
          // Die Zone sitzt zwischen Unter- und Obergrenze; die Skala reicht
          // bis zum Doppelten der Obergrenze.
          var spanne = p.obergrenze * 2;
          zone.style.left = (HAND_UNTEN / spanne * 100) + '%';
          zone.style.width = ((p.obergrenze - HAND_UNTEN) / spanne * 100) + '%';

          var fortschritt = balken(b.koerper, '');
          var fenster = [], verstrichen = 0, drin = false, grund = '';
          var beta0 = null, gamma0 = null, beta = 0, gamma = 0;

          var abNeigung = T.sensoren.neigung(function (w) {
            beta = w.beta; gamma = w.gamma;
            if (beta0 === null) { beta0 = beta; gamma0 = gamma; }
          });

          var abBewegung = T.sensoren.beschleunigung(function (w) {
            fenster.push(Math.sqrt(w.x * w.x + w.y * w.y + w.z * w.z));
            if (fenster.length > HAND_FENSTER) fenster.shift();
            if (fenster.length < HAND_FENSTER) return;

            var mittel = fenster.reduce(function (s, v) { return s + v; }, 0) / fenster.length;
            var streuung = Math.sqrt(fenster.reduce(function (s, v) {
              return s + (v - mittel) * (v - mittel);
            }, 0) / fenster.length);

            zeiger.style.left = util.grenze(streuung / spanne, 0, 1) * 100 + '%';
            var gedriftet = beta0 !== null
              && (Math.abs(beta - beta0) > HAND_DRIFT || Math.abs(gamma - gamma0) > HAND_DRIFT);

            if (streuung < HAND_UNTEN) { drin = false; grund = 'Das liegt auf etwas. In die Hand nehmen.'; }
            else if (streuung > p.obergrenze) { drin = false; grund = 'Zu unruhig.'; }
            else if (gedriftet) { drin = false; grund = 'Die Neigung wandert weg - ruhig halten, nicht mitgehen.'; }
            else { drin = true; grund = ''; }
            skala.classList.toggle('ist-gut', drin);
          });

          var stopp = takt(function (delta) {
            verstrichen = util.grenze(verstrichen + (drin ? delta : -delta * 2), 0, p.sekunden);
            fortschritt.setze(verstrichen / p.sekunden);
            fortschritt.text(util.uhrwerk(Math.max(0, p.sekunden - verstrichen)) + ' übrig');
            if (fenster.length < HAND_FENSTER) { b.sag('Messe ein ...', ''); return; }
            b.sag(drin ? 'Genau so. Nicht nachlassen.' : grund, drin ? 'gut' : 'fehler');
            if (verstrichen >= p.sekunden) { stopp(); abNeigung(); abBewegung(); ton(660, 0.3); kontext.fertig(); }
          });

          return function () { stopp(); abNeigung(); abBewegung(); };
        });
    }
  });

  T.sensorAufgaben = { ersatzSekunden: ersatzSekunden, LAGEN: LAGEN, HAND_UNTEN: HAND_UNTEN };
})(typeof window !== 'undefined' ? window : globalThis);
