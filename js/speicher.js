/* Ablage im Browser. Der Tresor liegt hier nur verschlüsselt. */
(function (global) {
  'use strict';
  var T = global.Tresor || (global.Tresor = {});
  var SCHLUESSEL = 'tresor.v1';
  var ZULETZT = 'tresor.zuletzt-benutzt';

  function laden() {
    try {
      var roh = global.localStorage.getItem(SCHLUESSEL);
      return roh ? JSON.parse(roh) : null;
    } catch (fehler) { return null; }
  }

  function sichern(tresor) {
    try { global.localStorage.setItem(SCHLUESSEL, JSON.stringify(tresor)); return true; }
    catch (fehler) { return false; }
  }

  function loeschen() {
    try { global.localStorage.removeItem(SCHLUESSEL); } catch (fehler) {}
  }

  /* Merkt sich zuletzt verwendete Aufgabentypen über Tresore hinweg,
   * damit der nächste Tresor sich nicht gleich anfühlt. */
  function zuletztBenutzt() {
    try { return JSON.parse(global.localStorage.getItem(ZULETZT) || '[]'); }
    catch (fehler) { return []; }
  }

  function merkeBenutzt(ids) {
    try {
      var alt = zuletztBenutzt();
      global.localStorage.setItem(ZULETZT, JSON.stringify(ids.concat(alt).slice(0, 12)));
    } catch (fehler) {}
  }

  T.speicher = {
    laden: laden, sichern: sichern, loeschen: loeschen,
    zuletztBenutzt: zuletztBenutzt, merkeBenutzt: merkeBenutzt
  };
})(typeof window !== 'undefined' ? window : globalThis);
