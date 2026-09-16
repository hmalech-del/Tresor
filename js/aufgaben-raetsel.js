/* Dimension Rätsel: Chiffren, Anagramme, Morse, Zahlenrätsel.
 *
 * Alle vier sind antwortgebunden: die Lösung wird beim Verriegeln NICHT
 * gespeichert, sie geht in die Schlüsselableitung des Fragments ein.
 * Wer raten will, zahlt pro Versuch eine PBKDF2-Ableitung. */
(function (global) {
  'use strict';
  var T = global.Tresor;
  var util = T.util, el = util.el;
  var H = T.herausforderungen;
  var W = H.werkzeug;

  H.dimensionRegistrieren({
    id: 'raetsel', name: 'Rätsel',
    beschreibung: 'Chiffren, Anagramme, Morse, Zahlenrätsel - Antwort geht in den Schlüssel ein.',
    fertig: true, gebunden: true
  });

  var ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
  var MORSE = {
    a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....', i: '..', j: '.---',
    k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-',
    u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..'
  };

  function wort(zufall, minLaenge, maxLaenge) {
    var vorrat = T.woerter.filter(function (w) { return w.length >= minLaenge && w.length <= maxLaenge; });
    return zufall.waehle(vorrat.length ? vorrat : T.woerter);
  }

  function nurBuchstaben(text) { return String(text).toLowerCase().replace(/[^a-zäöüß]/g, ''); }

  function verschieben(text, um) {
    return text.split('').map(function (zeichen) {
      var index = ALPHABET.indexOf(zeichen);
      return index === -1 ? zeichen : ALPHABET.charAt((index + um + 26) % 26);
    }).join('');
  }

  H.registrieren({
    id: 'caesar',
    dimension: 'raetsel',
    antwortGebunden: true,
    name: 'Verschiebechiffre',
    kurz: 'Ein verschobenes Wort zurückdrehen',
    normalisiere: nurBuchstaben,
    erzeuge: function (zufall, stufe) {
      var loesung = wort(zufall, W.proStufe(stufe, [5, 5, 6, 7, 7]), W.proStufe(stufe, [6, 7, 8, 9, 10]));
      var um = zufall.ganz(1, 25);
      return {
        chiffre: verschieben(loesung, um).toUpperCase(),
        hilfe: stufe <= 2 ? um : null,
        loesung: loesung
      };
    },
    schaetzung: function (p) { return p.hilfe === null ? 240 : 90; },
    beschreibe: function (p) { return 'Verschiebechiffre „' + p.chiffre + '“'; },
    starte: function (kontext) {
      var p = kontext.params;
      var b = W.buehne(kontext, 'Verschiebechiffre',
        p.hilfe === null
          ? 'Jeder Buchstabe wurde um dieselbe Zahl im Alphabet weitergeschoben. Welches Wort steckt dahinter?'
          : 'Jeder Buchstabe wurde um ' + p.hilfe + ' Stellen weitergeschoben.');
      b.koerper.appendChild(el('div', { class: 'chiffre', text: p.chiffre }));
      b.koerper.appendChild(el('p', { class: 'flaut klein', text: 'a b c d e f g h i j k l m n o p q r s t u v w x y z' }));
      W.antwortFeld(kontext, b.koerper, 'Das Wort im Klartext', { platzhalter: 'Wort' });
      return function () {};
    }
  });

  H.registrieren({
    id: 'morse',
    dimension: 'raetsel',
    antwortGebunden: true,
    name: 'Morsezeichen',
    kurz: 'Ein gemorstes Wort entziffern',
    normalisiere: nurBuchstaben,
    erzeuge: function (zufall, stufe) {
      var loesung = wort(zufall, W.proStufe(stufe, [4, 5, 5, 6, 7]), W.proStufe(stufe, [5, 6, 7, 8, 9]));
      return {
        code: loesung.split('').map(function (z) { return MORSE[z] || '?'; }).join(' '),
        tabelle: stufe <= 3,
        loesung: loesung
      };
    },
    schaetzung: function (p) { return p.tabelle ? 150 : 300; },
    beschreibe: function (p) { return 'Morsezeichen entziffern (' + p.code.split(' ').length + ' Buchstaben)'; },
    starte: function (kontext) {
      var p = kontext.params;
      var b = W.buehne(kontext, 'Morsezeichen', 'Punkt und Strich, Leerzeichen trennt die Buchstaben.');
      b.koerper.appendChild(el('div', { class: 'morse', text: p.code }));
      if (p.tabelle) {
        b.koerper.appendChild(el('div', { class: 'morsetabelle' }, Object.keys(MORSE).map(function (buchstabe) {
          return el('span', {}, [el('b', { text: buchstabe }), ' ' + MORSE[buchstabe]]);
        })));
      }
      W.antwortFeld(kontext, b.koerper, 'Das gemorste Wort', { platzhalter: 'Wort' });
      return function () {};
    }
  });

  H.registrieren({
    id: 'anagramm',
    dimension: 'raetsel',
    antwortGebunden: true,
    name: 'Anagramm',
    kurz: 'Buchstabensalat entwirren',
    normalisiere: nurBuchstaben,
    erzeuge: function (zufall, stufe) {
      var loesung = wort(zufall, W.proStufe(stufe, [5, 6, 6, 7, 8]), W.proStufe(stufe, [6, 7, 8, 9, 10]));
      var gemischt = loesung;
      var versuche = 0;
      while (gemischt === loesung && versuche++ < 20) gemischt = zufall.mische(loesung.split('')).join('');
      return {
        salat: gemischt.toUpperCase(),
        anfang: stufe <= 2 ? loesung.charAt(0).toUpperCase() : null,
        loesung: loesung
      };
    },
    schaetzung: function (p) { return p.anfang ? 100 : 180; },
    beschreibe: function (p) { return 'Anagramm „' + p.salat + '“'; },
    starte: function (kontext) {
      var p = kontext.params;
      var b = W.buehne(kontext, 'Anagramm',
        'Dieselben Buchstaben, andere Reihenfolge.' + (p.anfang ? ' Das gesuchte Wort beginnt mit „' + p.anfang + '“.' : ''));
      b.koerper.appendChild(el('div', { class: 'chiffre', text: p.salat.split('').join(' ') }));
      W.antwortFeld(kontext, b.koerper, 'Das richtige Wort', { platzhalter: 'Wort' });
      return function () {};
    }
  });

  /* Zahlenrätsel: Bedingungen werden so lange gesammelt, bis genau eine Zahl
   * übrig bleibt. Gespeichert werden nur die Bedingungen. */
  H.registrieren({
    id: 'zahlenraetsel',
    dimension: 'raetsel',
    antwortGebunden: true,
    name: 'Zahlenrätsel',
    kurz: 'Die einzige Zahl finden, auf die alles passt',
    normalisiere: function (text) { return String(text).replace(/\D/g, ''); },
    erzeuge: function (zufall, stufe) {
      var stellen = W.proStufe(stufe, [3, 3, 4, 4, 4]);
      var von = Math.pow(10, stellen - 1), bis = Math.pow(10, stellen) - 1;
      var alle = [];
      for (var n = von; n <= bis; n++) alle.push(n);

      function ziffern(n) { return String(n).split('').map(Number); }
      function quersumme(n) { return ziffern(n).reduce(function (s, z) { return s + z; }, 0); }

      var ziel = zufall.ganz(von, bis);
      var zielZiffern = ziffern(ziel);
      var spanne = Math.max(12, Math.round((bis - von) / zufall.ganz(6, 20)));
      var spanneVon = Math.max(von, ziel - zufall.ganz(1, spanne));
      var spanneBis = Math.min(bis, spanneVon + spanne);
      if (spanneBis < ziel) spanneBis = Math.min(bis, ziel + 1);
      var moeglich = [
        { text: 'Die Quersumme ist ' + quersumme(ziel) + '.', pruef: function (n) { return quersumme(n) === quersumme(ziel); } },
        { text: 'Die Zahl liegt zwischen ' + spanneVon + ' und ' + spanneBis + '.', pruef: function (n) { return n >= spanneVon && n <= spanneBis; } },
        { text: 'Die Summe der ersten beiden Ziffern ist ' + (zielZiffern[0] + zielZiffern[1]) + '.', pruef: function (n) { var z = ziffern(n); return z[0] + z[1] === zielZiffern[0] + zielZiffern[1]; } },
        { text: 'Keine Ziffer kommt doppelt vor.', pruef: function (n) { return new Set(ziffern(n)).size === stellen; }, nurWenn: new Set(zielZiffern).size === stellen },
        { text: 'Alle Ziffern sind verschieden und steigen von links nach rechts.', pruef: function (n) { var z = ziffern(n); return z.every(function (w, i) { return i === 0 || w > z[i - 1]; }); }, nurWenn: zielZiffern.every(function (w, i) { return i === 0 || w > zielZiffern[i - 1]; }) },
        { text: 'Die Zahl ist durch ' + (ziel % 7 === 0 ? 7 : ziel % 3 === 0 ? 3 : 2) + ' teilbar.', pruef: (function () { var teiler = ziel % 7 === 0 ? 7 : ziel % 3 === 0 ? 3 : 2; return function (n) { return n % teiler === 0; }; })(), nurWenn: ziel % 2 === 0 || ziel % 3 === 0 || ziel % 7 === 0 },
        { text: 'Die Zahl ist ' + (ziel % 2 ? 'ungerade' : 'gerade') + '.', pruef: function (n) { return n % 2 === ziel % 2; } },
        { text: 'Das Produkt der Ziffern ist ' + zielZiffern.reduce(function (s, z) { return s * z; }, 1) + '.', pruef: function (n) { return ziffern(n).reduce(function (s, z) { return s * z; }, 1) === zielZiffern.reduce(function (s, z) { return s * z; }, 1); } },
        { text: 'Die größte Ziffer ist ' + Math.max.apply(null, zielZiffern) + '.', pruef: function (n) { return Math.max.apply(null, ziffern(n)) === Math.max.apply(null, zielZiffern); } },
        { text: 'Die Zahl ist ' + (ziel > (von + bis) / 2 ? 'größer' : 'kleiner') + ' als ' + Math.round((von + bis) / 2) + '.', pruef: function (n) { return ziel > (von + bis) / 2 ? n > Math.round((von + bis) / 2) : n < Math.round((von + bis) / 2); } }
      ].filter(function (bedingung) { return bedingung.nurWenn !== false; });

      // Stellen-Bedingungen zuletzt: sie sind die stumpfsten, retten aber die Eindeutigkeit
      var stellenNamen = ['erste', 'zweite', 'dritte', 'vierte', 'fünfte'];
      var stellenBedingungen = zielZiffern.map(function (ziffer, stelle) {
        return {
          text: 'Die ' + stellenNamen[stelle] + ' Ziffer ist ' + ziffer + '.',
          pruef: function (n) { return ziffern(n)[stelle] === ziffer; }
        };
      });

      var gewaehlt = [], rest = alle;
      var vorrat = zufall.mische(moeglich).concat(zufall.mische(stellenBedingungen));
      for (var i = 0; i < vorrat.length && rest.length > 1; i++) {
        var neu = rest.filter(vorrat[i].pruef);
        if (neu.length === rest.length || !neu.length) continue;   // bringt nichts
        rest = neu;
        gewaehlt.push(vorrat[i].text);
      }
      if (rest.length !== 1) return null;                          // kein eindeutiges Rätsel
      return { stellen: stellen, bedingungen: gewaehlt, loesung: String(rest[0]) };
    },
    schaetzung: function (p) { return 60 + p.bedingungen.length * 45; },
    beschreibe: function (p) { return p.stellen + '-stellige Zahl aus ' + p.bedingungen.length + ' Bedingungen'; },
    starte: function (kontext) {
      var p = kontext.params;
      var b = W.buehne(kontext, 'Zahlenrätsel',
        'Genau eine ' + p.stellen + '-stellige Zahl erfüllt alle Bedingungen.');
      b.koerper.appendChild(el('ul', { class: 'bedingungen' }, p.bedingungen.map(function (text) {
        return el('li', { text: text });
      })));
      W.antwortFeld(kontext, b.koerper, 'Die gesuchte Zahl', { platzhalter: p.stellen + '-stellig', ziffern: true });
      return function () {};
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
