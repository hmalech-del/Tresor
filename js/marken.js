/* Marken: NFC und QR als Eingaenge, ganz ohne Home Assistant.
 *
 * Eine Marke ist ein Link mit einem geheimen Code: .../#marke=<code>. Als
 * QR-Code ausgedruckt oder auf eine NFC-Marke geschrieben, oeffnet ihn das
 * Handy von selbst - die Kamera-App erkennt den QR-Code, Android oeffnet
 * eine NFC-Marke mit Link beim Antippen. Die App liest den Code aus der
 * Adresse, loest die Marke ein und nimmt ihn sofort wieder aus der
 * Adresszeile. Laeuft die App schon, kann sie auch selbst lesen (Web NFC)
 * oder scannen (BarcodeDetector), beides gibt es in Chrome auf Android.
 *
 * Was eine Marke bewirkt, steht beim Verriegeln fest. Im Tresor liegt nur
 * ein Pruefwert des Codes, nicht der Code: Wer den Speicher liest, kann
 * keine Marke nachmachen. Der Code steht danach nur noch auf der Marke. */
(function (global) {
  'use strict';
  var T = global.Tresor || (global.Tresor = {});

  function neuerCode() {
    var werte = new Uint8Array(12);
    (global.crypto || global.msCrypto).getRandomValues(werte);
    return T.util.bytesZuHex(werte);
  }

  function link(code) {
    var ort = global.location;
    return ort.origin + ort.pathname + '#marke=' + code;
  }

  /* Den Code aus einem Link, einer Adresse oder einem nackten Code holen. */
  function codeAus(text) {
    var m = /(?:#|^)marke=([0-9a-f]{16,64})\b/i.exec(String(text || '').trim())
      || /^([0-9a-f]{16,64})$/i.exec(String(text || '').trim());
    return m ? m[1].toLowerCase() : '';
  }

  /* QR-Code als SVG - scharf beim Drucken, egal wie gross. */
  function qrSvg(text, modul) {
    modul = modul || 4;
    var qr = global.qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    var n = qr.getModuleCount(), rand = 4, groesse = (n + 2 * rand) * modul;
    var pfad = '';
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (qr.isDark(r, c)) pfad += 'M' + (c + rand) * modul + ' ' + (r + rand) * modul + 'h' + modul + 'v' + modul + 'h-' + modul + 'z';
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + groesse + ' ' + groesse + '" width="' + groesse
      + '" height="' + groesse + '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/>'
      + '<path fill="#000" d="' + pfad + '"/></svg>';
  }

  /* Den Link als URL-Satz auf eine NFC-Marke schreiben. Android oeffnet ihn
   * beim Antippen von selbst. */
  function nfcSchreiben(url, abbruch) {
    if (!T.nfc.moeglich()) return Promise.reject(new Error(T.nfc.grundText()));
    var leser = new global.NDEFReader();
    return leser.write({ records: [{ recordType: 'url', data: url }] }, { overwrite: true, signal: abbruch });
  }

  /* In der App lesen: jede Marke, die kommt, als Code. */
  function nfcLauschen(beiCode, beiFehler) {
    if (!T.nfc.moeglich()) { if (beiFehler) beiFehler(new Error(T.nfc.grundText())); return function () {}; }
    var steuerung = new AbortController();
    var leser = new global.NDEFReader();
    leser.onreading = function (ereignis) {
      var saetze = (ereignis.message && ereignis.message.records) || [];
      for (var i = 0; i < saetze.length; i++) {
        var art = saetze[i].recordType;
        if (art !== 'url' && art !== 'absolute-url' && art !== 'text') continue;
        var text = '';
        try { text = new TextDecoder(saetze[i].encoding || 'utf-8').decode(saetze[i].data); } catch (fehler) {}
        var code = codeAus(text);
        if (code) { beiCode(code); return; }
      }
      beiCode('');
    };
    leser.scan({ signal: steuerung.signal }).catch(function (fehler) {
      if (!steuerung.signal.aborted && beiFehler) beiFehler(fehler);
    });
    return function () { try { steuerung.abort(); } catch (fehler) {} };
  }

  function qrScanMoeglich() {
    return typeof global.BarcodeDetector === 'function' && !!(global.navigator.mediaDevices
      && global.navigator.mediaDevices.getUserMedia);
  }

  /* Mit der Kamera scannen, bis ein QR-Code mit Markencode kommt. Gibt eine
   * Stopp-Funktion zurueck; das Video haengt in wurzel. */
  function qrScannen(wurzel, beiCode, beiFehler) {
    var aus = false, strom = null;
    var video = document.createElement('video');
    video.setAttribute('playsinline', '');
    video.muted = true;
    video.className = 'marken-video';
    wurzel.appendChild(video);
    function stopp() {
      aus = true;
      if (strom) strom.getTracks().forEach(function (spur) { spur.stop(); });
      video.remove();
    }
    var erkenner;
    try { erkenner = new global.BarcodeDetector({ formats: ['qr_code'] }); }
    catch (fehler) { stopp(); if (beiFehler) beiFehler(fehler); return stopp; }
    global.navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(function (s) {
      if (aus) { s.getTracks().forEach(function (spur) { spur.stop(); }); return; }
      strom = s;
      video.srcObject = s;
      return video.play().then(function schauen() {
        if (aus) return;
        return erkenner.detect(video).then(function (funde) {
          for (var i = 0; i < funde.length; i++) {
            var code = codeAus(funde[i].rawValue);
            if (code) { stopp(); beiCode(code); return; }
          }
          setTimeout(schauen, 250);
        }).catch(function () { setTimeout(schauen, 500); });
      });
    }).catch(function (fehler) { stopp(); if (beiFehler) beiFehler(fehler); });
    return stopp;
  }

  T.marken = {
    neuerCode: neuerCode,
    link: link,
    codeAus: codeAus,
    qrSvg: qrSvg,
    nfcSchreiben: nfcSchreiben,
    nfcLauschen: nfcLauschen,
    qrScanMoeglich: qrScanMoeglich,
    qrScannen: qrScannen
  };
})(typeof window !== 'undefined' ? window : globalThis);
