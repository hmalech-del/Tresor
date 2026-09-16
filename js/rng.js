/* Deterministischer Zufall: jeder Tresor bekommt seinen eigenen Strom.
 * Dadurch sind Aufgaben reproduzierbar (Fortschritt überlebt einen Reload),
 * aber zwischen zwei Tresoren nie gleich. */
(function (global) {
  'use strict';
  var T = global.Tresor || (global.Tresor = {});

  function mulberry32(saat) {
    var a = saat >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function Zufall(saat) {
    var naechste = mulberry32(saat);
    this.saat = saat;
    this.zahl = naechste;
  }
  Zufall.prototype.bereich = function (min, max) { return min + this.zahl() * (max - min); };
  Zufall.prototype.ganz = function (min, max) { return Math.floor(this.bereich(min, max + 1)); };
  Zufall.prototype.waehle = function (liste) { return liste[this.ganz(0, liste.length - 1)]; };
  Zufall.prototype.chance = function (p) { return this.zahl() < p; };
  Zufall.prototype.mische = function (liste) {
    var kopie = liste.slice();
    for (var i = kopie.length - 1; i > 0; i--) {
      var j = this.ganz(0, i);
      var merk = kopie[i]; kopie[i] = kopie[j]; kopie[j] = merk;
    }
    return kopie;
  };
  /* Rundet auf sinnvolle "krumme, aber lesbare" Werte */
  Zufall.prototype.stufe = function (min, max, schritt) {
    var stufen = Math.floor((max - min) / schritt);
    return min + this.ganz(0, stufen) * schritt;
  };

  function neueSaat() {
    var b = new Uint32Array(1);
    (global.crypto || global.msCrypto).getRandomValues(b);
    return b[0];
  }

  T.Zufall = Zufall;
  T.neueSaat = neueSaat;
})(typeof window !== 'undefined' ? window : globalThis);
