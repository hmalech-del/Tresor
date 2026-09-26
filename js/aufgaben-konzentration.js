/* Dimension Konzentration: kurze Aufgaben, die volle Aufmerksamkeit brauchen.
 * Nichts davon ist schwer - aber nebenbei geht es nicht. */
(function (global) {
  'use strict';
  var T = global.Tresor;
  var util = T.util, el = util.el;
  var H = T.herausforderungen;
  var W = H.werkzeug;

  H.dimensionRegistrieren({
    id: 'konzentration', name: 'Konzentration',
    beschreibung: 'Simon, N-Back, Stroop, Zahlenjagd - Aufmerksamkeit statt Wissen.',
    fertig: true
  });

  var FARBEN = [
    { id: 'rot', name: 'Rot', ton: 330 },
    { id: 'blau', name: 'Blau', ton: 392 },
    { id: 'gruen', name: 'Grün', ton: 494 },
    { id: 'gelb', name: 'Gelb', ton: 587 }
  ];

  /* ---------- Simon ---------- */

  H.registrieren({
    id: 'simon',
    dimension: 'konzentration',
    name: 'Tonfolge',
    kurz: 'Eine wachsende Folge nachtippen',
    erzeuge: function (zufall, stufe) {
      return {
        laenge: W.proStufe(stufe, [4, 5, 6, 7, 8]),
        tempo: W.proStufe(stufe, [620, 560, 500, 440, 380]),
        saat: zufall.ganz(1, 2000000000)
      };
    },
    schaetzung: function (p) { return Math.round(p.laenge * p.laenge * p.tempo / 1000) + 30; },
    beschreibe: function (p) { return 'Tonfolge aus ' + p.laenge + ' Schritten nachtippen'; },
    starte: function (kontext) {
      var p = kontext.params;
      var zufall = new T.Zufall(p.saat + (Date.now() & 255));
      var b = W.buehne(kontext, 'Tonfolge',
        'Die Folge wächst mit jeder Runde um ein Feld. Sieh zu, dann tippe sie nach.');
      var felder = FARBEN.map(function (farbe) {
        return el('button', { class: 'simonfeld ist-' + farbe.id, type: 'button', 'aria-label': farbe.name });
      });
      b.koerper.appendChild(el('div', { class: 'simongitter' }, felder));
      var fortschritt = W.balken(b.koerper, '0 von ' + p.laenge);

      var folge = [], eingabe = 0, zeigt = false, uhren = [];

      function aufraeumen() { uhren.forEach(clearTimeout); uhren = []; }

      function aufleuchten(index, dauer) {
        felder[index].classList.add('ist-an');
        W.ton(FARBEN[index].ton, 0.18);
        uhren.push(setTimeout(function () { felder[index].classList.remove('ist-an'); }, dauer));
      }

      function zeigeFolge() {
        zeigt = true; eingabe = 0;
        b.sag('Zusehen ...', 'laeuft');
        folge.forEach(function (index, i) {
          uhren.push(setTimeout(function () { aufleuchten(index, p.tempo * 0.55); }, i * p.tempo));
        });
        uhren.push(setTimeout(function () {
          zeigt = false;
          b.sag('Jetzt du.', '');
        }, folge.length * p.tempo + 120));
      }

      function naechsteRunde() {
        aufraeumen();
        folge.push(zufall.ganz(0, FARBEN.length - 1));
        fortschritt.setze((folge.length - 1) / p.laenge);
        fortschritt.text((folge.length - 1) + ' von ' + p.laenge);
        uhren.push(setTimeout(zeigeFolge, 500));
      }

      felder.forEach(function (feld, index) {
        feld.addEventListener('pointerdown', function (e) {
          e.preventDefault();
          if (zeigt) return;
          aufleuchten(index, 180);
          if (folge[eingabe] !== index) {
            aufraeumen();
            b.sag('Falsches Feld. Von vorn.', 'fehler');
            if (kontext.fehlschlag('Tonfolge verhauen.')) return;
            folge = []; eingabe = 0;
            fortschritt.setze(0); fortschritt.text('0 von ' + p.laenge);
            b.tor(naechsteRunde, 'Noch einmal');
            return;
          }
          eingabe++;
          if (eingabe < folge.length) return;
          fortschritt.setze(folge.length / p.laenge);
          fortschritt.text(folge.length + ' von ' + p.laenge);
          if (folge.length >= p.laenge) { aufraeumen(); W.ton(660, 0.3); kontext.fertig(); return; }
          b.sag('Richtig.', 'gut');
          uhren.push(setTimeout(naechsteRunde, 700));
        });
      });

      b.tor(naechsteRunde);
      return aufraeumen;
    }
  });

  /* ---------- N-Back ---------- */

  H.registrieren({
    id: 'nback',
    dimension: 'konzentration',
    name: 'N-Back',
    kurz: 'Wiederholungen im Strom erkennen',
    erzeuge: function (zufall, stufe) {
      var n = W.proStufe(stufe, [1, 1, 2, 2, 3]);
      return {
        n: n,
        laenge: W.proStufe(stufe, [12, 16, 18, 22, 26]),
        treffer: W.proStufe(stufe, [4, 5, 5, 6, 7]),
        tempo: W.proStufe(stufe, [2000, 1800, 1700, 1500, 1400]),
        saat: zufall.ganz(1, 2000000000)
      };
    },
    schaetzung: function (p) { return Math.round(p.laenge * p.tempo / 1000) + 25; },
    beschreibe: function (p) { return p.n + '-Back über ' + p.laenge + ' Zeichen'; },
    starte: function (kontext) {
      var p = kontext.params;
      var zufall = new T.Zufall(p.saat + (Date.now() & 255));
      var zeichen = 'ABCDEFGH'.split('');
      var b = W.buehne(kontext, p.n + '-Back',
        'Tippe immer dann auf „Treffer", wenn der Buchstabe derselbe ist wie '
        + (p.n === 1 ? 'der davor' : p.n + ' Schritte davor') + '. ' + p.treffer + ' Treffer sind nötig, Fehlgriffe setzen zurück.');

      /* Strom bauen, der genau die gewünschte Trefferzahl enthält. */
      function bauStrom() {
        var strom = [], trefferStellen = {};
        var moegliche = [];
        for (var i = p.n; i < p.laenge; i++) moegliche.push(i);
        moegliche = zufall.mische(moegliche).slice(0, p.treffer);
        moegliche.forEach(function (stelle) { trefferStellen[stelle] = true; });
        for (i = 0; i < p.laenge; i++) {
          if (trefferStellen[i]) { strom.push(strom[i - p.n]); continue; }
          var kandidat;
          do { kandidat = zufall.waehle(zeichen); } while (i >= p.n && kandidat === strom[i - p.n]);
          strom.push(kandidat);
        }
        return strom;
      }

      var anzeige = el('div', { class: 'nbackzeichen', text: '·' });
      b.koerper.appendChild(anzeige);
      var knopf = el('button', { class: 'knopf gross haupt', type: 'button', text: 'Treffer' });
      b.koerper.appendChild(knopf);
      var fortschritt = W.balken(b.koerper, '0 von ' + p.treffer);

      var strom = bauStrom(), stelle = -1, treffer = 0, beantwortet = false, uhr = null;

      function neustart(grund) {
        clearInterval(uhr);
        b.sag(grund + ' Von vorn.', 'fehler');
        if (kontext.fehlschlag(grund)) return;
        strom = bauStrom(); stelle = -1; treffer = 0;
        fortschritt.setze(0); fortschritt.text('0 von ' + p.treffer);
        anzeige.textContent = '·';
        b.tor(los, 'Noch einmal');
      }

      function los() {
        clearInterval(uhr);
        b.sag('', '');
        uhr = setInterval(schritt, p.tempo);
      }

      function istTreffer() { return stelle >= p.n && strom[stelle] === strom[stelle - p.n]; }

      function schritt() {
        if (stelle >= 0 && istTreffer() && !beantwortet) { neustart('Treffer verpasst.'); return; }
        stelle++;
        if (stelle >= strom.length) {
          clearInterval(uhr);
          if (treffer >= p.treffer) { W.ton(660, 0.3); kontext.fertig(); }
          else neustart('Zu wenige Treffer.');
          return;
        }
        beantwortet = false;
        anzeige.textContent = strom[stelle];
        anzeige.classList.add('ist-neu');
        setTimeout(function () { anzeige.classList.remove('ist-neu'); }, 180);
      }

      knopf.addEventListener('click', function () {
        if (stelle < 0 || beantwortet) return;
        beantwortet = true;
        if (!istTreffer()) { neustart('Danebengetippt.'); return; }
        treffer++;
        W.ton(620, 0.12);
        fortschritt.setze(treffer / p.treffer);
        fortschritt.text(treffer + ' von ' + p.treffer);
        b.sag('Treffer.', 'gut');
      });

      b.tor(los);
      return function () { clearInterval(uhr); };
    }
  });

  /* ---------- Stroop ---------- */

  H.registrieren({
    id: 'stroop',
    dimension: 'konzentration',
    name: 'Stroop',
    kurz: 'Die Schriftfarbe nennen, nicht das Wort',
    erzeuge: function (zufall, stufe) {
      return {
        runden: W.proStufe(stufe, [6, 8, 10, 12, 15]),
        zeit: W.proStufe(stufe, [4000, 3400, 2800, 2300, 1900]),
        saat: zufall.ganz(1, 2000000000)
      };
    },
    schaetzung: function (p) { return Math.round(p.runden * p.zeit / 1000 * 0.7) + 25; },
    beschreibe: function (p) { return p.runden + ' Stroop-Runden'; },
    starte: function (kontext) {
      var p = kontext.params;
      var zufall = new T.Zufall(p.saat + (Date.now() & 255));
      var b = W.buehne(kontext, 'Stroop',
        'Tippe die Farbe, in der das Wort geschrieben ist - nicht das Wort selbst.');
      var wort = el('div', { class: 'stroopwort', text: '···' });
      b.koerper.appendChild(wort);
      var knoepfe = FARBEN.map(function (farbe) {
        return el('button', { class: 'knopf stroopknopf', type: 'button', text: farbe.name });
      });
      b.koerper.appendChild(el('div', { class: 'stroopzeile' }, knoepfe));
      var fortschritt = W.balken(b.koerper, '0 von ' + p.runden);

      var richtig = 0, tinte = null, uhr = null;

      function neueRunde() {
        clearTimeout(uhr);
        var textFarbe = zufall.ganz(0, FARBEN.length - 1);
        do { tinte = zufall.ganz(0, FARBEN.length - 1); } while (tinte === textFarbe);
        wort.textContent = FARBEN[textFarbe].name.toUpperCase();
        wort.className = 'stroopwort ist-' + FARBEN[tinte].id;
        uhr = setTimeout(function () { daneben('Zu langsam.'); }, p.zeit);
      }

      function daneben(grund) {
        clearTimeout(uhr);
        richtig = 0;
        fortschritt.setze(0); fortschritt.text('0 von ' + p.runden);
        b.sag(grund + ' Von vorn.', 'fehler');
        if (kontext.fehlschlag(grund)) return;
        tinte = null;
        b.tor(neueRunde, 'Noch einmal');
      }

      knoepfe.forEach(function (knopf, index) {
        knopf.addEventListener('click', function () {
          if (tinte === null) return;
          if (index !== tinte) { daneben('Falsche Farbe.'); return; }
          richtig++;
          W.ton(FARBEN[index].ton, 0.1);
          fortschritt.setze(richtig / p.runden);
          fortschritt.text(richtig + ' von ' + p.runden);
          if (richtig >= p.runden) { clearTimeout(uhr); W.ton(660, 0.3); kontext.fertig(); return; }
          neueRunde();
        });
      });

      b.tor(neueRunde);
      return function () { clearTimeout(uhr); };
    }
  });

  /* ---------- Zahlenjagd (Schulte-Tabelle) ---------- */

  H.registrieren({
    id: 'zahlenjagd',
    dimension: 'konzentration',
    name: 'Zahlenjagd',
    kurz: 'Zahlen der Reihe nach finden',
    erzeuge: function (zufall, stufe) {
      var kante = W.proStufe(stufe, [3, 4, 4, 5, 5]);
      return {
        kante: kante,
        sekunden: W.proStufe(stufe, [40, 60, 50, 90, 75]),
        saat: zufall.ganz(1, 2000000000)
      };
    },
    schaetzung: function (p) { return p.sekunden + 20; },
    beschreibe: function (p) { return 'Zahlen 1 bis ' + (p.kante * p.kante) + ' der Reihe nach finden'; },
    starte: function (kontext) {
      var p = kontext.params;
      var zufall = new T.Zufall(p.saat + (Date.now() & 255));
      var anzahl = p.kante * p.kante;
      var b = W.buehne(kontext, 'Zahlenjagd',
        'Tippe 1, 2, 3 ... bis ' + anzahl + ' der Reihe nach an - in ' + util.dauer(p.sekunden) + '.');
      var gitter = el('div', { class: 'zahlengitter' });
      gitter.style.gridTemplateColumns = 'repeat(' + p.kante + ', 1fr)';
      b.koerper.appendChild(gitter);
      var anzeige = el('div', { class: 'countdown', text: util.uhrwerk(p.sekunden) });
      b.koerper.appendChild(anzeige);
      var fortschritt = W.balken(b.koerper, '0 von ' + anzahl);
      var gesucht = 1, rest = p.sekunden, stopp = null;

      function aufbauen() {
        util.leeren(gitter);
        gesucht = 1; rest = p.sekunden;
        fortschritt.setze(0); fortschritt.text('0 von ' + anzahl);
        var zahlen = [];
        for (var i = 1; i <= anzahl; i++) zahlen.push(i);
        zufall.mische(zahlen).forEach(function (zahl) {
          var feld = el('button', { class: 'zahlenfeld', type: 'button', text: String(zahl) });
          feld.addEventListener('pointerdown', function (e) {
            e.preventDefault();
            if (feld.disabled) return;
            if (zahl !== gesucht) {
              b.sag(zahl + ' statt ' + gesucht + '. Von vorn.', 'fehler');
              if (stopp) { stopp(); stopp = null; }
              if (kontext.fehlschlag('Zahl übersprungen.')) return;
              anzeige.textContent = util.uhrwerk(p.sekunden);
              b.tor(los, 'Noch einmal');
              return;
            }
            feld.disabled = true;
            feld.classList.add('ist-weg');
            W.ton(420 + zahl * 12, 0.08);
            gesucht++;
            fortschritt.setze((gesucht - 1) / anzahl);
            fortschritt.text((gesucht - 1) + ' von ' + anzahl);
            if (gesucht > anzahl) { if (stopp) stopp(); W.ton(660, 0.3); kontext.fertig(); }
          });
          gitter.appendChild(feld);
        });
      }

      /* Die Uhr laeuft erst nach "Los", und nach einem Fehler steht das Tor
       * wieder - mit frisch gemischtem Gitter. */
      function los() {
        if (stopp) stopp();
        aufbauen();
        b.sag('', '');
        stopp = W.takt(function (delta) {
          rest -= delta;
          anzeige.textContent = util.uhrwerk(Math.max(0, rest));
          if (rest > 0) return;
          stopp();
          stopp = null;
          b.sag('Zeit vorbei. Von vorn.', 'fehler');
          if (kontext.fehlschlag('Zeit vorbei.')) return;
          b.tor(los, 'Noch einmal');
        });
      }

      aufbauen();
      b.tor(los);
      return function () { if (stopp) stopp(); };
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
