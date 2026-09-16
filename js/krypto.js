/* Verschlüsselung der Fragmente.
 *
 * Jede Ziffer liegt einzeln als AES-GCM-Chiffrat im Speicher. Der Schlüssel
 * dazu existiert nirgends - er entsteht erst, wenn das Zeitschloss gelöst ist:
 *
 *     schluessel_i = SHA-256( "tresor-fragment" | i | b_i )
 *
 * b_i ist die Lösung des Zeitschlosses für Fragment i. Beim Verriegeln kennt
 * der Erzeuger die Abkürzung und wirft sie danach weg; ab da führt der einzige
 * Weg zu b_i über die sequentielle Rechenarbeit. */
(function (global) {
  'use strict';
  var T = global.Tresor || (global.Tresor = {});
  var util = T.util;
  var subtle = (global.crypto && global.crypto.subtle) || null;

  function textBytes(text) { return new TextEncoder().encode(text); }

  function verbinde() {
    var teile = Array.prototype.slice.call(arguments);
    var laenge = teile.reduce(function (summe, t) { return summe + t.length; }, 0);
    var ergebnis = new Uint8Array(laenge), pos = 0;
    teile.forEach(function (t) { ergebnis.set(t, pos); pos += t.length; });
    return ergebnis;
  }

  async function sha256(bytes) {
    return new Uint8Array(await subtle.digest('SHA-256', bytes));
  }

  async function fragmentSchluessel(index, bHex) {
    var roh = await sha256(verbinde(textBytes('tresor-fragment|' + index + '|'), util.hexZuBytes(bHex)));
    return subtle.importKey('raw', roh, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }

  async function verschluesseln(index, bHex, klartext) {
    var schluessel = await fragmentSchluessel(index, bHex);
    var iv = new Uint8Array(12);
    global.crypto.getRandomValues(iv);
    var chiffrat = new Uint8Array(await subtle.encrypt(
      { name: 'AES-GCM', iv: iv, additionalData: textBytes('fragment' + index) },
      schluessel, textBytes(klartext)
    ));
    return { iv: util.bytesZuHex(iv), ct: util.bytesZuHex(chiffrat) };
  }

  async function entschluesseln(index, bHex, paket) {
    var schluessel = await fragmentSchluessel(index, bHex);
    var klar = await subtle.decrypt(
      { name: 'AES-GCM', iv: util.hexZuBytes(paket.iv), additionalData: textBytes('fragment' + index) },
      schluessel, util.hexZuBytes(paket.ct)
    );
    return new TextDecoder().decode(klar);
  }

  T.krypto = {
    sha256: sha256,
    verschluesseln: verschluesseln,
    entschluesseln: entschluesseln,
    verfuegbar: function () { return !!subtle; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
