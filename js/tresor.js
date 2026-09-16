/* Der Tresor selbst: Aufgabenplan bauen, verriegeln, Fragment für Fragment
 * wieder herausgeben. */
(function (global) {
  'use strict';
  var T = global.Tresor || (global.Tresor = {});
  var util = T.util;

  var RECHENZEIT_STUFEN = [10, 45, 180, 600, 1800];        // Sekunden echter Rechenarbeit
  var NOTAUSGANG_STUFEN = [0, 300, 1800, 7200, 28800];     // 0 = aus
  var STRAFZEIT_BASIS = [0, 20, 60];                       // aus, mild, hart
  var FRIST_WERTE = [300, 900, 1800, 3600, 7200, 10800, 18000, 28800,
                     43200, 86400, 172800, 259200, 604800];   // Auswahl für absolute Spannen

  function standardKonfiguration() {
    return {
      dimensionen: ['geduld', 'zeit', 'raetsel'],
      stufen: { geduld: 3, zeit: 2, raetsel: 2 },
      aufgabenProFragment: 2,
      rechenzeit: 2,
      reihenfolge: 'links',
      strafe: 0,
      geheimeFrist: {
        aktiv: false,
        bezug: 'tresor',            // 'tresor' = absolute Spanne, 'aufgabe' = Vielfaches der Schätzung
        minSekunden: 3600,
        maxSekunden: 18000,
        minFaktor: 1.2,
        maxFaktor: 3,
        folge: 'aufgaben'           // 'aufgaben' oder 'alles' (Rechenzeit verfällt mit)
      },
      notausgang: { stufe: 0, wartetage: 0 }
    };
  }

  function strafzeit(konfig, fehlversuche) {
    var basis = STRAFZEIT_BASIS[util.grenze(konfig.strafe || 0, 0, 2)];
    if (!basis) return 0;
    return Math.min(1800, Math.round(basis * Math.pow(1.7, Math.max(0, fehlversuche - 1))));
  }

  /* Geheime Frist. Zwei Spielarten:
   *
   *   bezug 'tresor'  - eine absolute Höchstzeit für den ganzen Tresor, gezogen
   *                     aus der eingestellten Spanne (z. B. 1 h bis 5 h).
   *   bezug 'aufgabe' - ein Vielfaches der geschätzten Dauer, je Aufgabe.
   *
   * Der gezogene Wert wird nirgends angezeigt. Bei Ablauf wird neu gezogen,
   * damit der nächste Anlauf nicht dieselbe Grenze hat. */
  function neueFrist(konfig, sekundenSchaetzung, zufallszahl) {
    var f = konfig.geheimeFrist;
    if (!f || !f.aktiv) return 0;
    var anteil = typeof zufallszahl === 'number' ? zufallszahl : Math.random();
    if (f.bezug === 'tresor') {
      var min = Math.min(f.minSekunden, f.maxSekunden);
      var max = Math.max(f.minSekunden, f.maxSekunden);
      return Math.max(10, Math.round(min + anteil * (max - min)));
    }
    return Math.max(20, Math.round(sekundenSchaetzung * (f.minFaktor + anteil * (f.maxFaktor - f.minFaktor))));
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

    /* Manche Generatoren (Lügner, Zahlenrätsel, Waage) liefern nur dann etwas,
     * wenn das Rätsel eindeutig ist. Dann wird eben neu gezogen. */
    function baueAufgabe(topf, stufe) {
      for (var runde = 0; runde < 12; runde++) {
        var id = zieh(topf);
        var modul = T.herausforderungen.hole(id);
        if (!modul) continue;
        var params = modul.erzeuge(zufall, stufe);
        if (!params) continue;
        var loesung = null;
        if (modul.antwortGebunden) {
          loesung = modul.normalisiere(params.loesung);
          delete params.loesung;
          if (!loesung) continue;
        }
        var aufgabe = {
          id: id,
          dimension: topf.dimension,
          params: params,
          zustand: {},
          erledigt: false
        };
        if (modul.dimension !== 'zeit' && (konfig.geheimeFrist || {}).bezug === 'aufgabe') {
          var frist = neueFrist(konfig, modul.schaetzung(params), zufall.zahl());
          if (frist) aufgabe.frist = frist;
        }
        return { aufgabe: aufgabe, loesung: loesung };
      }
      return null;
    }

    var plan = [], topfZeiger = 0, benutzt = [];
    for (var f = 0; f < anzahlFragmente; f++) {
      var aufgaben = [], loesungen = [];
      for (var a = 0; a < konfig.aufgabenProFragment; a++) {
        var topf = toepfe[topfZeiger++ % toepfe.length];
        var stufe = konfig.stufen[topf.dimension] || 3;
        // spätere Fragmente dürfen eine Stufe härter sein
        var effektiv = util.grenze(stufe + (f >= anzahlFragmente - 2 ? 1 : 0), 1, 5);
        var gebaut = baueAufgabe(topf, effektiv);
        if (!gebaut) continue;
        aufgaben.push(gebaut.aufgabe);
        if (gebaut.loesung) loesungen.push(gebaut.loesung);
        benutzt.push(gebaut.aufgabe.id);
      }
      plan.push({ aufgaben: aufgaben, loesungen: loesungen });
    }
    if (T.speicher && !nurVorschau) T.speicher.merkeBenutzt(benutzt);
    return plan;
  }

  function geschaetzteDauer(konfig, laenge) {
    var zufall = new T.Zufall(4242);
    var plan = aufgabenPlan(zufall, konfig, laenge, true);
    var summe = plan.reduce(function (gesamt, fragment) {
      return gesamt + fragment.aufgaben.reduce(function (teil, aufgabe) {
        return teil + T.herausforderungen.hole(aufgabe.id).schaetzung(aufgabe.params);
      }, 0);
    }, 0);
    summe += laenge * RECHENZEIT_STUFEN[util.grenze(konfig.rechenzeit, 1, 5) - 1];
    var mitZeitfenster = plan.some(function (fragment) {
      return fragment.aufgaben.some(function (a) { return a.id === 'zeitfenster'; });
    });
    var gebundene = plan.reduce(function (summe2, fragment) { return summe2 + fragment.loesungen.length; }, 0);
    return { sekunden: summe, mitZeitfenster: mitZeitfenster, gebundeneAufgaben: gebundene };
  }

  /* Verriegeln: für jedes Fragment ein Zeitschloss schmieden, die Antworten der
   * gebundenen Aufgaben in den Schlüssel rechnen und die Ziffer damit
   * verschlüsseln. Danach sind Klartext und Lösungen weg. */
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
      var eintrag = plan[i] || { aufgaben: [], loesungen: [] };

      // Prüfwerte für jede gebundene Antwort - die Antwort selbst wird verworfen
      var gebunden = 0;
      for (var a = 0; a < eintrag.aufgaben.length; a++) {
        var modul = T.herausforderungen.hole(eintrag.aufgaben[a].id);
        if (!modul.antwortGebunden) continue;
        var salz = T.krypto.neuesSalz();
        eintrag.aufgaben[a].pruefung = {
          salz: salz,
          hash: await T.krypto.antwortPruefung(eintrag.loesungen[gebunden], salz, T.krypto.ITERATIONEN)
        };
        gebunden++;
      }

      var antwortSalz = T.krypto.neuesSalz();
      var material = await T.krypto.antwortMaterial(eintrag.loesungen, antwortSalz, T.krypto.ITERATIONEN);
      var puzzle = await T.zeitschloss.erzeugen(schritte);
      var paket = await T.krypto.verschluesseln(i, puzzle.b, geheimnis.charAt(positionen[i]), material);

      fragmente.push({
        index: i,
        position: positionen[i],
        aufgaben: eintrag.aufgaben,
        antwortSalz: antwortSalz,
        iterationen: T.krypto.ITERATIONEN,
        schloss: { n: puzzle.n, a: puzzle.a, t: puzzle.t },   // b wird bewusst nicht gespeichert
        paket: paket,
        stand: { erledigt: 0, x: puzzle.a },
        offen: false,
        ziffer: null
      });
      puzzle.b = null;
    }

    /* Notausgang: ein zweites, unabhängiges Zeitschloss über das ganze
     * Geheimnis. Es kennt keine Aufgaben - es kostet nur Rechenzeit. */
    var notausgang = null;
    var notausgangSekunden = NOTAUSGANG_STUFEN[util.grenze((konfig.notausgang || {}).stufe || 0, 0, 4)];
    if (notausgangSekunden) {
      melde({ phase: 'notausgang', text: 'Notausgang schmieden ...', anteil: 1 });
      var exitSchritte = Math.max(50000, Math.round(rate * notausgangSekunden));
      var exitPuzzle = await T.zeitschloss.erzeugen(exitSchritte);
      notausgang = {
        sekunden: notausgangSekunden,
        frei: Date.now() + (konfig.notausgang.wartetage || 0) * 86400000,
        schloss: { n: exitPuzzle.n, a: exitPuzzle.a, t: exitPuzzle.t },
        paket: await T.krypto.verschluesseln('notausgang', exitPuzzle.b, geheimnis, null),
        stand: { erledigt: 0, x: exitPuzzle.a },
        benutzt: false
      };
      exitPuzzle.b = null;
    }

    /* Geheime Höchstzeit für den ganzen Tresor: jetzt gezogen, ab jetzt laufend. */
    var frist = null;
    var fristKonfig = konfig.geheimeFrist || {};
    if (fristKonfig.aktiv && fristKonfig.bezug === 'tresor') {
      frist = {
        sekunden: neueFrist(konfig, 0),
        start: Date.now(),
        rahmen: [Math.min(fristKonfig.minSekunden, fristKonfig.maxSekunden),
                 Math.max(fristKonfig.minSekunden, fristKonfig.maxSekunden)],
        abgelaufen: 0
      };
    }

    melde({ phase: 'fertig', text: 'Verriegelt.', anteil: 1 });
    return {
      version: 2,
      frist: frist,
      erstellt: Date.now(),
      saat: saat,
      laenge: laenge,
      konfig: konfig,
      rate: rate,
      sekundenProSchloss: sekundenProSchloss,
      fragmente: fragmente,
      notausgang: notausgang
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

  /* Ist das Zeitschloss geknackt, wird die Ziffer entschlüsselt. Die Antworten
   * der gebundenen Aufgaben gehen in den Schlüssel ein und werden danach
   * gelöscht - im Speicher bleibt nur die Ziffer. */
  async function fragmentOeffnen(tresor, fragment, bHex) {
    var antworten = fragment.aufgaben.filter(function (aufgabe) {
      return aufgabe.pruefung && aufgabe.zustand && aufgabe.zustand.antwort;
    }).map(function (aufgabe) { return aufgabe.zustand.antwort; });
    var material = await T.krypto.antwortMaterial(
      antworten, fragment.antwortSalz, fragment.iterationen || T.krypto.ITERATIONEN);
    fragment.ziffer = await T.krypto.entschluesseln(fragment.index, bHex, fragment.paket, material);
    fragment.offen = true;
    fragment.stand.erledigt = fragment.schloss.t;
    fragment.aufgaben.forEach(function (aufgabe) {
      if (aufgabe.zustand && aufgabe.zustand.antwort) aufgabe.zustand.antwort = true;
    });
    return fragment.ziffer;
  }

  /* Notausgang geknackt: das ganze Geheimnis wird auf die Fragmente verteilt. */
  async function notausgangOeffnen(tresor, bHex) {
    var geheimnis = await T.krypto.entschluesseln('notausgang', bHex, tresor.notausgang.paket, null);
    tresor.fragmente.forEach(function (fragment) {
      if (fragment.offen) return;
      fragment.ziffer = geheimnis.charAt(fragment.position);
      fragment.offen = true;
      fragment.stand.erledigt = fragment.schloss.t;
    });
    tresor.notausgang.benutzt = true;
    return geheimnis;
  }

  /* Ist die tresorweite Höchstzeit vorbei? Gilt nur, solange noch etwas
   * verschlossen ist - ein fertiger Tresor kennt keine Frist mehr. */
  function fristAbgelaufen(tresor, jetzt) {
    var f = tresor.frist;
    if (!f || !f.sekunden || alleOffen(tresor)) return false;
    return (jetzt || Date.now()) >= f.start + f.sekunden * 1000;
  }

  /* Höchstzeit verstrichen: alle noch verschlossenen Fragmente fallen auf
   * Anfang zurück. Geöffnete Ziffern bleiben geöffnet - die Frist kostet
   * Arbeit, niemals das Geheimnis. */
  function fristAusloesen(tresor) {
    var folge = (tresor.konfig.geheimeFrist || {}).folge || 'aufgaben';
    var bericht = { fragmente: 0, aufgaben: 0, schritte: 0, rechenzeitVerfallen: folge === 'alles' };
    tresor.fragmente.forEach(function (fragment) {
      if (fragment.offen) return;
      bericht.fragmente++;
      fragment.aufgaben.forEach(function (aufgabe) {
        if (aufgabe.erledigt) bericht.aufgaben++;
        aufgabe.erledigt = false;
        aufgabe.zustand = {};
      });
      if (folge === 'alles' && fragment.stand.erledigt) {
        bericht.schritte += fragment.stand.erledigt;
        fragment.stand = { erledigt: 0, x: fragment.schloss.a };
      }
    });
    tresor.frist.sekunden = neueFrist(tresor.konfig, 0);
    tresor.frist.start = Date.now();
    tresor.frist.abgelaufen = (tresor.frist.abgelaufen || 0) + 1;
    return bericht;
  }

  T.tresorLogik = {
    fristAbgelaufen: fristAbgelaufen,
    fristAusloesen: fristAusloesen,
    FRIST_WERTE: FRIST_WERTE,
    standardKonfiguration: standardKonfiguration,
    geschaetzteDauer: geschaetzteDauer,
    erstellen: erstellen,
    aktuellesFragment: aktuellesFragment,
    offeneAufgabe: offeneAufgabe,
    alleOffen: alleOffen,
    sichtbaresGeheimnis: sichtbaresGeheimnis,
    fragmentOeffnen: fragmentOeffnen,
    notausgangOeffnen: notausgangOeffnen,
    strafzeit: strafzeit,
    neueFrist: neueFrist,
    RECHENZEIT_STUFEN: RECHENZEIT_STUFEN,
    NOTAUSGANG_STUFEN: NOTAUSGANG_STUFEN,
    STRAFZEIT_BASIS: STRAFZEIT_BASIS
  };
})(typeof window !== 'undefined' ? window : globalThis);
