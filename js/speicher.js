/* Ablage im Browser. Der Tresor liegt hier nur verschlüsselt. */
(function (global) {
  'use strict';
  var T = global.Tresor || (global.Tresor = {});
  var SCHLUESSEL = 'tresor.v1';
  var ZULETZT = 'tresor.zuletzt-benutzt';
  var ARCHIV = 'tresor.archiv.v1';
  var ARCHIV_MAX = 12;

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

  /* ---------------- Verlauf ----------------
   * Geöffnete Tresore wandern hierher, damit ein geschlossener Tab oder ein
   * neuer Tresor das Ergebnis nicht mitnimmt. Was hier liegt, ist bewusst
   * unverschlüsselt - der Tresor war ja offen. */

  function archivLaden() {
    try { return JSON.parse(global.localStorage.getItem(ARCHIV) || '[]'); }
    catch (fehler) { return []; }
  }

  function archivSichern(liste) {
    try { global.localStorage.setItem(ARCHIV, JSON.stringify(liste)); return true; }
    catch (fehler) { return false; }
  }

  function archivErgaenzen(eintrag) {
    var liste = archivLaden().filter(function (alt) { return alt.id !== eintrag.id; });
    liste.unshift(eintrag);
    while (liste.length > ARCHIV_MAX) liste.pop();
    // Bilder sind groß: notfalls ältere Einträge opfern, statt gar nichts zu sichern
    while (liste.length && !archivSichern(liste)) liste.pop();
    return liste.length > 0;
  }

  function archivLoeschen(id) {
    archivSichern(archivLaden().filter(function (eintrag) { return eintrag.id !== id; }));
  }

  function platzbedarf() {
    var summe = 0;
    try {
      for (var i = 0; i < global.localStorage.length; i++) {
        var name = global.localStorage.key(i);
        if (name.indexOf('tresor.') !== 0) continue;
        summe += (global.localStorage.getItem(name) || '').length;
      }
    } catch (fehler) {}
    return summe;
  }

  T.speicher = {
    laden: laden, sichern: sichern, loeschen: loeschen,
    zuletztBenutzt: zuletztBenutzt, merkeBenutzt: merkeBenutzt,
    archivLaden: archivLaden, archivErgaenzen: archivErgaenzen,
    archivLoeschen: archivLoeschen, platzbedarf: platzbedarf
  };
})(typeof window !== 'undefined' ? window : globalThis);
