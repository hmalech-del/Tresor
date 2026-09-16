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

/* SHA-256, synchron.
 *
 * Die Web-Crypto-API arbeitet nur mit Versprechen; in einer geschlossenen
 * Rechenschleife braucht es eine Variante, die sofort antwortet. Gebraucht
 * wird sie selten - einmal je Pruefschritt, also alle paar Millionen
 * Quadrierungen -, deshalb zaehlt hier Lesbarkeit mehr als Tempo. */
var SHA_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

function drehe(wert, um) { return ((wert >>> um) | (wert << (32 - um))) >>> 0; }

function sha256Hex(bytes) {
  var zustand = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
                 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  var laenge = bytes.length;
  var bloecke = Math.ceil((laenge + 9) / 64);
  var daten = new Uint8Array(bloecke * 64);
  daten.set(bytes);
  daten[laenge] = 0x80;
  var sicht = new DataView(daten.buffer);
  sicht.setUint32(bloecke * 64 - 8, Math.floor(laenge * 8 / 4294967296));
  sicht.setUint32(bloecke * 64 - 4, (laenge * 8) >>> 0);

  var w = new Uint32Array(64), i, block;
  for (block = 0; block < bloecke; block++) {
    for (i = 0; i < 16; i++) w[i] = sicht.getUint32(block * 64 + i * 4);
    for (i = 16; i < 64; i++) {
      var s0 = drehe(w[i - 15], 7) ^ drehe(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      var s1 = drehe(w[i - 2], 17) ^ drehe(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    var a = zustand[0], b = zustand[1], c = zustand[2], d = zustand[3];
    var e = zustand[4], f = zustand[5], g = zustand[6], h = zustand[7];
    for (i = 0; i < 64; i++) {
      var S1 = drehe(e, 6) ^ drehe(e, 11) ^ drehe(e, 25);
      var wahl = (e & f) ^ (~e & g);
      var t1 = (h + S1 + wahl + SHA_K[i] + w[i]) >>> 0;
      var S0 = drehe(a, 2) ^ drehe(a, 13) ^ drehe(a, 22);
      var mehrheit = (a & b) ^ (a & c) ^ (b & c);
      var t2 = (S0 + mehrheit) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    var neu = [a, b, c, d, e, f, g, h];
    for (i = 0; i < 8; i++) zustand[i] = (zustand[i] + neu[i]) >>> 0;
  }
  return zustand.map(function (teil) { return teil.toString(16).padStart(8, '0'); }).join('');
}

function ascii(text) {
  var bytes = new Uint8Array(text.length);
  for (var i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0xff;
  return bytes;
}

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

/* Blindes Loesen: die Schrittzahl ist nicht bekannt.
 *
 * Gespeichert ist nur SHA-256 der Loesung. Der Worker quadriert und prueft
 * alle `pruefschritt` Schritte, ob er angekommen ist. Damit weiss niemand
 * vorher, wie lange es dauert - auch die App nicht, auch nicht, wer den
 * Speicher ausliest. Bekannt ist nur die Obergrenze, an der abgebrochen wird.
 *
 * Geprueft wird an absoluten Vielfachen von `pruefschritt`, damit ein
 * fortgesetzter Lauf dieselben Pruefpunkte trifft wie ein durchgehender. */
function loesenBlind(nHex, startHex, erledigt, pruefHex, obergrenze, pruefschritt) {
  var n = BigInt('0x' + nHex);
  var x = BigInt('0x' + startHex);
  var i = erledigt;
  var letzteMeldung = Date.now();

  while (i < obergrenze) {
    var naechstePruefung = Math.min(obergrenze, (Math.floor(i / pruefschritt) + 1) * pruefschritt);
    while (i < naechstePruefung) { x = (x * x) % n; i++; }
    if (sha256Hex(ascii(hex(x))) === pruefHex) {
      self.postMessage({ typ: 'fertig', erledigt: i, b: hex(x) });
      return;
    }
    if (Date.now() - letzteMeldung > 250) {
      letzteMeldung = Date.now();
      self.postMessage({ typ: 'fortschritt', erledigt: i, ziel: obergrenze, x: hex(x) });
    }
  }
  self.postMessage({ typ: 'fehler', meldung: 'Obergrenze erreicht, ohne die Lösung zu treffen.' });
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
    } else if (m.cmd === 'loesenBlind') {
      loesenBlind(m.n, m.x, m.erledigt || 0, m.pruef, m.obergrenze, m.pruefschritt);
    }
  } catch (fehler) {
    self.postMessage({ typ: 'fehler', meldung: String(fehler && fehler.message || fehler) });
  }
};
