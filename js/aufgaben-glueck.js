/* Dimension Glück: Aufgaben, die man nicht besser kann, nur aushalten.
 * Der Erwartungswert ist bekannt, der Einzelfall nicht - zusammen mit
 * Strafzeiten wird daraus eine Geduldsprobe mit offenem Ausgang. */
(function (global) {
  'use strict';
  var T = global.Tresor;
  var util = T.util, el = util.el;
  var H = T.herausforderungen;
  var W = H.werkzeug;

  H.dimensionRegistrieren({
    id: 'glueck', name: 'Glück',
    beschreibung: 'Würfel, Münzen, Glücksrad - Können hilft hier nicht.',
    fertig: true
  });

  function zufallAus(params) {
    return new T.Zufall(params.saat + (Date.now() & 1023));
  }

  H.registrieren({
    id: 'wuerfel',
    dimension: 'glueck',
    name: 'Würfelserie',
    kurz: 'Eine Serie hoher Würfe schaffen',
    erzeuge: function (zufall, stufe) {
      var wuerfel = stufe >= 4 ? 2 : 1;
      var schwelle = wuerfel === 2 ? W.proStufe(stufe, [7, 8, 9, 9, 10]) : W.proStufe(stufe, [4, 5, 5, 6, 6]);
      return {
        wuerfel: wuerfel, schwelle: schwelle,
        serie: W.proStufe(stufe, [2, 2, 3, 3, 4]),
        saat: zufall.ganz(1, 2000000000)
      };
    },
    schaetzung: function (p) {
      var treffer = p.wuerfel === 1 ? (7 - p.schwelle) / 6 : anteilZweiWuerfel(p.schwelle);
      var versuche = (Math.pow(1 / treffer, p.serie) - 1) / (1 / treffer - 1);
      return Math.round(versuche * 3.5) + 10;
    },
    beschreibe: function (p) {
      return p.serie + '× hintereinander ' + (p.wuerfel === 2 ? 'zwei Würfel ≥ ' : 'Würfel ≥ ') + p.schwelle;
    },
    starte: function (kontext) {
      var p = kontext.params, zufall = zufallAus(p);
      var b = W.buehne(kontext, 'Würfelserie',
        'Du brauchst ' + p.serie + ' Würfe in Folge mit ' + (p.wuerfel === 2 ? 'Augensumme ' : '') + '≥ ' + p.schwelle
        + '. Ein schlechter Wurf setzt die Serie zurück.');
      var wuerfelReihe = el('div', { class: 'wuerfelreihe' });
      for (var i = 0; i < p.wuerfel; i++) wuerfelReihe.appendChild(el('div', { class: 'wuerfel', text: '?' }));
      b.koerper.appendChild(wuerfelReihe);
      var knopf = el('button', { class: 'knopf gross haupt', type: 'button', text: 'Würfeln' });
      b.koerper.appendChild(knopf);
      var fortschritt = W.balken(b.koerper, '0 von ' + p.serie);
      var serie = 0, rollt = false;

      knopf.addEventListener('click', function () {
        if (rollt) return;
        rollt = true; knopf.disabled = true;
        var schritte = 12, augen = [];
        var animation = setInterval(function () {
          augen = [];
          for (var i = 0; i < p.wuerfel; i++) augen.push(zufall.ganz(1, 6));
          Array.prototype.forEach.call(wuerfelReihe.children, function (w, i) { w.textContent = augen[i]; });
          if (--schritte > 0) return;
          clearInterval(animation);
          rollt = false; knopf.disabled = false;
          var summe = augen.reduce(function (s, a) { return s + a; }, 0);
          if (summe >= p.schwelle) {
            serie++;
            W.ton(620, 0.12);
            fortschritt.setze(serie / p.serie); fortschritt.text(serie + ' von ' + p.serie);
            b.sag(summe + ' - Treffer.', 'gut');
            if (serie >= p.serie) { W.ton(660, 0.3); kontext.fertig(); }
          } else {
            serie = 0;
            fortschritt.setze(0); fortschritt.text('0 von ' + p.serie);
            b.sag(summe + ' - zu wenig, Serie zurückgesetzt.', 'fehler');
            kontext.fehlschlag('Serie gerissen.');
          }
        }, 60);
      });

      return function () {};
    }
  });

  function anteilZweiWuerfel(schwelle) {
    var treffer = 0;
    for (var a = 1; a <= 6; a++) for (var b = 1; b <= 6; b++) if (a + b >= schwelle) treffer++;
    return treffer / 36;
  }

  H.registrieren({
    id: 'muenze',
    dimension: 'glueck',
    name: 'Münzserie',
    kurz: 'Mehrere Münzwürfe hintereinander richtig raten',
    erzeuge: function (zufall, stufe) {
      return { serie: W.proStufe(stufe, [2, 3, 4, 5, 6]), saat: zufall.ganz(1, 2000000000) };
    },
    schaetzung: function (p) { return Math.round((Math.pow(2, p.serie + 1) - 2) * 3) + 10; },
    beschreibe: function (p) { return p.serie + ' Münzwürfe in Folge richtig raten'; },
    starte: function (kontext) {
      var p = kontext.params, zufall = zufallAus(p);
      var b = W.buehne(kontext, 'Münzserie',
        'Rate ' + p.serie + ' Würfe hintereinander richtig. Ein Fehler beginnt die Serie von vorn.');
      var muenze = el('div', { class: 'muenze', text: '?' });
      b.koerper.appendChild(muenze);
      var wahl = el('div', { class: 'wahlzeile' }, [
        el('button', { class: 'knopf', type: 'button', text: 'Kopf' }),
        el('button', { class: 'knopf', type: 'button', text: 'Zahl' })
      ]);
      b.koerper.appendChild(wahl);
      var fortschritt = W.balken(b.koerper, '0 von ' + p.serie);
      var serie = 0, laeuft = false;

      Array.prototype.forEach.call(wahl.children, function (knopf, index) {
        knopf.addEventListener('click', function () {
          if (laeuft) return;
          laeuft = true;
          var schritte = 10;
          var animation = setInterval(function () {
            muenze.textContent = zufall.chance(0.5) ? 'K' : 'Z';
            if (--schritte > 0) return;
            clearInterval(animation);
            laeuft = false;
            var ergebnis = zufall.chance(0.5) ? 0 : 1;
            muenze.textContent = ergebnis === 0 ? 'K' : 'Z';
            if (ergebnis === index) {
              serie++;
              W.ton(620, 0.12);
              fortschritt.setze(serie / p.serie); fortschritt.text(serie + ' von ' + p.serie);
              b.sag('Richtig geraten.', 'gut');
              if (serie >= p.serie) { W.ton(660, 0.3); kontext.fertig(); }
            } else {
              serie = 0;
              fortschritt.setze(0); fortschritt.text('0 von ' + p.serie);
              b.sag('Daneben - Serie beginnt neu.', 'fehler');
              kontext.fehlschlag('Falsch geraten.');
            }
          }, 55);
        });
      });

      return function () {};
    }
  });

  H.registrieren({
    id: 'lotterie',
    dimension: 'glueck',
    name: 'Ziehung',
    kurz: 'Unter verdeckten Karten die richtige finden',
    erzeuge: function (zufall, stufe) {
      return {
        karten: W.proStufe(stufe, [4, 6, 9, 12, 16]),
        treffer: W.proStufe(stufe, [1, 1, 2, 2, 3]),
        saat: zufall.ganz(1, 2000000000)
      };
    },
    schaetzung: function (p) { return Math.round(p.treffer * (p.karten + 1) / 2 * 6) + 10; },
    beschreibe: function (p) { return p.treffer + '× die richtige aus ' + p.karten + ' Karten ziehen'; },
    starte: function (kontext) {
      var p = kontext.params, zufall = zufallAus(p);
      var b = W.buehne(kontext, 'Ziehung',
        'Eine der ' + p.karten + ' Karten gewinnt. ' + p.treffer + ' Treffer sind nötig; nach jedem Versuch wird neu gemischt.');
      var tisch = el('div', { class: 'kartentisch' });
      b.koerper.appendChild(tisch);
      var fortschritt = W.balken(b.koerper, '0 von ' + p.treffer);
      var treffer = 0, gewinn = zufall.ganz(0, p.karten - 1), gesperrt = false;

      function neuMischen() {
        gewinn = zufall.ganz(0, p.karten - 1);
        util.leeren(tisch);
        for (var i = 0; i < p.karten; i++) {
          (function (index) {
            var karte = el('button', { class: 'spielkarte', type: 'button', text: '?' });
            karte.addEventListener('click', function () {
              if (gesperrt) return;
              gesperrt = true;
              if (index === gewinn) {
                karte.classList.add('ist-gewinn'); karte.textContent = '★';
                treffer++;
                W.ton(660, 0.15);
                fortschritt.setze(treffer / p.treffer); fortschritt.text(treffer + ' von ' + p.treffer);
                b.sag('Treffer.', 'gut');
                if (treffer >= p.treffer) { kontext.fertig(); return; }
              } else {
                karte.classList.add('ist-niete'); karte.textContent = '·';
                tisch.children[gewinn].classList.add('ist-gewinn');
                tisch.children[gewinn].textContent = '★';
                b.sag('Niete.', 'fehler');
                if (kontext.fehlschlag('Niete gezogen.')) return;
              }
              setTimeout(function () { gesperrt = false; neuMischen(); }, 900);
            });
            tisch.appendChild(karte);
          })(i);
        }
      }
      neuMischen();
      return function () {};
    }
  });

  H.registrieren({
    id: 'gluecksrad',
    dimension: 'glueck',
    name: 'Glücksrad',
    kurz: 'Drehen, bis das Rad freigibt',
    erzeuge: function (zufall, stufe) {
      return {
        felder: W.proStufe(stufe, [4, 6, 8, 10, 12]),
        frei: 1,
        saat: zufall.ganz(1, 2000000000)
      };
    },
    schaetzung: function (p) { return Math.round(p.felder * 7) + 10; },
    beschreibe: function (p) { return 'Glücksrad mit ' + p.felder + ' Feldern, eines gibt frei'; },
    starte: function (kontext) {
      var p = kontext.params, zufall = zufallAus(p);
      var b = W.buehne(kontext, 'Glücksrad',
        'Eines von ' + p.felder + ' Feldern gibt frei. Alle anderen bedeuten: noch einmal.');
      var rad = el('div', { class: 'rad' }, [el('span', { class: 'radzeiger', text: '▲' })]);
      var felder = el('div', { class: 'radfelder' });
      for (var i = 0; i < p.felder; i++) {
        felder.appendChild(el('span', { class: 'radfeld' + (i === 0 ? ' ist-frei' : ''), text: i === 0 ? 'FREI' : String(i) }));
      }
      rad.appendChild(felder);
      b.koerper.appendChild(rad);
      var knopf = el('button', { class: 'knopf gross haupt', type: 'button', text: 'Drehen' });
      b.koerper.appendChild(knopf);
      var dreht = false;

      knopf.addEventListener('click', function () {
        if (dreht) return;
        dreht = true; knopf.disabled = true;
        var ziel = zufall.ganz(0, p.felder - 1);
        var schritt = 0, gesamt = p.felder * 2 + ziel + 1, verzoegerung = 45;
        function weiter() {
          var index = schritt % p.felder;
          Array.prototype.forEach.call(felder.children, function (feld, i) {
            feld.classList.toggle('ist-aktiv', i === index);
          });
          schritt++;
          if (schritt <= gesamt) {
            verzoegerung += schritt > gesamt - p.felder ? 22 : 0;
            setTimeout(weiter, verzoegerung);
            return;
          }
          dreht = false; knopf.disabled = false;
          if (ziel === 0) { W.ton(660, 0.3); b.sag('Frei.', 'gut'); kontext.fertig(); }
          else { b.sag('Feld ' + ziel + ' - noch einmal.', 'fehler'); kontext.fehlschlag('Rad nicht frei.'); }
        }
        weiter();
      });

      return function () {};
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
