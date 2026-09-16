/* Der Tresor selbst: Aufgabenplan bauen, verriegeln, Fragment für Fragment
 * wieder herausgeben. */
(function (global) {
  'use strict';
  var T = global.Tresor || (global.Tresor = {});
  var util = T.util;

  var RECHENZEIT_STUFEN = [10, 45, 180, 600, 1800];   // Sekunden echter Rechenarbeit

  function standardKonfiguration() {
    return {
      dimensionen: ['geduld', 'zeit'],
      stufen: { geduld: 3, zeit: 2 },
      aufgabenProFragment: 2,
      rechenzeit: 2,
      reihenfolge: 'links'
    };
  }

  /* Aufgabenplan: zieht reihum aus einem gemischten Topf, damit sich innerhalb
   * eines Tresors nichts wiederholt, solange der Topf reicht - und variiert
   * danach wenigstens die Parameter. Typen, die zuletzt dran waren, rutschen
   * ans Ende des Topfes. */
  function aufgabenPlan(zufall, konfig, anzahlFragmente, nurVorschau) {
    var vermeiden = T.speicher ? T.speicher.zuletztBenutzt() : [];
    var toepfe = konfig.dimensionen.map(function (dimension) {
      var stufeDerDimension = konfig.stufen[dimension] || 3;
      var module = T.herausforderungen.nachDimension(dimension).filter(function (m) {
        // Manche Aufgaben sind erst ab einer gewissen Intensität sinnvoll
        return !m.mindestStufe || stufeDerDimension >= m.mindestStufe;
      }).map(function (m) { return m.id; });
      if (!module.length) return null;
      var gemischt = zufall.mische(module);
      gemischt.sort(function (a, b) {
        return (vermeiden.indexOf(a) === -1 ? 0 : 1) - (vermeiden.indexOf(b) === -1 ? 0 : 1);
      });
      return { dimension: dimension, vorrat: gemischt, zeiger: 0 };
    }).filter(Boolean);

    if (!toepfe.length) return [];

    function zieh(topf) {
      if (topf.zeiger >= topf.vorrat.length) { topf.vorrat = zufall.mische(topf.vorrat); topf.zeiger = 0; }
      return topf.vorrat[topf.zeiger++];
    }

    var plan = [], topfZeiger = 0, benutzt = [];
    for (var f = 0; f < anzahlFragmente; f++) {
      var aufgaben = [];
      for (var a = 0; a < konfig.aufgabenProFragment; a++) {
        var topf = toepfe[topfZeiger++ % toepfe.length];
        var id = zieh(topf);
        var modul = T.herausforderungen.hole(id);
        var stufe = konfig.stufen[topf.dimension] || 3;
        // spätere Fragmente dürfen eine Stufe härter sein
        var effektiv = util.grenze(stufe + (f >= anzahlFragmente - 2 ? 1 : 0), 1, 5);
        aufgaben.push({
          id: id,
          dimension: topf.dimension,
          params: modul.erzeuge(zufall, effektiv),
          zustand: {},
          erledigt: false
        });
        benutzt.push(id);
      }
      plan.push(aufgaben);
    }
    if (T.speicher && !nurVorschau) T.speicher.merkeBenutzt(benutzt);
    return plan;
  }

  function geschaetzteDauer(konfig, laenge, rate) {
    var zufall = new T.Zufall(4242);
    var plan = aufgabenPlan(zufall, konfig, laenge, true);
    var summe = plan.reduce(function (gesamt, aufgaben) {
      return gesamt + aufgaben.reduce(function (teil, aufgabe) {
        return teil + T.herausforderungen.hole(aufgabe.id).schaetzung(aufgabe.params);
      }, 0);
    }, 0);
    summe += laenge * RECHENZEIT_STUFEN[util.grenze(konfig.rechenzeit, 1, 5) - 1];
    var mitZeitfenster = plan.some(function (aufgaben) {
      return aufgaben.some(function (a) { return a.id === 'zeitfenster'; });
    });
    return { sekunden: summe, mitZeitfenster: mitZeitfenster };
  }

  /* Verriegeln: für jedes Fragment ein Zeitschloss schmieden und die Ziffer
   * damit verschlüsseln. Danach ist der Klartext weg. */
  async function erstellen(optionen) {
    var geheimnis = String(optionen.geheimnis);
    var konfig = optionen.konfig;
    var melde = optionen.beiFortschritt || function () {};
    var saat = T.neueSaat();
    var zufall = new T.Zufall(saat);
    var laenge = geheimnis.length;

    melde({ phase: 'messen', text: 'Rechenleistung dieses Geräts messen ...' });
    var rate = await T.zeitschloss.messen();

    var sekundenProSchloss = RECHENZEIT_STUFEN[util.grenze(konfig.rechenzeit, 1, 5) - 1];
    var schritte = Math.max(50000, Math.round(rate * sekundenProSchloss));

    var plan = aufgabenPlan(zufall, konfig, laenge);
    var positionen = konfig.reihenfolge === 'zufall'
      ? zufall.mische(geheimnis.split('').map(function (_, i) { return i; }))
      : geheimnis.split('').map(function (_, i) { return i; });

    var fragmente = [];
    for (var i = 0; i < laenge; i++) {
      melde({ phase: 'schmieden', text: 'Zeitschloss ' + (i + 1) + ' von ' + laenge + ' schmieden ...', anteil: i / laenge });
      var puzzle = await T.zeitschloss.erzeugen(schritte);
      var paket = await T.krypto.verschluesseln(i, puzzle.b, geheimnis.charAt(positionen[i]));
      fragmente.push({
        index: i,
        position: positionen[i],
        aufgaben: plan[i] || [],
        schloss: { n: puzzle.n, a: puzzle.a, t: puzzle.t },   // b wird bewusst nicht gespeichert
        paket: paket,
        stand: { erledigt: 0, x: puzzle.a },
        aktiviert: false,
        offen: false,
        ziffer: null
      });
      puzzle.b = null;
    }

    melde({ phase: 'fertig', text: 'Verriegelt.', anteil: 1 });
    return {
      version: 1,
      erstellt: Date.now(),
      saat: saat,
      laenge: laenge,
      konfig: konfig,
      rate: rate,
      sekundenProSchloss: sekundenProSchloss,
      fragmente: fragmente
    };
  }

  function aktuellesFragment(tresor) {
    for (var i = 0; i < tresor.fragmente.length; i++) {
      if (!tresor.fragmente[i].offen) return tresor.fragmente[i];
    }
    return null;
  }

  function offeneAufgabe(fragment) {
    for (var i = 0; i < fragment.aufgaben.length; i++) {
      if (!fragment.aufgaben[i].erledigt) return fragment.aufgaben[i];
    }
    return null;
  }

  function alleOffen(tresor) {
    return tresor.fragmente.every(function (f) { return f.offen; });
  }

  /* Was bisher sichtbar ist - die Ziffern stehen an ihrer echten Stelle. */
  function sichtbaresGeheimnis(tresor) {
    var zeichen = new Array(tresor.laenge).fill(null);
    tresor.fragmente.forEach(function (f) {
      if (f.offen && f.ziffer !== null) zeichen[f.position] = f.ziffer;
    });
    return zeichen;
  }

  /* Ist das Zeitschloss geknackt, wird die Ziffer entschlüsselt und im Tresor
   * abgelegt. Der Rest des Tresors bleibt zu. */
  async function fragmentOeffnen(tresor, fragment, bHex) {
    fragment.ziffer = await T.krypto.entschluesseln(fragment.index, bHex, fragment.paket);
    fragment.offen = true;
    fragment.stand.erledigt = fragment.schloss.t;
    return fragment.ziffer;
  }

  T.tresorLogik = {
    standardKonfiguration: standardKonfiguration,
    geschaetzteDauer: geschaetzteDauer,
    erstellen: erstellen,
    aktuellesFragment: aktuellesFragment,
    offeneAufgabe: offeneAufgabe,
    alleOffen: alleOffen,
    sichtbaresGeheimnis: sichtbaresGeheimnis,
    fragmentOeffnen: fragmentOeffnen,
    RECHENZEIT_STUFEN: RECHENZEIT_STUFEN
  };
})(typeof window !== 'undefined' ? window : globalThis);
