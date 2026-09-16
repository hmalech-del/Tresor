/* Verschlüsselung der Fragmente.
 *
 * Jede Ziffer liegt einzeln als AES-GCM-Chiffrat im Speicher. Der Schlüssel
 * dazu existiert nirgends - er entsteht erst, wenn das Zeitschloss gelöst ist:
 *
 *     schluessel_i = SHA-256( "tresor-fragment" | i | b_i )
 *
 * b_i ist die Lösung des Zeitschlosses für Fragment i. Beim Verriegeln kennt
 * der Erzeuger die Abkürzung und wirft sie danach weg; ab da führt der einzige
 * Weg zu b_i über die sequentielle Rechenarbeit.
 *
 * Kommen antwortgebundene Aufgaben dazu, wächst der Schlüssel um ein zweites
 * Geheimnis:
 *
 *     schluessel_i = SHA-256( "tresor-fragment" | i | b_i | material_i )
 *     material_i   = PBKDF2-SHA256( antworten_i, salz_i, N Runden )
 *
 * Die Antworten werden beim Verriegeln nicht gespeichert - nur ein Prüfwert
 * mit eigenem Salz. Wer raten will, zahlt pro Versuch eine volle
 * PBKDF2-Ableitung; der Raum der möglichen Antworten multipliziert sich über
 * alle gebundenen Aufgaben eines Fragments. */
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

  var ITERATIONEN = 400000;

  /* PBKDF2-SHA256: macht jeden Rateversuch spürbar teuer. */
  async function ableiten(text, salzHex, iterationen, bytes) {
    var basis = await subtle.importKey('raw', textBytes(text), { name: 'PBKDF2' }, false, ['deriveBits']);
    var roh = await subtle.deriveBits({
      name: 'PBKDF2', salt: util.hexZuBytes(salzHex), iterations: iterationen || ITERATIONEN, hash: 'SHA-256'
    }, basis, (bytes || 32) * 8);
    return new Uint8Array(roh);
  }

  function neuesSalz() {
    var salz = new Uint8Array(16);
    global.crypto.getRandomValues(salz);
    return util.bytesZuHex(salz);
  }

  /* Prüfwert für eine einzelne Antwort - eigenes Salz, damit er nichts über
   * das Schlüsselmaterial verrät. */
  async function antwortPruefung(antwort, salzHex, iterationen) {
    return util.bytesZuHex(await ableiten('pruefung|' + antwort, salzHex, iterationen, 16));
  }

  /* Schlüsselmaterial aus allen Antworten eines Fragments. */
  async function antwortMaterial(antworten, salzHex, iterationen) {
    if (!antworten || !antworten.length) return new Uint8Array(0);
    return ableiten('material|' + antworten.join('\u001f'), salzHex, iterationen, 32);
  }

  async function fragmentSchluessel(index, bHex, material) {
    var roh = await sha256(verbinde(
      textBytes('tresor-fragment|' + index + '|'),
      util.hexZuBytes(bHex),
      material || new Uint8Array(0)
    ));
    return subtle.importKey('raw', roh, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }

  async function verschluesseln(index, bHex, klartext, material) {
    var schluessel = await fragmentSchluessel(index, bHex, material);
    var iv = new Uint8Array(12);
    global.crypto.getRandomValues(iv);
    var chiffrat = new Uint8Array(await subtle.encrypt(
      { name: 'AES-GCM', iv: iv, additionalData: textBytes('fragment' + index) },
      schluessel, textBytes(klartext)
    ));
    return { iv: util.bytesZuHex(iv), ct: util.bytesZuHex(chiffrat) };
  }

  async function entschluesseln(index, bHex, paket, material) {
    var schluessel = await fragmentSchluessel(index, bHex, material);
    var klar = await subtle.decrypt(
      { name: 'AES-GCM', iv: util.hexZuBytes(paket.iv), additionalData: textBytes('fragment' + index) },
      schluessel, util.hexZuBytes(paket.ct)
    );
    return new TextDecoder().decode(klar);
  }

  T.krypto = {
    sha256: sha256,
    ableiten: ableiten,
    neuesSalz: neuesSalz,
    antwortPruefung: antwortPruefung,
    antwortMaterial: antwortMaterial,
    verschluesseln: verschluesseln,
    entschluesseln: entschluesseln,
    ITERATIONEN: ITERATIONEN,
    verfuegbar: function () { return !!subtle; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
