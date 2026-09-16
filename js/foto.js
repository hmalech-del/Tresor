/* Zahl aus einem Foto lesen.
 *
 * Läuft komplett im Browser, ohne Netz: Graustufen -> Otsu-Schwelle ->
 * Zusammenhangskomponenten -> Zeile finden -> jede Ziffer gegen gerenderte
 * Schriftmuster vergleichen. Das Ergebnis ist ein Vorschlag, den man in der
 * Oberfläche korrigieren kann - erkannt wird ordentlich, aber nicht perfekt. */
(function (global) {
  'use strict';
  var T = global.Tresor || (global.Tresor = {});
  var RASTER = 16;
  var muster = null;

  function leinwand(breite, hoehe) {
    var c = document.createElement('canvas');
    c.width = breite; c.height = hoehe;
    return c;
  }

  /* ---------- Schriftmuster einmalig erzeugen ---------- */

  var SCHRIFTEN = [
    '700 90px Helvetica, Arial, sans-serif',
    '400 90px Arial, Helvetica, sans-serif',
    '400 90px Georgia, "Times New Roman", serif',
    '700 90px Georgia, "Times New Roman", serif',
    '400 90px "Courier New", monospace',
    '600 90px "Segoe UI", Roboto, "Helvetica Neue", sans-serif'
  ];

  function musterErzeugen() {
    var sammlung = [];
    var c = leinwand(160, 160);
    var ctx = c.getContext('2d', { willReadFrequently: true });
    SCHRIFTEN.forEach(function (schrift) {
      for (var ziffer = 0; ziffer <= 9; ziffer++) {
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 160, 160);
        ctx.fillStyle = '#000'; ctx.font = schrift;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(ziffer), 80, 80);
        var bild = ctx.getImageData(0, 0, 160, 160);
        var maske = new Uint8Array(160 * 160);
        for (var i = 0; i < maske.length; i++) maske[i] = bild.data[i * 4] < 128 ? 1 : 0;
        var kasten = umriss(maske, 160, 160);
        if (!kasten) continue;
        sammlung.push({ ziffer: String(ziffer), zellen: verkleinern(maske, 160, kasten) });
      }
    });
    return sammlung;
  }

  function umriss(maske, breite, kasten) {
    var minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
    var hoehe = maske.length / breite;
    for (var y = 0; y < hoehe; y++) {
      for (var x = 0; x < breite; x++) {
        if (!maske[y * breite + x]) continue;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0) return null;
    return { x: minX, y: minY, b: maxX - minX + 1, h: maxY - minY + 1 };
  }

  /* Kasten auf ein RASTER x RASTER-Gitter mit Flächenanteilen verkleinern. */
  function verkleinern(maske, breite, kasten) {
    var zellen = new Float32Array(RASTER * RASTER);
    for (var zy = 0; zy < RASTER; zy++) {
      for (var zx = 0; zx < RASTER; zx++) {
        var x0 = kasten.x + Math.floor(zx * kasten.b / RASTER);
        var x1 = kasten.x + Math.max(Math.floor((zx + 1) * kasten.b / RASTER), Math.floor(zx * kasten.b / RASTER) + 1);
        var y0 = kasten.y + Math.floor(zy * kasten.h / RASTER);
        var y1 = kasten.y + Math.max(Math.floor((zy + 1) * kasten.h / RASTER), Math.floor(zy * kasten.h / RASTER) + 1);
        var summe = 0, anzahl = 0;
        for (var y = y0; y < y1; y++) {
          for (var x = x0; x < x1; x++) { summe += maske[y * breite + x]; anzahl++; }
        }
        zellen[zy * RASTER + zx] = anzahl ? summe / anzahl : 0;
      }
    }
    return zellen;
  }

  function aehnlichkeit(a, b) {
    var summeA = 0, summeB = 0, n = a.length, i;
    for (i = 0; i < n; i++) { summeA += a[i]; summeB += b[i]; }
    var mA = summeA / n, mB = summeB / n, zaehler = 0, qA = 0, qB = 0;
    for (i = 0; i < n; i++) {
      var dA = a[i] - mA, dB = b[i] - mB;
      zaehler += dA * dB; qA += dA * dA; qB += dB * dB;
    }
    if (qA <= 0 || qB <= 0) return 0;
    return zaehler / Math.sqrt(qA * qB);
  }

  /* ---------- Bildverarbeitung ---------- */

  function otsu(grau) {
    var histogramm = new Array(256).fill(0), i;
    for (i = 0; i < grau.length; i++) histogramm[grau[i]]++;
    var gesamt = grau.length, summe = 0;
    for (i = 0; i < 256; i++) summe += i * histogramm[i];
    var summeB = 0, gewichtB = 0, bestesMass = -1, schwelle = 128;
    for (i = 0; i < 256; i++) {
      gewichtB += histogramm[i];
      if (!gewichtB) continue;
      var gewichtF = gesamt - gewichtB;
      if (!gewichtF) break;
      summeB += i * histogramm[i];
      var mB = summeB / gewichtB, mF = (summe - summeB) / gewichtF;
      var mass = gewichtB * gewichtF * (mB - mF) * (mB - mF);
      if (mass > bestesMass) { bestesMass = mass; schwelle = i; }
    }
    return schwelle;
  }

  /* Bradley-Roth: Schwelle je Pixel aus der Umgebung statt fuer das ganze Bild.
   * Rettet Fotos mit Schlagschatten oder schraeg einfallendem Licht, bei denen
   * eine einzige globale Schwelle die dunkle Bildhaelfte verschluckt. */
  function adaptiveMaske(grau, breite, hoehe, invertiert) {
    var summen = new Float64Array((breite + 1) * (hoehe + 1));
    var x, y;
    for (y = 0; y < hoehe; y++) {
      var zeilensumme = 0;
      for (x = 0; x < breite; x++) {
        zeilensumme += grau[y * breite + x];
        summen[(y + 1) * (breite + 1) + (x + 1)] = summen[y * (breite + 1) + (x + 1)] + zeilensumme;
      }
    }
    var fenster = Math.max(8, Math.floor(Math.min(breite, hoehe) / 10));
    var halb = Math.floor(fenster / 2);
    var maske = new Uint8Array(breite * hoehe);
    for (y = 0; y < hoehe; y++) {
      var y0 = Math.max(0, y - halb), y1 = Math.min(hoehe - 1, y + halb);
      for (x = 0; x < breite; x++) {
        var x0 = Math.max(0, x - halb), x1 = Math.min(breite - 1, x + halb);
        var anzahl = (x1 - x0 + 1) * (y1 - y0 + 1);
        var summe = summen[(y1 + 1) * (breite + 1) + (x1 + 1)] - summen[y0 * (breite + 1) + (x1 + 1)]
          - summen[(y1 + 1) * (breite + 1) + x0] + summen[y0 * (breite + 1) + x0];
        var wert = grau[y * breite + x] * anzahl;
        maske[y * breite + x] = invertiert
          ? (wert > summe * 1.06 ? 1 : 0)
          : (wert < summe * 0.94 ? 1 : 0);
      }
    }
    return maske;
  }

  function komponenten(maske, breite, hoehe) {
    var markierung = new Int32Array(breite * hoehe).fill(-1);
    var gefunden = [], schlange = new Int32Array(breite * hoehe);
    for (var start = 0; start < maske.length; start++) {
      if (!maske[start] || markierung[start] !== -1) continue;
      var kennung = gefunden.length, kopf = 0, ende = 0;
      schlange[ende++] = start; markierung[start] = kennung;
      var minX = breite, maxX = 0, minY = hoehe, maxY = 0, flaeche = 0;
      while (kopf < ende) {
        var pos = schlange[kopf++];
        var x = pos % breite, y = (pos - x) / breite;
        flaeche++;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        for (var dy = -1; dy <= 1; dy++) {
          for (var dx = -1; dx <= 1; dx++) {
            var nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= breite || ny >= hoehe) continue;
            var nachbar = ny * breite + nx;
            if (maske[nachbar] && markierung[nachbar] === -1) {
              markierung[nachbar] = kennung; schlange[ende++] = nachbar;
            }
          }
        }
      }
      gefunden.push({ kennung: kennung, x: minX, y: minY, b: maxX - minX + 1, h: maxY - minY + 1, flaeche: flaeche });
    }
    return { markierung: markierung, teile: gefunden };
  }

  /* Wählt die Bildzeile mit den meisten ähnlich großen Teilen. */
  function besteZeile(teile, anzahl) {
    var beste = null;
    teile.forEach(function (bezug) {
      var gruppe = teile.filter(function (anderes) {
        var hoehenVerhaeltnis = anderes.h / bezug.h;
        var mitteBezug = bezug.y + bezug.h / 2, mitteAnderes = anderes.y + anderes.h / 2;
        return hoehenVerhaeltnis > 0.55 && hoehenVerhaeltnis < 1.8 &&
          Math.abs(mitteBezug - mitteAnderes) < bezug.h * 0.65;
      }).sort(function (a, b) { return a.x - b.x; });
      var bewertung = gruppe.length - Math.abs(gruppe.length - anzahl) * 1.5;
      if (!beste || bewertung > beste.bewertung) beste = { bewertung: bewertung, gruppe: gruppe };
    });
    if (!beste) return [];
    var gruppe = beste.gruppe;
    if (gruppe.length <= anzahl) return gruppe;
    // gleichmäßigster Lauf von `anzahl` Teilen
    var bester = null;
    for (var i = 0; i + anzahl <= gruppe.length; i++) {
      var lauf = gruppe.slice(i, i + anzahl), abstaende = [], j;
      for (j = 1; j < lauf.length; j++) abstaende.push(lauf[j].x - lauf[j - 1].x);
      var mittel = abstaende.reduce(function (s, a) { return s + a; }, 0) / (abstaende.length || 1);
      var streuung = abstaende.reduce(function (s, a) { return s + Math.abs(a - mittel); }, 0) / (abstaende.length || 1);
      var mass = -streuung / (mittel || 1);
      if (!bester || mass > bester.mass) bester = { mass: mass, lauf: lauf };
    }
    return bester ? bester.lauf : gruppe.slice(0, anzahl);
  }

  function erkenne(teil, markierung, breite) {
    var maske = new Uint8Array(breite * (markierung.length / breite));
    for (var i = 0; i < markierung.length; i++) if (markierung[i] === teil.kennung) maske[i] = 1;
    var zellen = verkleinern(maske, breite, teil);
    if (!muster) muster = musterErzeugen();
    var bestes = { zeichen: '?', wert: -2 }, zweitbestes = -2;
    muster.forEach(function (m) {
      var wert = aehnlichkeit(zellen, m.zellen);
      if (wert > bestes.wert) { zweitbestes = bestes.wert; bestes = { zeichen: m.ziffer, wert: wert }; }
      else if (wert > zweitbestes && m.ziffer !== bestes.zeichen) zweitbestes = wert;
    });
    return {
      zeichen: bestes.zeichen,
      sicherheit: Math.max(0, Math.min(1, (bestes.wert - 0.2) / 0.75)),
      abstand: bestes.wert - zweitbestes
    };
  }

  function ausschnitt(quelle, teil) {
    var rand = Math.round(teil.h * 0.12);
    var c = leinwand(teil.b + rand * 2, teil.h + rand * 2);
    c.getContext('2d').drawImage(quelle, teil.x - rand, teil.y - rand, c.width, c.height, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  }

  async function lesen(datei, anzahl) {
    var bild = await createImageBitmap(datei);
    var faktor = Math.min(1, 1100 / Math.max(bild.width, bild.height));
    var breite = Math.max(1, Math.round(bild.width * faktor));
    var hoehe = Math.max(1, Math.round(bild.height * faktor));
    var c = leinwand(breite, hoehe);
    var ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bild, 0, 0, breite, hoehe);
    var daten = ctx.getImageData(0, 0, breite, hoehe).data;

    var grau = new Uint8Array(breite * hoehe);
    for (var i = 0; i < grau.length; i++) {
      grau[i] = (daten[i * 4] * 299 + daten[i * 4 + 1] * 587 + daten[i * 4 + 2] * 114) / 1000 | 0;
    }
    var schwelle = otsu(grau);

    // Vier Anlaeufe: globale und ortsabhaengige Schwelle, jeweils in beiden
    // Polaritaeten - dunkle Schrift auf hell und umgekehrt.
    var anlaeufe = [
      { adaptiv: false, invertiert: 0 }, { adaptiv: false, invertiert: 1 },
      { adaptiv: true, invertiert: 0 }, { adaptiv: true, invertiert: 1 }
    ];
    var versuche = anlaeufe.map(function (anlauf) {
      var invertiert = anlauf.invertiert;
      var maske;
      if (anlauf.adaptiv) {
        maske = adaptiveMaske(grau, breite, hoehe, invertiert);
      } else {
        maske = new Uint8Array(grau.length);
        for (var j = 0; j < grau.length; j++) {
          maske[j] = invertiert ? (grau[j] > schwelle ? 1 : 0) : (grau[j] < schwelle ? 1 : 0);
        }
      }
      var ergebnis = komponenten(maske, breite, hoehe);
      var brauchbar = ergebnis.teile.filter(function (teil) {
        var verhaeltnis = teil.h / teil.b;
        return teil.flaeche > 30 && teil.h > hoehe * 0.04 && teil.h < hoehe * 0.95 &&
          teil.b < breite * 0.5 && verhaeltnis > 0.8 && verhaeltnis < 7 &&
          teil.flaeche > teil.b * teil.h * 0.12;
      });
      var zeile = besteZeile(brauchbar, anzahl);
      var ziffern = zeile.map(function (teil) {
        var treffer = erkenne(teil, ergebnis.markierung, breite);
        treffer.bild = ausschnitt(c, teil);
        treffer.kasten = { x: teil.x, y: teil.y, b: teil.b, h: teil.h };
        return treffer;
      });
      var mittel = ziffern.length
        ? ziffern.reduce(function (s, z) { return s + z.sicherheit; }, 0) / ziffern.length : 0;
      return { ziffern: ziffern, bewertung: mittel - Math.abs(ziffern.length - anzahl) * 0.35 };
    });

    var gewinner = versuche.reduce(function (bestes, versuch) {
      return !bestes || versuch.bewertung > bestes.bewertung ? versuch : bestes;
    }, null);
    return {
      ziffern: gewinner.ziffern,
      vorschau: c.toDataURL('image/jpeg', 0.7),
      breite: breite,
      hoehe: hoehe
    };
  }

  /* ---------------- Bild als Geheimnis ----------------
   *
   * Ein Bild lässt sich nicht sinnvoll in Ziffern zerlegen, wohl aber in
   * Schärfestufen: Stufe 1 ist ein grober Farbfleck, die letzte das ganze
   * Bild. Jede Stufe wird für sich verschlüsselt und ist ein eigenes Fragment,
   * so dass die Freigabe wie bei der Zahl schrittweise passiert. */
  async function stufenBilder(datei, anzahl, maxKante) {
    maxKante = maxKante || 1280;
    var bild;
    try { bild = await createImageBitmap(datei, { imageOrientation: 'from-image' }); }
    catch (fehler) { bild = await createImageBitmap(datei); }

    var faktor = Math.min(1, maxKante / Math.max(bild.width, bild.height));
    var vollBreite = Math.max(8, Math.round(bild.width * faktor));
    var vollHoehe = Math.max(8, Math.round(bild.height * faktor));
    var kleinste = Math.max(8, Math.round(vollBreite / Math.pow(vollBreite / 24, 1)));

    var stufen = [];
    for (var i = 0; i < anzahl; i++) {
      var anteil = anzahl === 1 ? 1 : i / (anzahl - 1);
      var breite = Math.max(8, Math.round(24 * Math.pow(vollBreite / 24, anteil)));
      var hoehe = Math.max(8, Math.round(breite * vollHoehe / vollBreite));
      var c = leinwand(breite, hoehe);
      var ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bild, 0, 0, breite, hoehe);
      stufen.push({
        breite: breite,
        hoehe: hoehe,
        bild: c.toDataURL('image/jpeg', i === anzahl - 1 ? 0.82 : 0.72)
      });
    }
    bild.close && bild.close();
    return {
      stufen: stufen,
      groesse: stufen.reduce(function (summe, stufe) { return summe + stufe.bild.length; }, 0),
      vollBreite: vollBreite,
      vollHoehe: vollHoehe,
      kleinste: kleinste
    };
  }

  T.foto = { lesen: lesen, stufenBilder: stufenBilder };
})(typeof window !== 'undefined' ? window : globalThis);
