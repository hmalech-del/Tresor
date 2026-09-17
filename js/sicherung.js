/* Sicherung: den ganzen Tresor als Datei aus- und wieder einlesen.
 *
 * Gesichert wird der Tresor so, wie er ist - Aufgaben samt Parametern,
 * Zeitschlösser, Chiffrate, Rechenfortschritt, Sperrfristen. Beim Einlesen
 * wird nichts neu gewürfelt und nichts neu gewählt: Wer sich beim Import
 * neue Aufgaben aussuchen dürfte, könnte sich einen bequemen Satz bestellen
 * und wäre in einer Minute durch.
 *
 * Zwei Dinge sind dabei wichtig genug, um sie in der Oberfläche zu sagen:
 *
 *   - Bereits geöffnete Fragmente stehen im Klartext in der Datei. Eine
 *     Sicherung ist also genau so geheim wie der Fortschritt, den sie enthält.
 *     Deshalb ist die Verschlüsselung mit Passphrase der Normalfall.
 *   - Die Datei lässt sich von Hand ändern. Das Zeitschloss und alle
 *     antwortgebundenen Aufgaben überstehen das (ohne Schlüsselmaterial gibt
 *     es keine Entschlüsselung), die übrigen Aufgaben nicht. Das gilt aber
 *     genauso für den Browser-Speicher - die Sicherung macht es nicht
 *     schlimmer. Die Prüfsumme fängt Übertragungsfehler, keine Absicht. */
(function (global) {
  'use strict';
  var T = global.Tresor || (global.Tresor = {});
  var util = T.util;
  var FORMAT = 'tresor-sicherung';
  var VERSION = 1;

  function textBytes(text) { return new TextEncoder().encode(text); }

  async function schluesselAus(passphrase, salzHex, iterationen) {
    var roh = await T.krypto.ableiten('sicherung|' + passphrase, salzHex, iterationen, 32);
    return global.crypto.subtle.importKey('raw', roh, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }

  async function exportieren(optionen) {
    var inhalt = { tresor: optionen.tresor };
    if (optionen.mitVerlauf) inhalt.verlauf = T.speicher.archivLaden();
    var klartext = JSON.stringify(inhalt);

    var kopf = { format: FORMAT, version: VERSION, erstellt: Date.now() };

    if (!optionen.passphrase) {
      kopf.verschluesselt = false;
      kopf.pruefsumme = util.bytesZuHex(await T.krypto.sha256(textBytes(klartext)));
      kopf.inhalt = inhalt;
      return JSON.stringify(kopf, null, 1);
    }

    var salz = T.krypto.neuesSalz();
    var iterationen = T.krypto.ITERATIONEN;
    var schluessel = await schluesselAus(optionen.passphrase, salz, iterationen);
    var iv = new Uint8Array(12);
    global.crypto.getRandomValues(iv);
    var chiffrat = new Uint8Array(await global.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv, additionalData: textBytes(FORMAT) },
      schluessel, textBytes(klartext)
    ));
    kopf.verschluesselt = true;
    kopf.kdf = { salz: salz, iterationen: iterationen };
    kopf.iv = util.bytesZuHex(iv);
    kopf.ct = util.bytesZuHex(chiffrat);
    return JSON.stringify(kopf, null, 1);
  }

  /* Liest eine Sicherung. Wirft mit sprechender Meldung, wenn etwas nicht
   * passt - falsche Datei, falsche Passphrase, beschädigter Inhalt. */
  async function importieren(text, passphrase) {
    var kopf;
    try { kopf = JSON.parse(text); }
    catch (fehler) { throw new Error('Das ist keine lesbare Sicherungsdatei.'); }
    if (!kopf || kopf.format !== FORMAT) throw new Error('Das ist keine Tresor-Sicherung.');
    if (kopf.version > VERSION) throw new Error('Die Datei stammt aus einer neueren Version der App.');

    var inhalt;
    if (kopf.verschluesselt) {
      if (!passphrase) throw new Error('Diese Sicherung ist verschlüsselt - es fehlt die Passphrase.');
      var schluessel = await schluesselAus(passphrase, kopf.kdf.salz, kopf.kdf.iterationen);
      var klar;
      try {
        klar = await global.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: util.hexZuBytes(kopf.iv), additionalData: textBytes(FORMAT) },
          schluessel, util.hexZuBytes(kopf.ct)
        );
      } catch (fehler) { throw new Error('Falsche Passphrase - oder die Datei ist beschädigt.'); }
      inhalt = JSON.parse(new TextDecoder().decode(klar));
    } else {
      inhalt = kopf.inhalt;
      var pruefsumme = util.bytesZuHex(await T.krypto.sha256(textBytes(JSON.stringify(inhalt))));
      if (kopf.pruefsumme && kopf.pruefsumme !== pruefsumme) {
        throw new Error('Die Prüfsumme passt nicht - die Datei wurde unterwegs beschädigt.');
      }
    }

    if (!inhalt || !inhalt.tresor || !Array.isArray(inhalt.tresor.fragmente)) {
      throw new Error('In der Datei steckt kein Tresor.');
    }
    return { tresor: inhalt.tresor, verlauf: inhalt.verlauf || null, erstellt: kopf.erstellt };
  }

  /* Kurzbeschreibung für die Oberfläche, ohne etwas zu verraten. */
  function beschreibung(tresor) {
    var offen = tresor.fragmente.filter(function (f) { return f.offen; }).length;
    return (tresor.art === 'foto' ? 'Bild mit ' + tresor.laenge + ' Stufen' : tresor.laenge + '-stellige Zahl')
      + ' · ' + offen + ' von ' + tresor.laenge + ' Fragmenten offen'
      + ' · angelegt ' + util.zeitpunkt(tresor.erstellt);
  }

  T.sicherung = { exportieren: exportieren, importieren: importieren, beschreibung: beschreibung, FORMAT: FORMAT };
})(typeof window !== 'undefined' ? window : globalThis);
