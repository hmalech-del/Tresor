/* Dimension Logik: Folgen, Lügner, Waage, Mastermind.
 *
 * Folgen, Lügner und Waage sind antwortgebunden - ihre Lösung wird nicht
 * gespeichert. Mastermind braucht den Code zur Laufzeit für die Rückmeldung
 * und ist deshalb nur eine Spielhürde, keine kryptografische. */
(function (global) {
  'use strict';
  var T = global.Tresor;
  var util = T.util, el = util.el;
  var H = T.herausforderungen;
  var W = H.werkzeug;

  H.dimensionRegistrieren({
    id: 'logik', name: 'Logik',
    beschreibung: 'Zahlenfolgen, Lügner, Waage, Mastermind.',
    fertig: true, gebunden: true
  });

  var NAMEN = ['A', 'B', 'C', 'D', 'E'];

  /* ---------- Zahlenfolge ---------- */

  H.registrieren({
    id: 'zahlenfolge',
    dimension: 'logik',
    antwortGebunden: true,
    name: 'Zahlenfolge',
    kurz: 'Die Folge um ein Glied weiterführen',
    normalisiere: function (text) { return String(text).replace(/[^0-9-]/g, ''); },
    erzeuge: function (zufall, stufe) {
      var regeln = [
        function () {                                   // arithmetisch
          var a = zufall.ganz(2, 40), d = zufall.ganz(3, 19);
          return { folge: function (i) { return a + d * i; }, art: 'arithmetisch' };
        },
        function () {                                   // geometrisch
          var a = zufall.ganz(2, 9), q = zufall.ganz(2, 3);
          return { folge: function (i) { return a * Math.pow(q, i); }, art: 'geometrisch' };
        },
        function () {                                   // alternierende Schritte
          var a = zufall.ganz(5, 30), auf = zufall.ganz(4, 15), ab = zufall.ganz(1, 9);
          return { folge: function (i) { return a + Math.ceil(i / 2) * auf - Math.floor(i / 2) * ab; }, art: 'alternierend' };
        },
        function () {                                   // quadratisch
          var k = zufall.ganz(1, 5), c = zufall.ganz(0, 12);
          return { folge: function (i) { return (i + k) * (i + k) + c; }, art: 'quadratisch' };
        },
        function () {                                   // Summe der beiden Vorgänger
          var a = zufall.ganz(1, 9), b = zufall.ganz(2, 12);
          var werte = [a, b];
          return { folge: function (i) { while (werte.length <= i) werte.push(werte[werte.length - 1] + werte[werte.length - 2]); return werte[i]; }, art: 'summierend' };
        },
        function () {                                   // verdoppeln und addieren
          var a = zufall.ganz(1, 7), c = zufall.ganz(1, 9);
          var werte = [a];
          return { folge: function (i) { while (werte.length <= i) werte.push(werte[werte.length - 1] * 2 + c); return werte[i]; }, art: 'verdoppelnd' };
        }
      ];
      var auswahl = stufe <= 2 ? regeln.slice(0, 3) : stufe <= 3 ? regeln.slice(0, 5) : regeln;
      var regel = zufall.waehle(auswahl)();
      var gezeigt = W.proStufe(stufe, [5, 5, 5, 4, 4]);
      var glieder = [];
      for (var i = 0; i < gezeigt; i++) glieder.push(regel.folge(i));
      return { glieder: glieder, loesung: String(regel.folge(gezeigt)) };
    },
    schaetzung: function (p) { return 120; },
    beschreibe: function (p) { return 'Zahlenfolge ' + p.glieder.slice(0, 3).join(', ') + ', … fortsetzen'; },
    starte: function (kontext) {
      var p = kontext.params;
      var b = W.buehne(kontext, 'Zahlenfolge', 'Welche Zahl kommt als nächste?');
      b.koerper.appendChild(el('div', { class: 'folge' }, p.glieder.map(function (zahl) {
        return el('span', { class: 'folgeglied', text: String(zahl) });
      }).concat([el('span', { class: 'folgeglied ist-gesucht', text: '?' })])));
      W.antwortFeld(kontext, b.koerper, 'Das nächste Glied', { platzhalter: 'Zahl', ziffern: true });
      return function () {};
    }
  });

  /* ---------- Lügner und Wahrheitssager ---------- */

  H.registrieren({
    id: 'luegner',
    dimension: 'logik',
    antwortGebunden: true,
    name: 'Lügner',
    kurz: 'Herausfinden, wer die Wahrheit sagt',
    normalisiere: function (text) {
      return String(text).toLowerCase().replace(/[^a-e]/g, '').split('').sort().filter(function (z, i, a) { return a.indexOf(z) === i; }).join('');
    },
    erzeuge: function (zufall, stufe) {
      var anzahl = W.proStufe(stufe, [3, 3, 4, 4, 5]);
      for (var versuch = 0; versuch < 80; versuch++) {
        var wahrheit = [];
        for (var i = 0; i < anzahl; i++) wahrheit.push(zufall.chance(0.5));
        if (!wahrheit.some(Boolean)) continue;                 // mindestens einer sagt die Wahrheit
        var luegner = wahrheit.filter(function (w) { return !w; }).length;

        var aussagen = [];
        for (i = 0; i < anzahl; i++) {
          var ueber = (i + zufall.ganz(1, anzahl - 1)) % anzahl;
          aussagen.push({ art: 'ueber', wer: i, ueber: ueber, sagtWahr: wahrheit[i] ? wahrheit[ueber] : !wahrheit[ueber] });
        }
        /* Aussagen nur übereinander sind immer doppeldeutig: die komplett
         * gespiegelte Belegung passt genauso. Eine Zählaussage bricht die
         * Symmetrie. */
        var zaehler = zufall.ganz(0, anzahl - 1);
        var behauptet = luegner;
        if (!wahrheit[zaehler]) {
          do { behauptet = zufall.ganz(0, anzahl); } while (behauptet === luegner);
        }
        aussagen[zaehler] = { art: 'anzahl', wer: zaehler, k: behauptet };

        function passtZu(kandidat) {
          return aussagen.every(function (a) {
            var stimmt = a.art === 'anzahl'
              ? kandidat.filter(function (w) { return !w; }).length === a.k
              : kandidat[a.ueber] === a.sagtWahr;
            return kandidat[a.wer] ? stimmt : !stimmt;
          });
        }

        var loesungen = [];
        for (var maske = 0; maske < (1 << anzahl); maske++) {
          var kandidat = [];
          for (i = 0; i < anzahl; i++) kandidat.push(!!(maske & (1 << i)));
          if (passtZu(kandidat)) loesungen.push(kandidat);
        }
        if (loesungen.length !== 1) continue;
        var wahr = loesungen[0];
        if (!wahr.some(Boolean)) continue;

        return {
          anzahl: anzahl,
          aussagen: aussagen.map(function (a) {
            return a.art === 'anzahl'
              ? NAMEN[a.wer] + ' sagt: „Genau ' + a.k + ' von uns ' + (a.k === 1 ? 'lügt' : 'lügen') + '.“'
              : NAMEN[a.wer] + ' sagt: „' + NAMEN[a.ueber] + ' ' + (a.sagtWahr ? 'sagt die Wahrheit' : 'lügt') + '.“';
          }),
          loesung: wahr.map(function (w, i) { return w ? NAMEN[i].toLowerCase() : ''; }).join('')
        };
      }
      return null;
    },
    schaetzung: function (p) { return 90 + p.anzahl * 45; },
    beschreibe: function (p) { return p.anzahl + ' Personen, wer sagt die Wahrheit?'; },
    starte: function (kontext) {
      var p = kontext.params;
      var b = W.buehne(kontext, 'Lügner',
        'Wer die Wahrheit sagt, sagt immer die Wahrheit; wer lügt, lügt immer. Genau eine Verteilung passt.');
      b.koerper.appendChild(el('ul', { class: 'aussagen' }, p.aussagen.map(function (text) {
        return el('li', { text: text });
      })));
      W.antwortFeld(kontext, b.koerper, 'Wer sagt die Wahrheit? (Buchstaben, z. B. AC)', { platzhalter: 'z. B. AC' });
      return function () {};
    }
  });

  /* ---------- Waage ---------- */

  H.registrieren({
    id: 'waage',
    dimension: 'logik',
    antwortGebunden: true,
    name: 'Waage',
    kurz: 'Aus Gleichungen einen Wert erschließen',
    normalisiere: function (text) { return String(text).replace(/[^0-9-]/g, ''); },
    erzeuge: function (zufall, stufe) {
      var zeichen = ['◆', '▲', '●'];
      var hoechstwert = W.proStufe(stufe, [6, 8, 9, 12, 15]);
      for (var versuch = 0; versuch < 60; versuch++) {
        var werte = zeichen.map(function () { return zufall.ganz(1, hoechstwert); });
        function kombi() {
          var k = [zufall.ganz(0, 2), zufall.ganz(0, 2)];
          if (zufall.chance(0.45)) k.push(zufall.ganz(0, 2));
          return k;
        }
        var gleichungen = [kombi(), kombi(), kombi()].slice(0, W.proStufe(stufe, [2, 3, 3, 3, 3]));
        var frage = kombi();
        var beschreibungen = gleichungen.map(function (k) {
          return k.map(function (i) { return zeichen[i]; }).join(' + ') + ' = ' + k.reduce(function (s, i) { return s + werte[i]; }, 0);
        });
        var antwort = frage.reduce(function (s, i) { return s + werte[i]; }, 0);
        // einstellige Antworten hätten einen lächerlich kleinen Ratebereich
        if (antwort < 10) continue;
        // Eindeutigkeit: liefert jede passende Belegung denselben Fragewert?
        var eindeutig = true;
        for (var a = 1; a <= hoechstwert && eindeutig; a++) {
          for (var b2 = 1; b2 <= hoechstwert && eindeutig; b2++) {
            for (var c = 1; c <= hoechstwert; c++) {
              var kandidat = [a, b2, c];
              var passt = gleichungen.every(function (k, index) {
                return k.reduce(function (s, i) { return s + kandidat[i]; }, 0)
                  === gleichungen[index].reduce(function (s, i) { return s + werte[i]; }, 0);
              });
              if (passt && frage.reduce(function (s, i) { return s + kandidat[i]; }, 0) !== antwort) { eindeutig = false; break; }
            }
          }
        }
        if (!eindeutig) continue;
        return {
          gleichungen: beschreibungen,
          frage: frage.map(function (i) { return zeichen[i]; }).join(' + '),
          loesung: String(antwort)
        };
      }
      return null;
    },
    schaetzung: function (p) { return 80 + p.gleichungen.length * 40; },
    beschreibe: function (p) { return 'Waage: ' + p.frage + ' bestimmen'; },
    starte: function (kontext) {
      var p = kontext.params;
      var b = W.buehne(kontext, 'Waage', 'Jedes Zeichen steht für eine feste ganze Zahl.');
      b.koerper.appendChild(el('ul', { class: 'gleichungen' }, p.gleichungen.map(function (text) {
        return el('li', { text: text });
      })));
      b.koerper.appendChild(el('div', { class: 'frage', text: p.frage + ' = ?' }));
      W.antwortFeld(kontext, b.koerper, 'Der gesuchte Wert', { platzhalter: 'Zahl', ziffern: true });
      return function () {};
    }
  });

  /* ---------- Mastermind ---------- */

  H.registrieren({
    id: 'mastermind',
    dimension: 'logik',
    spielhuerde: true,          // Code muss gespeichert werden - nicht schlüsselbindend
    name: 'Mastermind',
    kurz: 'Zahlencode aus Rückmeldungen erschließen',
    erzeuge: function (zufall, stufe) {
      var laenge = W.proStufe(stufe, [3, 4, 4, 4, 5]);
      var farben = W.proStufe(stufe, [5, 6, 6, 7, 8]);
      var code = [];
      for (var i = 0; i < laenge; i++) code.push(zufall.ganz(1, farben));
      return { code: code.join(''), farben: farben, versuche: W.proStufe(stufe, [10, 10, 9, 8, 8]) };
    },
    schaetzung: function (p) { return 180 + p.code.length * 40; },
    beschreibe: function (p) { return p.code.length + '-stelliger Code aus ' + p.farben + ' Ziffern'; },
    starte: function (kontext) {
      var p = kontext.params;
      var laenge = p.code.length;
      var b = W.buehne(kontext, 'Mastermind',
        laenge + ' Stellen, Ziffern 1 bis ' + p.farben + '. ● richtige Ziffer an richtiger Stelle, ○ richtige Ziffer an falscher Stelle.');
      var liste = el('ul', { class: 'mastermind-liste' });
      b.koerper.appendChild(liste);
      var feld = el('input', {
        type: 'text', class: 'antwortfeld', inputmode: 'numeric', maxlength: String(laenge),
        placeholder: new Array(laenge + 1).join('1'), autocomplete: 'off'
      });
      var knopf = el('button', { class: 'knopf', type: 'button', text: 'Raten' });
      b.koerper.appendChild(el('div', { class: 'antwortzeile' }, [feld, knopf]));
      var uebrig = p.versuche;
      b.sag(uebrig + ' Versuche übrig.');

      function raten() {
        var wert = feld.value.replace(/\D/g, '');
        if (wert.length !== laenge) { b.sag('Bitte ' + laenge + ' Ziffern eingeben.', 'fehler'); return; }
        if (wert.split('').some(function (z) { return Number(z) < 1 || Number(z) > p.farben; })) {
          b.sag('Nur Ziffern von 1 bis ' + p.farben + '.', 'fehler'); return;
        }
        var code = p.code.split(''), versuch = wert.split('');
        var schwarz = 0, weiss = 0, restCode = [], restVersuch = [];
        code.forEach(function (z, i) {
          if (versuch[i] === z) schwarz++; else { restCode.push(z); restVersuch.push(versuch[i]); }
        });
        restVersuch.forEach(function (z) {
          var index = restCode.indexOf(z);
          if (index !== -1) { weiss++; restCode.splice(index, 1); }
        });
        liste.appendChild(el('li', {}, [
          el('span', { class: 'mastermind-code', text: wert }),
          el('span', { class: 'mastermind-wertung', text: new Array(schwarz + 1).join('●') + new Array(weiss + 1).join('○') || '–' })
        ]));
        feld.value = ''; feld.focus();
        if (schwarz === laenge) { W.ton(660, 0.3); kontext.fertig(); return; }
        uebrig--;
        if (uebrig <= 0) {
          b.sag('Versuche aufgebraucht - von vorn, derselbe Code.', 'fehler');
          uebrig = p.versuche;
          util.leeren(liste);
          if (kontext.fehlschlag('Code nicht geknackt.')) return;
          b.sag(uebrig + ' Versuche übrig.');
          return;
        }
        b.sag(uebrig + ' Versuche übrig.');
      }
      knopf.addEventListener('click', raten);
      feld.addEventListener('keydown', function (e) { if (e.key === 'Enter') raten(); });
      setTimeout(function () { feld.focus(); }, 50);
      return function () {};
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
