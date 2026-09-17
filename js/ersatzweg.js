/* Der Ersatzweg.
 *
 * Manche Aufgaben brauchen etwas, das nicht jedes Gerät hat: Lagesensoren,
 * ein NFC-Lesegerät. Gebunden wird dabei nie an ein bestimmtes Gerät - ein
 * Browser hat keine stabile Kennung, und eine Marke im Speicher läge genau
 * dort, wo auch der Tresor liegt. Gebunden wird an die Fähigkeit.
 *
 * Fehlt sie, wird die Aufgabe nicht übersprungen, sondern durch Aufwand
 * ersetzt. Der muss wehtun, sonst wäre ein Gerät ohne die Fähigkeit die
 * bequemste Abkürzung durch den ganzen Tresor. Bezahlt wird in Rechenzeit -
 * der einzigen Währung dieser App, die sich nicht durch Vorstellen der
 * Geräteuhr fälschen lässt. Ohne Rechenzeit bleibt nur Wartezeit; in jenem
 * Modus hängt aber ohnehin alles an der Uhr. */
(function (global) {
  'use strict';
  var T = global.Tresor || (global.Tresor = {});
  var util = T.util;
  var el = util.el;
  var werkzeug = T.herausforderungen.werkzeug;
  var balken = werkzeug.balken;
  var takt = werkzeug.takt;
  var ton = werkzeug.ton;
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
      b.koerper.appendChild(el('p', { class: 'wachterwort', text: T.stimme.sag('ersatz') }));
      b.koerper.appendChild(el('p', { text: 'Ersatzweg: ' + util.dauer(sekunden)
        + (mitRechenzeit ? ' rechnen.' : ' warten.')
        + ' Deutlich teurer als die Prüfung selbst. So ist das gedacht.' }));
      var los = el('button', { class: 'knopf gross haupt', type: 'button',
        text: mitRechenzeit ? 'Ersatz beginnen (' + util.dauer(sekunden) + ' rechnen)'
                            : 'Ersatz beginnen (' + util.dauer(sekunden) + ' warten)' });
      var erneut = el('button', { class: 'knopf', type: 'button', text: 'Sensor noch einmal prüfen' });
      b.koerper.appendChild(el('div', { class: 'knopfzeile' }, [los, erneut]));
      b.koerper.appendChild(el('p', { class: 'flaut klein', text: 'Einmal begonnen, kein Zurück.' }));
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
      b.koerper.appendChild(el('p', { text: 'Warte es ab. Die App darf zu.' }));
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
      b.koerper.appendChild(el('p', { text: 'Rechne es ab. Läuft, solange der Tab offen ist.' }));
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

  T.ersatzweg = {
    strafFaktor: strafFaktor,
    ersatzSekunden: ersatzSekunden,
    ersatzBuehne: ersatzBuehne
  };
})(typeof window !== 'undefined' ? window : globalThis);
