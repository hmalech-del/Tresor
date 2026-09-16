/* Zeitschloss-Worker: RSW-Time-Lock-Puzzle (Rivest/Shamir/Wagner).
 *
 * Erzeuger kennt phi(N) und rechnet b = a^(2^T mod phi(N)) mod N in Millisekunden.
 * Wer das Puzzle lösen will, kennt phi(N) nicht und muss T mal sequentiell
 * quadrieren. Das ist von Natur aus nicht parallelisierbar - mehr CPU-Kerne
 * helfen nicht, nur verstrichene Rechenzeit.
 */
'use strict';

var KLEINE_PRIMZAHLEN = (function () {
  var sieb = [], ist = new Uint8Array(4000).fill(1), i, j;
  for (i = 2; i < 4000; i++) {
    if (!ist[i]) continue;
    sieb.push(BigInt(i));
    for (j = i * i; j < 4000; j += i) ist[j] = 0;
  }
  return sieb;
})();

function zufallsBigInt(bits) {
  var bytes = new Uint8Array(Math.ceil(bits / 8));
  crypto.getRandomValues(bytes);
  // oberstes und unterstes Bit setzen: volle Länge, ungerade
  bytes[0] |= 0x80;
  bytes[bytes.length - 1] |= 0x01;
  var hex = '';
  for (var i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return BigInt('0x' + hex);
}

function modPow(basis, exp, mod) {
  var ergebnis = 1n;
  basis %= mod;
  while (exp > 0n) {
    if (exp & 1n) ergebnis = (ergebnis * basis) % mod;
    exp >>= 1n;
    basis = (basis * basis) % mod;
  }
  return ergebnis;
}

function istWahrscheinlichPrim(n, runden) {
  if (n < 2n) return false;
  for (var k = 0; k < KLEINE_PRIMZAHLEN.length; k++) {
    var p = KLEINE_PRIMZAHLEN[k];
    if (n === p) return true;
    if (n % p === 0n) return false;
  }
  var d = n - 1n, r = 0n;
  while ((d & 1n) === 0n) { d >>= 1n; r++; }
  for (var i = 0; i < runden; i++) {
    var a = 2n + (zufallsBigInt(64) % (n - 4n));
    var x = modPow(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    var weiter = false;
    for (var j = 1n; j < r; j++) {
      x = (x * x) % n;
      if (x === n - 1n) { weiter = true; break; }
    }
    if (!weiter) return false;
  }
  return true;
}

function primzahl(bits) {
  for (;;) {
    var kandidat = zufallsBigInt(bits);
    if (istWahrscheinlichPrim(kandidat, 12)) return kandidat;
  }
}

function hex(n) { var s = n.toString(16); return s.length % 2 ? '0' + s : s; }

/* Wie viele Quadrierungen schafft dieses Gerät pro Sekunde? */
function messen(bits) {
  // Für die Messung genügt ein zufälliger Modul der richtigen Größe -
  // die Geschwindigkeit einer Quadrierung hängt an der Bitlänge, nicht an
  // der Primfaktorzerlegung. Spart Sekunden beim Einrichten.
  var n = zufallsBigInt(bits);
  var x = 3n, i, start = Date.now(), runden = 20000;
  for (i = 0; i < runden; i++) x = (x * x) % n;
  var dauer = Math.max(1, Date.now() - start);
  // zweite, längere Messung für stabilere Werte
  var rate = Math.round(runden / (dauer / 1000));
  var runden2 = Math.min(400000, Math.max(20000, rate));
  start = Date.now();
  for (i = 0; i < runden2; i++) x = (x * x) % n;
  dauer = Math.max(1, Date.now() - start);
  return Math.max(1000, Math.round(runden2 / (dauer / 1000)));
}

function erzeugen(bits, schritte) {
  var p = primzahl(bits / 2), q = primzahl(bits / 2);
  while (p === q) q = primzahl(bits / 2);
  var n = p * q;
  var phi = (p - 1n) * (q - 1n);
  var a = 3n;
  // Abkürzung nur für den Erzeuger: 2^T mod phi(N)
  var e = modPow(2n, BigInt(schritte), phi);
  var b = modPow(a, e, n);
  return { n: hex(n), a: hex(a), t: schritte, b: hex(b) };
}

/* Durchgehende Schleife ohne Timer.
 *
 * Frueher gab diese Schleife nach jedem Block per setTimeout an die
 * Ereignisschleife ab, um eine Stopp-Nachricht entgegennehmen zu koennen.
 * Genau diese Timer drosseln Browser in Hintergrund-Tabs teils auf einen
 * Durchlauf pro Sekunde - das Zeitschloss waere dort auf einen Bruchteil
 * seiner Geschwindigkeit eingebrochen. Jetzt laeuft die Schleife durch; zum
 * Pausieren beendet die Hauptseite den Worker einfach (terminate) und setzt
 * beim zuletzt gemeldeten Zwischenstand wieder auf. Verloren geht dabei
 * hoechstens die Rechnung seit der letzten Meldung, also rund 250 ms. */
function loesen(nHex, startHex, erledigt, ziel) {
  var n = BigInt('0x' + nHex);
  var x = BigInt('0x' + startHex);
  var i = erledigt;
  var block = 25000;
  var letzteMeldung = Date.now();

  while (i < ziel) {
    var ende = Math.min(ziel, i + block);
    var start = Date.now();
    while (i < ende) { x = (x * x) % n; i++; }
    var dauer = Math.max(1, Date.now() - start);
    // Blockgroesse auf rund 150 ms einregeln: oft genug fuer fluessige
    // Fortschrittsmeldungen, selten genug fuer wenig Verwaltungsaufwand.
    block = Math.max(2000, Math.min(5000000, Math.round(block * (150 / dauer))));
    if (Date.now() - letzteMeldung > 250) {
      letzteMeldung = Date.now();
      self.postMessage({ typ: 'fortschritt', erledigt: i, ziel: ziel, x: hex(x) });
    }
  }
  self.postMessage({ typ: 'fertig', erledigt: i, b: hex(x) });
}

self.onmessage = function (ereignis) {
  var m = ereignis.data;
  try {
    if (m.cmd === 'messen') {
      self.postMessage({ typ: 'messung', rate: messen(m.bits || 1024) });
    } else if (m.cmd === 'erzeugen') {
      self.postMessage({ typ: 'erzeugt', puzzle: erzeugen(m.bits || 1024, m.schritte) });
    } else if (m.cmd === 'loesen') {
      loesen(m.n, m.x, m.erledigt || 0, m.ziel);
    }
  } catch (fehler) {
    self.postMessage({ typ: 'fehler', meldung: String(fehler && fehler.message || fehler) });
  }
};
