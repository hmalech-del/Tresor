/* drand-Worker: Zeitschloss ueber ein oeffentliches Netz.
 *
 * Verschluesselt wird auf eine kuenftige Runde des drand-Netzes. Den
 * Schluessel dazu veroeffentlicht das Netz erst, wenn die Runde erreicht ist -
 * vorher kann es niemand oeffnen, auch nicht mit verstellter Geraeteuhr.
 *
 * Hier laeuft nur die Mathematik. Das Holen der Beacons macht die Hauptseite
 * und reicht sie herein: So bleibt der Worker ohne Netz, und Tests koennen
 * eine eigene Kette unterschieben, ohne dass sich hier etwas aendert.
 *
 * Eine Verschluesselung kostet rund 55 ms. Eine Leiter mit sechzig Sprossen
 * wuerde die Oberflaeche sonst mehrere Sekunden einfrieren. */
'use strict';
importScripts('vendor/tlock.min.js');

var tl = self.tlockJs;

function kette(info, beacon) {
  return {
    options: { disableBeaconVerification: false, noCache: true },
    chain: function () { return { baseUrl: 'tresor', info: function () { return Promise.resolve(info); } }; },
    get: function (runde) {
      if (beacon && Number(beacon.round) === Number(runde)) return Promise.resolve(beacon);
      return Promise.reject(new Error('Kein Beacon fuer Runde ' + runde));
    },
    latest: function () { return Promise.reject(new Error('nicht benutzt')); }
  };
}

self.onmessage = async function (ereignis) {
  var m = ereignis.data;
  try {
    if (m.cmd === 'verschliessen') {
      var client = kette(m.info, null);
      var inhalt = tl.Buffer.from(m.hex, 'hex');
      var heraus = [];
      for (var i = 0; i < m.runden.length; i++) {
        heraus.push(await tl.timelockEncrypt(m.runden[i], inhalt, client));
        self.postMessage({ typ: 'fortschritt', fertig: i + 1, von: m.runden.length });
      }
      self.postMessage({ typ: 'verschlossen', pakete: heraus });
    } else if (m.cmd === 'oeffnen') {
      var klar = await tl.timelockDecrypt(m.paket, kette(m.info, m.beacon));
      self.postMessage({ typ: 'geoeffnet', hex: tl.Buffer.from(klar).toString('hex') });
    }
  } catch (fehler) {
    self.postMessage({ typ: 'fehler', meldung: String(fehler && fehler.message || fehler) });
  }
};
