/* =====================  DIMENSION: ORT  =====================
 *
 * Eine Aufgabe, die weder Zeit noch Konzentration kostet, sondern Weg:
 * Irgendwo in der Wohnung klebt eine NFC-Marke, und ohne sie geht das
 * Fragment nicht auf.
 *
 * Der Reiz entsteht durch die Menge. NFC-Marken kosten im Zehnerpack ein
 * paar Euro, also verteilt man sie: hinter dem Bücherregal, im Keller, unter
 * der Fensterbank. Beim Einrichten bekommt jede Marke ein eigenes
 * Zufallsgeheimnis, und jedes Fragment wird an genau eine davon gebunden -
 * an welche, sagt die App nicht. Das Suchen ist die Aufgabe.
 *
 * Kryptografisch ist das dasselbe wie eine Rätselantwort: Das Geheimnis der
 * Marke geht in den Fragmentschlüssel ein, gespeichert wird nur ein
 * PBKDF2-Prüfwert. Ohne die richtige Marke gibt es den Schlüssel nicht - das
 * ist keine Oberflächenhürde, die sich wegklicken liesse.
 *
 * Ehrlich dazu: Ein NDEF-Satz lässt sich von jeder NFC-App auslesen. Wer die
 * Marke in der Hand hat, hat ihr Geheimnis. Das schützt also gegen den
 * eigenen Impuls und gegen Gelegenheitszugriff, nicht gegen jemanden, der
 * sich in der Wohnung umsehen darf. */
(function (global) {
  'use strict';
  var T = global.Tresor || (global.Tresor = {});
  var util = T.util;
  var el = util.el;
  var H = T.herausforderungen;
  var werkzeug = H.werkzeug;
  var buehne = werkzeug.buehne;
  var ton = werkzeug.ton;
  var strafFaktor = T.ersatzweg.strafFaktor;
  var ersatzBuehne = T.ersatzweg.ersatzBuehne;

  /* Die frisch beschriebenen Stationsgeheimnisse - nur während des
   * Verriegelns gefüllt.
   *
   * Warum nicht über die Konfiguration? Weil die Konfiguration im Tresor
   * landet und damit im Speicher des Browsers. Die Geheimnisse dürfen dort
   * nie stehen: Sie sind der Schlüssel. Sie gehen als `params.loesung` in den
   * Aufgabenplan, der sie nach dem Hashen selbst wieder löscht. */
  var vorrat = [];

  function vorratSetzen(geheimnisse) { vorrat = (geheimnisse || []).slice(); }
  function vorratLeeren() { vorrat = []; }

  H.registrieren({
    id: 'station',
    dimension: 'ort',
    name: 'Station',
    kurz: 'Eine bestimmte NFC-Marke in der Wohnung finden und antippen',
    nfc: true,
    antwortGebunden: true,
    normalisiere: function (text) { return String(text || '').trim(); },
    erzeuge: function (zufall, stufe) {
      if (!vorrat.length) return null;          // ohne beschriebene Marken keine Station
      return {
        loesung: vorrat[zufall.ganz(0, vorrat.length - 1)],
        stationen: vorrat.length,
        strafe: strafFaktor(stufe)
      };
    },
    /* Suchaufwand: Im Mittel muss die Hälfte der Stationen abgeklappert
     * werden, und jede kostet einen Gang durch die Wohnung. */
    schaetzung: function (p) { return Math.round(45 + (p.stationen || 2) * 35); },
    beschreibe: function (p) {
      return 'Eine von ' + (p.stationen || 2) + ' Stationen finden';
    },
    starte: function (kontext) {
      var p = kontext.params;
      var modul = this;
      var b = buehne(kontext, 'Station',
        'Eine deiner ' + (p.stationen || 2) + ' Marken öffnet das. Welche, sage ich nicht. Lauf.');
      var innen = null, lebt = true;

      function raeumeInnen() { if (innen) { innen(); innen = null; } }

      if (!T.nfc.moeglich()) {
        innen = ersatzBuehne(kontext, b, modul, T.nfc.grundText(), function () {
          if (!lebt) return;
          raeumeInnen();
          util.leeren(b.koerper);
          suchen();
        });
        return function () { lebt = false; raeumeInnen(); };
      }

      suchen();
      return function () { lebt = false; raeumeInnen(); };

      function suchen() {
        util.leeren(b.koerper);
        var welle = el('div', { class: 'nfcwelle' }, [
          el('i'), el('i'), el('i'),
          el('span', { class: 'nfcmarke', text: '◉' })
        ]);
        b.koerper.appendChild(welle);
        var zaehler = el('p', { class: 'flaut mittig-text', text: '' });
        b.koerper.appendChild(zaehler);
        b.sag('Halte das Gerät an eine Marke.', '');

        var gesehen = kontext.zustand.gesehen || {};
        function zaehlerSchreiben() {
          var anzahl = Object.keys(gesehen).length;
          zaehler.textContent = anzahl
            ? anzahl + (anzahl === 1 ? ' Marke' : ' Marken') + ' abgeklappert, keine davon war es'
            : 'noch keine Marke berührt';
        }
        zaehlerSchreiben();

        var pruefeLaeuft = false;
        var abbrechen = T.nfc.lesen(function (marke) {
          if (pruefeLaeuft) return;
          if (!marke.text) {
            b.sag('Das ist keine deiner Marken - da steht nichts drauf.', 'fehler');
            return;
          }
          pruefeLaeuft = true;
          welle.classList.add('ist-pruefend');
          kontext.pruefeAntwort(marke.text).then(function (richtig) {
            pruefeLaeuft = false;
            welle.classList.remove('ist-pruefend');
            if (richtig) { ton(660, 0.3); return; }     // die App blendet die Aufgabe ab
            /* Falsche Marken kosten nichts: Das Abklappern ist der Weg, nicht
             * der Fehler. Gezählt wird trotzdem, damit man sieht, wie weit
             * man ist. */
            gesehen[marke.kennung || marke.text.slice(-8)] = true;
            kontext.zustand.gesehen = gesehen;
            kontext.speichern();
            zaehlerSchreiben();
            b.sag('Nicht diese. Weitersuchen.', 'fehler');
          });
        }, function (fehler) {
          b.sag('NFC geht hier nicht: ' + (fehler.message || fehler), 'fehler');
          raeumeInnen();
          innen = ersatzBuehne(kontext, b, modul, T.nfc.grundText(), function () {
            raeumeInnen(); util.leeren(b.koerper); suchen();
          });
        });

        innen = function () { abbrechen(); };
      }
    }
  });

  H.dimensionRegistrieren({
    id: 'ort',
    name: 'Ort',
    beschreibung: 'Hingehen müssen: NFC-Marken, irgendwo in der Wohnung.',
    fertig: true,
    nfc: true
  });

  T.ortAufgaben = { vorratSetzen: vorratSetzen, vorratLeeren: vorratLeeren,
    vorratGroesse: function () { return vorrat.length; } };
})(typeof window !== 'undefined' ? window : globalThis);
