/* Zeitschloss ueber das drand-Netz.
 *
 * Rechenzeit haelt nur, solange das Geraet rechnet - fuer Tage und Wochen
 * taugt das nicht. drand ist ein oeffentliches Netz unabhaengiger Betreiber,
 * das alle drei Sekunden eine Signatur veroeffentlicht. Man kann auf eine
 * kuenftige Signatur verschluesseln; bis sie existiert, oeffnet es niemand.
 * Dazu muss nichts rechnen, der Bildschirm kann aus sein.
 *
 * Was man dafuer eintauscht:
 *   - Zum Oeffnen braucht es Netz. Zum Verschliessen nicht - die Kettendaten
 *     sind hier fest eingetragen.
 *   - Verschwindet das Netz vor dem Termin, ist das Geheimnis verloren.
 *   - Frueher oeffnen koennte nur eine Mehrheit der Betreiber gemeinsam.
 *
 * Jeder Beacon wird gegen den oeffentlichen Schluessel der Kette geprueft.
 * Ein manipulierter Spiegelserver kann also keinen Schluessel zu frueh
 * herausgeben, nur gar keinen.
 *
 * Die Bibliothek (js/vendor/tlock.min.js) ist tlock-js, mit esbuild zu einer
 * Datei gebuendelt:
 *   echo "globalThis.tlockJs = require('tlock-js');" > eintrag.js
 *   esbuild eintrag.js --bundle --minify --platform=browser --format=iife \
 *     --define:process.env.NODE_ENV='"production"' --define:window=globalThis \
 *     --outfile=js/vendor/tlock.min.js
 *
 * Das `--define:window=globalThis` ist kein Schmuck. tlock-js holt seinen
 * Zufall aus window.crypto und faellt ohne `window` auf Nodes require zurueck.
 * In einem Worker gibt es kein `window` - ohne die Ersetzung scheiterte dort
 * jede Verschluesselung. Mit ihr greift in Seite und Worker dieselbe
 * sichere Quelle, crypto.getRandomValues. */
(function (global) {
  'use strict';
  var T = global.Tresor || (global.Tresor = {});
  var PFAD = 'js/worker-drand.js';

  /* quicknet: drei Sekunden je Runde, das Netz, fuer das tlock gebaut ist.
   * Fest eingetragen statt abgefragt - sonst koennte ein Server beim
   * Verschliessen eine fremde Kette unterschieben. */
  var QUICKNET = {
    public_key: '83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a',
    period: 3,
    genesis_time: 1692803367,
    hash: '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971',
    groupHash: 'f477d5c89f21a17c863a7f937c6a6d15859414d2be09cd448d4279af331c5d3e',
    schemeID: 'bls-unchained-g1-rfc9380',
    metadata: { beaconID: 'quicknet' }
  };

  /* Mehrere Zugaenge zum selben Netz. Faellt einer aus, nimmt man den
   * naechsten - pruefen tut die Bibliothek ohnehin jeden Beacon selbst. */
  var ZUGAENGE = [
    'https://api.drand.sh',
    'https://api2.drand.sh',
    'https://api3.drand.sh',
    'https://drand.cloudflare.com'
  ];

  var info = QUICKNET;
  var beaconQuelle = null;          // Testnaht: function (runde) -> Promise<beacon>

  /* Erste Runde, deren Zeitpunkt nicht vor `zeitMs` liegt. Abrunden waere
   * falsch: Dann ginge der Tresor bis zu drei Sekunden zu frueh auf. */
  function rundeZu(zeitMs) {
    var sek = zeitMs / 1000 - info.genesis_time;
    return Math.max(1, Math.ceil(sek / info.period) + 1);
  }

  function zeitVon(runde) {
    return (info.genesis_time + (runde - 1) * info.period) * 1000;
  }

  function fehlerMit(art, text) {
    var f = new Error(text);
    f.art = art;
    return f;
  }

  function imWorker(nachricht, aufTyp, beiFortschritt) {
    return new Promise(function (erfuellen, ablehnen) {
      var worker = new Worker(PFAD);
      worker.onmessage = function (ereignis) {
        var m = ereignis.data;
        if (m.typ === 'fortschritt') { if (beiFortschritt) beiFortschritt(m.fertig, m.von); return; }
        worker.terminate();
        if (m.typ === 'fehler') ablehnen(fehlerMit('ungueltig', m.meldung));
        else if (m.typ === aufTyp) erfuellen(m);
      };
      worker.onerror = function (f) {
        worker.terminate();
        ablehnen(fehlerMit('ungueltig', f.message || 'drand-Worker ist ausgefallen'));
      };
      worker.postMessage(nachricht);
    });
  }

  /* Denselben Inhalt auf mehrere Runden verschliessen - eine Leiter. */
  async function verschliessen(runden, hex, beiFortschritt) {
    var antwort = await imWorker({ cmd: 'verschliessen', runden: runden, hex: hex, info: info },
      'verschlossen', beiFortschritt);
    return antwort.pakete;
  }

  async function holeBeacon(runde) {
    if (beaconQuelle) return beaconQuelle(runde);
    var letzter = null;
    for (var i = 0; i < ZUGAENGE.length; i++) {
      try {
        var antwort = await global.fetch(ZUGAENGE[i] + '/' + info.hash + '/public/' + runde,
          { cache: 'no-store' });
        if (antwort.ok) return await antwort.json();
        letzter = new Error('HTTP ' + antwort.status);
      } catch (f) { letzter = f; }
    }
    throw fehlerMit('netz', 'drand nicht erreichbar' + (letzter ? ': ' + letzter.message : ''));
  }

  /* Oeffnen. Wirft mit f.art:
   *   'zufrueh'   - die Runde liegt noch in der Zukunft
   *   'netz'      - kein Zugang zum Netz erreichbar
   *   'ungueltig' - Beacon oder Paket passen nicht (Faelschung, Defekt) */
  async function oeffnen(runde, paket) {
    if (zeitVon(runde) > Date.now()) throw fehlerMit('zufrueh', 'Die Runde ist noch nicht erreicht.');
    var beacon;
    try { beacon = await holeBeacon(runde); }
    catch (f) { throw f.art ? f : fehlerMit('netz', f.message); }
    var antwort = await imWorker({ cmd: 'oeffnen', paket: paket, beacon: beacon, info: info }, 'geoeffnet');
    return antwort.hex;
  }

  function verfuegbar() { return typeof global.Worker === 'function'; }

  /* Nur fuer Tests: eine eigene Kette mit bekanntem Schluessel. */
  function testKette(eigeneInfo, quelle) {
    info = eigeneInfo || QUICKNET;
    beaconQuelle = quelle || null;
  }

  T.drand = {
    QUICKNET: QUICKNET,
    rundeZu: rundeZu,
    zeitVon: zeitVon,
    verschliessen: verschliessen,
    oeffnen: oeffnen,
    verfuegbar: verfuegbar,
    testKette: testKette,
    kette: function () { return info; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
