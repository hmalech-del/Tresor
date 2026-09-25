/* Zeitkonto: eine laufende Uhr, die Aufgaben verschieben koennen.
 *
 * Bisher war Strafzeit ein Zeitstempel im Speicher - wer ihn loescht, ist die
 * Strafe los. Hier ist die Restzeit dagegen echte Rechenarbeit: Die Uhr zeigt,
 * wie viele Quadrierungen bis zur Ziellinie fehlen.
 *
 * Alle erreichbaren Ziellinien entstehen beim Anlegen (dort lebt phi(N)) und
 * bilden eine Leiter. Das Konto merkt sich eine exakte Wunschzeit und waehlt
 * dazu die naechste Sprosse. Zwei Zusagen fallen dabei von selbst heraus:
 *
 *   - Unter die unterste Sprosse kommt niemand, egal wie gut er spielt.
 *   - Ueber die oberste kommt niemand, egal wie schlecht. Nicht weil es
 *     geprueft wuerde, sondern weil es dort keinen Schluessel gibt.
 *
 * Gerechnet wird mit der exakten Wunschzeit, nicht mit der Sprosse. Sonst
 * verschluckte das grobe Raster oben kleine Strafen: zehnmal +8 Minuten
 * waeren sonst zehnmal null.
 */
(function (global) {
  'use strict';
  var T = global.Tresor || (global.Tresor = {});

  /* Raster der Leiter: unten fein, oben grob.
   *
   * Eine Minute Aufloesung ueber einen ganzen Tag waeren 1440 Sprossen. Die
   * kosten beim Anlegen rund fuenf Sekunden - und oben braucht es die
   * Feinheit nicht: Wer bei zwoelf Stunden steht, merkt keine Minute mehr. */
  var STUFEN = [
    { bis: 2 * 3600, schritt: 60 },
    { bis: 6 * 3600, schritt: 300 },
    { bis: 24 * 3600, schritt: 900 },
    { bis: Infinity, schritt: 3600 }
  ];

  function rasterBei(sekunden) {
    for (var i = 0; i < STUFEN.length; i++) if (sekunden < STUFEN[i].bis) return STUFEN[i].schritt;
    return STUFEN[STUFEN.length - 1].schritt;
  }

  /* Die Sprossen in Sekunden, von minSek bis mindestens maxSek. */
  function sekundenLeiter(minSek, maxSek) {
    var leiter = [Math.max(1, Math.round(minSek))];
    var s = leiter[0];
    while (s < maxSek) {
      s += rasterBei(s);
      leiter.push(s);
    }
    return leiter;
  }

  /* Dieselbe Leiter in Quadrierungen, auf das Pruefraster gerundet.
   * Doppelte entstehen bei langsamen Geraeten und fliegen raus - zwei
   * Sprossen auf derselben Schrittzahl waeren zwei Schluessel fuer denselben
   * Punkt, also Verschwendung. */
  function schritteLeiter(sekundenLeiterListe, rate, raster) {
    var vorher = -1, heraus = [];
    sekundenLeiterListe.forEach(function (sek) {
      var schritte = Math.max(raster, Math.round(sek * rate / raster) * raster);
      if (schritte > vorher) { heraus.push(schritte); vorher = schritte; }
    });
    return heraus;
  }

  /* Ein laufendes Konto.
   *
   * leiterSek  aufsteigende Sprossen in Sekunden (nur zum Rechnen und Anzeigen)
   * stand      { zielSek } - die exakte Wunschzeit, ueberlebt einen Neustart
   */
  function Konto(leiterSek, stand) {
    this.leiter = leiterSek;
    this.min = leiterSek[0];
    this.max = leiterSek[leiterSek.length - 1];
    this.zielSek = klemmen(this, (stand && stand.zielSek) || leiterSek[0]);
  }

  function klemmen(konto, sek) {
    return Math.min(konto.max, Math.max(konto.min, sek));
  }

  /* Naechstgelegene Sprosse zur Wunschzeit. */
  Konto.prototype.sprosse = function () {
    var beste = 0, abstand = Infinity;
    for (var i = 0; i < this.leiter.length; i++) {
      var d = Math.abs(this.leiter[i] - this.zielSek);
      if (d < abstand) { abstand = d; beste = i; }
    }
    return beste;
  };

  Konto.prototype.zielSekunden = function () { return this.leiter[this.sprosse()]; };

  /* Strafe (positiv) oder Gewinn (negativ). Gibt zurueck, was wirklich
   * angekommen ist - an den Raendern und im groben Raster ist das weniger
   * als gefordert, und der Spieler soll die Wahrheit sehen. */
  Konto.prototype.verschieben = function (sekunden) {
    var vorher = this.zielSekunden();
    this.zielSek = klemmen(this, this.zielSek + sekunden);
    var nachher = this.zielSekunden();
    return {
      gewuenscht: sekunden,
      wirksam: nachher - vorher,
      amBoden: this.zielSek <= this.min,
      amDeckel: this.zielSek >= this.max
    };
  };

  Konto.prototype.stand = function () { return { zielSek: this.zielSek }; };

  T.zeitkonto = {
    STUFEN: STUFEN,
    sekundenLeiter: sekundenLeiter,
    schritteLeiter: schritteLeiter,
    Konto: Konto
  };
})(typeof window !== 'undefined' ? window : globalThis);
