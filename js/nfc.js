/* Web NFC.
 *
 * Gibt es nur in Chrome auf Android - Safari kennt es nicht, Desktop-Chrome
 * auch nicht. Anders als bei den Lagesensoren ist die Prüfung hier ehrlich
 * einfach: Wo `NDEFReader` fehlt, fehlt die Fähigkeit wirklich. Es gibt
 * keinen Fall, in dem die Schnittstelle da ist und trotzdem nie etwas
 * ankommt.
 *
 * Wie überall sonst gilt HTTPS. Und wie bei den Sensoren wird an die
 * Fähigkeit gebunden, nicht an das Gerät; fehlt sie, greift der Ersatzweg. */
(function (global) {
  'use strict';
  var T = global.Tresor || (global.Tresor = {});

  function moeglich() {
    return typeof global.NDEFReader === 'function' && global.isSecureContext !== false;
  }

  function grundText() {
    if (global.isSecureContext === false) return 'NFC gibt es nur über HTTPS. Diese Seite läuft unverschlüsselt.';
    return 'Dieses Gerät kann kein NFC lesen. Web NFC gibt es bisher nur in Chrome auf Android.';
  }

  /* Einen Textsatz auf die Marke schreiben, die gerade am Gerät liegt.
   * `overwrite` ist Absicht: Eine gebrauchte Marke soll sich neu belegen
   * lassen, ohne dass der Nutzer erst ein anderes Programm braucht. */
  function schreiben(text, abbruch) {
    if (!moeglich()) return Promise.reject(new Error(grundText()));
    var leser = new global.NDEFReader();
    return leser.write({ records: [{ recordType: 'text', data: text }] },
      { overwrite: true, signal: abbruch });
  }

  /* Lauschen, bis eine Marke kommt. Der Rückruf bekommt den ersten
   * Textsatz der Marke; Marken ohne Text melden sich mit leerem Text,
   * damit der Aufrufer "das ist keine unserer Marken" sagen kann. */
  function lesen(rueckruf, beiFehler) {
    if (!moeglich()) { if (beiFehler) beiFehler(new Error(grundText())); return function () {}; }
    var steuerung = new AbortController();
    var leser = new global.NDEFReader();

    leser.onreading = function (ereignis) {
      var text = '';
      var saetze = (ereignis.message && ereignis.message.records) || [];
      for (var i = 0; i < saetze.length; i++) {
        if (saetze[i].recordType !== 'text') continue;
        try {
          text = new TextDecoder(saetze[i].encoding || 'utf-8').decode(saetze[i].data);
        } catch (fehler) { text = ''; }
        if (text) break;
      }
      rueckruf({ text: text, kennung: ereignis.serialNumber || '' });
    };
    leser.onreadingerror = function () { rueckruf({ text: '', kennung: '', unlesbar: true }); };

    leser.scan({ signal: steuerung.signal }).catch(function (fehler) {
      if (steuerung.signal.aborted) return;
      if (beiFehler) beiFehler(fehler);
    });

    return function () { try { steuerung.abort(); } catch (fehler) {} };
  }

  /* Ein Stationsgeheimnis. Landet auf der Marke und geht in den
   * Fragmentschlüssel ein - gespeichert wird davon nur ein Prüfwert. */
  function neuesGeheimnis() {
    var werte = new Uint8Array(16);
    (global.crypto || global.msCrypto).getRandomValues(werte);
    return 'tresor-station-' + T.util.bytesZuHex(werte);
  }

  T.nfc = {
    moeglich: moeglich,
    grundText: grundText,
    schreiben: schreiben,
    lesen: lesen,
    neuesGeheimnis: neuesGeheimnis
  };
})(typeof window !== 'undefined' ? window : globalThis);
