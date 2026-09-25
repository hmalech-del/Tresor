/* Der Tresor selbst: Aufgabenplan bauen, verriegeln, Fragment für Fragment
 * wieder herausgeben. */
(function (global) {
  'use strict';
  var T = global.Tresor || (global.Tresor = {});
  var util = T.util;

  var RECHENZEIT_STUFEN = [10, 45, 180, 600, 1800];        // Sekunden echter Rechenarbeit
  var NOTAUSGANG_WERTE = [300, 900, 1800, 3600, 7200, 10800, 18000, 28800, 43200, 86400,
                          172800, 259200, 604800, 1209600, 2419200];
  /* Ueber einen Tag hinaus nur, wo niemand dafuer rechnen muss: bei drand und
   * im Wartezeit-Modus. Einen Tag Rechenzeit schafft schon kein Handy. */
  var NOTAUSGANG_RECHENZEIT_MAX = 86400;
  var TRESORZEIT_WERTE = [600, 1800, 3600, 7200, 10800, 21600, 43200, 86400,
                          172800, 259200, 432000, 604800, 1209600, 2419200];
  var PRUEFSCHRITT = 250000;                               // Raster der Blindprüfung
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
      sicherheit: 'rechenzeit',      // 'rechenzeit' | 'drand' (Netz) | 'ohne-rechenzeit'
      /* Nur fuer drand: der Zeitrahmen. Die Uhr startet oben (ohne eine
       * einzige Pruefung), jede geloeste Pruefung holt sie Richtung unten,
       * jeder Fehler schiebt sie weg - bis zum Notausgang. */
      tresorzeit: { minSekunden: 3600, maxSekunden: 7200 },
      sensoren: false,               // Lagesensoren nur, wenn das Gerät sie wirklich hat
      gluecksspiel: false,           // Wartezeiten dürfen verwürfelt werden
      blind: false,                  // "Meine Regeln": der Game Master wuerfelt alles aus und sagt nichts
      strafe: 0,
      erinnerungen: false,           // gehört zum Tresor: selbst dran denken ist eine Option
      geheimeFrist: {
        aktiv: false,
        bezug: 'tresor',            // 'tresor' = absolute Spanne, 'aufgabe' = Vielfaches der Schätzung
        minSekunden: 3600,
        maxSekunden: 18000,
        minFaktor: 1.2,
        maxFaktor: 3,
        folge: 'aufgaben'           // 'aufgaben' oder 'alles' (Rechenzeit verfällt mit)
      },
      /* Vorgabe ist bewusst der sichere Weg: eine feste halbe Stunde. Wer
       * den Notausgang uebersieht und dann an den Aufgaben scheitert, sitzt
       * sonst ohne Ausweg da - und der Tresor haelt, was er verspricht. */
      notausgang: { modus: 'fest', sekunden: 1800, minSekunden: 1800, maxSekunden: 10800 }
    };
  }

  function rechenzeitModus(konfig) {
    return (konfig.sicherheit || 'rechenzeit') === 'rechenzeit';
  }

  function drandModus(konfig) {
    return konfig.sicherheit === 'drand';
  }

  /* Ohne Notausgang gibt es keine Zusage, wann spaetestens Schluss ist - aber
   * eine Leiter braucht eine oberste Sprosse, weil jede beim Verriegeln
   * entstehen muss. Das Zehnfache der Tresorzeit ist praktisch unerreichbar. */
  var DRAND_DECKEL_FAKTOR = 10;

  /* Strafe im drand-Modus: ein Anteil der gezogenen Tresorzeit, nicht ein
   * fester Wert. Zwanzig Sekunden waeren bei einem Wochentresor nichts,
   * eine Stunde bei einem Stundentresor alles. Jede Wiederholung wiegt
   * anderthalbmal so schwer, eine einzelne Strafe hoechstens die ganze
   * Tresorzeit. */
  var DRAND_STRAFE_ANTEIL = [0, 0.06, 0.15];                 // aus, mild, hart

  /* Takt: Bei langen Tresoren kommen die Pruefungen verteilt, nicht alle auf
   * einmal - sonst waere ein Wochentresor ein Nachmittag Arbeit und danach
   * nur Warten. Verteilt wird ueber die untere Grenze des Zeitrahmens: Wer
   * jede Pruefung loest, sobald sie kommt, ist mit der letzten genau dort.
   *
   * Puenktlich heisst: binnen eines Taktes, aber mindestens zwoelf Stunden.
   * Sonst verfiele eine Pruefung, die um drei Uhr nachts kommt, im Schlaf.
   * Wer spaeter loest, bekommt die halbe Gutschrift.
   *
   * Unter sechs Stunden gibt es keinen Takt: Bei einem Stundentresor stehen
   * alle Pruefungen sofort bereit. Als Objekt, damit Tests es stauchen
   * koennen. */
  var TAKT = { ab: 6 * 3600, fensterMin: 12 * 3600, spaetAnteil: 0.5 };

  function drandStrafe(konfig, fehlversuche, tresorzeitSek) {
    var anteil = DRAND_STRAFE_ANTEIL[util.grenze(konfig.strafe || 0, 0, 2)];
    if (!anteil || !tresorzeitSek) return 0;
    var roh = tresorzeitSek * anteil * Math.pow(1.5, Math.max(0, fehlversuche - 1));
    return Math.round(Math.min(tresorzeitSek, roh));
  }

  function zufallsHex(bytes) {
    var werte = new Uint8Array(bytes);
    global.crypto.getRandomValues(werte);
    return util.bytesZuHex(werte);
  }

  function aufRaster(schritte) {
    return Math.max(PRUEFSCHRITT, Math.round(schritte / PRUEFSCHRITT) * PRUEFSCHRITT);
  }

  /* Gleichverteilter Anteil aus dem Zufallsgenerator des Systems - die Ziehung
   * der Notausgang-Dauer soll nicht vorhersagbar sein. */
  function zufallsAnteil() {
    var werte = new Uint32Array(1);
    global.crypto.getRandomValues(werte);
    return werte[0] / 4294967296;
  }

  function zufallsGanz(min, max) {
    return min + Math.floor(zufallsAnteil() * (max - min + 1));
  }

  /* Blindgang: Der Nutzer setzt nur den Notausgang, alles andere zieht der
   * Game Master - und zeigt es nicht. Gezogen wird mit dem Systemzufall, nicht
   * mit dem gespeicherten Saat-Strom des Tresors: Aus der Saat liesse sich
   * der Plan sonst nachrechnen, und der soll im Dunkeln bleiben. */
  function blindKonfiguration(notausgang, sensorenMoeglich, ohneRechenzeit) {
    /* Ohne beschriebene Marken gibt es keine Stationen - und die schreibt
     * man von Hand, das kann der Game Master nicht uebernehmen. */
    var alle = T.herausforderungen.dimensionen.map(function (d) { return d.id; })
      .filter(function (id) { return id !== 'ort' || T.ortAufgaben.vorratGroesse() >= 2; });
    for (var i = alle.length - 1; i > 0; i--) {
      var j = zufallsGanz(0, i);
      var merk = alle[i]; alle[i] = alle[j]; alle[j] = merk;
    }
    var gewaehlt = alle.slice(0, zufallsGanz(2, alle.length));
    var stufen = {};
    gewaehlt.forEach(function (d) { stufen[d] = zufallsGanz(2, 5); });
    var mitFrist = zufallsAnteil() < 0.5;
    return {
      dimensionen: gewaehlt,
      stufen: stufen,
      aufgabenProFragment: zufallsGanz(1, 3),
      rechenzeit: zufallsGanz(1, 4),
      reihenfolge: zufallsAnteil() < 0.5 ? 'links' : 'zufall',
      /* Haerte und Ungewissheit sind zwei verschiedene Dinge. Der Modus
       * nimmt dem Spieler jede Ansage - ob das Geraet dafuer stundenlang
       * rechnen soll, bleibt trotzdem seine Entscheidung. */
      sicherheit: ohneRechenzeit ? 'ohne-rechenzeit' : 'rechenzeit',
      sensoren: !!sensorenMoeglich && zufallsAnteil() < 0.5,
      strafe: zufallsGanz(1, 2),
      gluecksspiel: true,
      blind: true,
      erinnerungen: false,
      geheimeFrist: {
        aktiv: mitFrist,
        bezug: 'aufgabe',
        minSekunden: 3600,
        maxSekunden: 18000,
        minFaktor: 1.2,
        maxFaktor: 2 + zufallsAnteil() * 2,
        folge: 'aufgaben'
      },
      notausgang: notausgang
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

  /* Das Zeitbudget, das der Notausgang aufspannt.
   *
   * Wer den Ausgang auf drei Stunden setzt, sagt damit: laenger als drei
   * Stunden habe ich nicht. Eine Aufgabe, die allein neunzehn Stunden
   * wartet, bricht dieses Versprechen - und macht den Aufgabenweg sinnlos,
   * weil der Ausgang dann immer die bessere Wahl waere.
   *
   * Massgeblich ist die Obergrenze der Spanne: Das ist das Schlimmste, worauf
   * sich der Spieler eingelassen hat. Ohne Notausgang gibt es kein
   * Versprechen und damit auch keine Grenze. */
  function zeitBudget(konfig) {
    var exit = konfig.notausgang || {};
    var modus = exit.modus || (exit.maxSekunden ? 'geheim' : 'aus');
    if (modus === 'aus') return 0;
    if (modus === 'fest') return Math.max(0, exit.sekunden || 0);
    return Math.max(exit.minSekunden || 0, exit.maxSekunden || 0);
  }

  /* Aufgabenplan: zieht reihum aus einem gemischten Topf, damit sich innerhalb
   * eines Tresors nichts wiederholt, solange der Topf reicht - und variiert
   * danach wenigstens die Parameter. Typen, die zuletzt dran waren, rutschen
   * ans Ende des Topfes. */
  function aufgabenPlan(zufall, konfig, anzahlFragmente, nurVorschau) {
    var vermeiden = T.speicher ? T.speicher.zuletztBenutzt() : [];
    /* Das Budget verteilt sich gleichmaessig auf alle Aufgabenplaetze: Die
     * Summe aller Wartezeiten soll unter dem Notausgang bleiben, nicht nur
     * jede einzelne. */
    var budget = zeitBudget(konfig);
    var plaetze = Math.max(1, anzahlFragmente * Math.max(1, konfig.aufgabenProFragment || 1));
    var proPlatz = budget ? Math.max(30, Math.floor(budget / plaetze)) : 0;
    var toepfe = konfig.dimensionen.map(function (dimension) {
      var stufeDerDimension = konfig.stufen[dimension] || 3;
      var module = T.herausforderungen.nachDimension(dimension).filter(function (m) {
        // Manche Aufgaben sind erst ab einer gewissen Intensität sinnvoll
        if (m.mindestStufe && stufeDerDimension < m.mindestStufe) return false;
        // Sensoraufgaben nur, wenn sie beim Einrichten zugelassen wurden
        if (m.sensor && !konfig.sensoren) return false;
        /* Aufgaben, deren Wartezeit sich nicht stauchen laesst - eine feste
         * Tageszeit etwa - kommen nur in Frage, wenn der Notausgang weit
         * genug weg ist. Sonst waere er schneller als das Warten. */
        if (m.budgetBedarf && budget && budget < m.budgetBedarf) return false;
        return true;
      }).map(function (m) { return m.id; });
      if (!module.length) return null;
      var gemischt = zufall.mische(module);
      gemischt.sort(function (a, b) {
        return (vermeiden.indexOf(a) === -1 ? 0 : 1) - (vermeiden.indexOf(b) === -1 ? 0 : 1);
      });
      return { dimension: dimension, vorrat: gemischt, zeiger: 0 };
    }).filter(Boolean);

    if (!toepfe.length) return [];
    /* Reihenfolge der Dimensionen mischen: Sonst wäre bei mehr Dimensionen als
     * Aufgabenplätzen immer dieselbe - nämlich die zuletzt gewählte - die, die
     * gar nicht drankommt. */
    toepfe = zufall.mische(toepfe);

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
        var params = modul.erzeuge(zufall, stufe, proPlatz);
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
    if (rechenzeitModus(konfig)) {
      summe += laenge * RECHENZEIT_STUFEN[util.grenze(konfig.rechenzeit, 1, 5) - 1];
    }
    var mitZeitfenster = plan.some(function (fragment) {
      return fragment.aufgaben.some(function (a) { return a.id === 'zeitfenster'; });
    });
    var gebundene = plan.reduce(function (summe2, fragment) { return summe2 + fragment.loesungen.length; }, 0);
    var genutzt = {};
    plan.forEach(function (fragment) {
      fragment.aufgaben.forEach(function (aufgabe) { genutzt[aufgabe.dimension] = true; });
    });
    return {
      sekunden: summe,
      mitZeitfenster: mitZeitfenster,
      gebundeneAufgaben: gebundene,
      plaetze: laenge * konfig.aufgabenProFragment,
      genutzteDimensionen: Object.keys(genutzt)
    };
  }

  /* drand: Jede Pruefung bekommt einen Freischaltzeitpunkt und eine
   * Puenktlichkeitsgrenze, und alle zusammen teilen sich die Spanne des
   * Rahmens als Gutschrift - wer alle loest, landet an der unteren Grenze. */
  function taktVerteilen(freigabe, fragmente) {
    var alle = [];
    fragmente.forEach(function (fr) { fr.aufgaben.forEach(function (a) { alle.push(a); }); });
    var n = alle.length;
    var unten = freigabe.rahmen[0], oben = freigabe.rahmen[1];
    var takt = (unten >= TAKT.ab && n > 1) ? unten / n : 0;
    var fenster = takt ? Math.max(takt, TAKT.fensterMin) : oben;
    alle.forEach(function (aufgabe, k) {
      aufgabe.frei = freigabe.start + Math.round(k * takt * 1000);
      aufgabe.puenktlichBis = aufgabe.frei + Math.round(fenster * 1000);
    });
    freigabe.gutschrift = n ? (oben - unten) / n : 0;
    freigabe.takt = takt;
    freigabe.fenster = fenster;
  }

  /* Notausgang-Dauer ziehen. Vorab, weil drand sie als Obergrenze seiner
   * Leiter braucht, bevor das erste Fragment verschluesselt wird. */
  function notausgangZiehen(konfig) {
    var exitKonfig = konfig.notausgang || {};
    var modus = exitKonfig.modus || (exitKonfig.maxSekunden ? 'geheim' : 'aus');
    if (modus === 'aus') return null;
    var min, max;
    if (modus === 'fest') {
      min = max = Math.max(1, exitKonfig.sekunden || 0);
    } else {
      min = Math.max(1, Math.min(exitKonfig.minSekunden || 0, exitKonfig.maxSekunden || 0));
      max = Math.max(min, Math.max(exitKonfig.minSekunden || 0, exitKonfig.maxSekunden || 0));
    }
    return {
      modus: modus, min: min, max: max,
      gezogen: min === max ? min : Math.round(min + zufallsAnteil() * (max - min))
    };
  }

  /* Verriegeln: für jedes Fragment ein Zeitschloss schmieden, die Antworten der
   * gebundenen Aufgaben in den Schlüssel rechnen und die Ziffer damit
   * verschlüsseln. Danach sind Klartext und Lösungen weg. */
  async function erstellen(optionen) {
    var art = optionen.art || 'zahl';
    var teile = optionen.teile;                 // ein Stück Geheimnis je Fragment
    var konfig = optionen.konfig;
    var melde = optionen.beiFortschritt || function () {};
    var saat = T.neueSaat();
    var zufall = new T.Zufall(saat);
    var laenge = teile.length;
    var mitRechenzeit = rechenzeitModus(konfig);
    var mitDrand = drandModus(konfig);
    var exitZug = notausgangZiehen(konfig);
    var start = Date.now();

    /* drand: Ein Zeitschluessel Z fuer den ganzen Tresor, verschlossen auf
     * eine Leiter kuenftiger Runden. Jedes Fragment braucht Z und seine
     * Antworten - vor der Freigabezeit geht also keines auf, egal wie gut
     * gespielt wurde. Die Leiter reicht von der gezogenen Tresorzeit bis zum
     * Notausgang; was darueber liegt, existiert nicht. */
    var zeitschluessel = null, freigabe = null;
    if (mitDrand) {
      var tz = konfig.tresorzeit || {};
      var tzMin = Math.max(10, Math.min(tz.minSekunden || 3600, tz.maxSekunden || 3600));
      var tzMax = Math.max(tzMin, Math.max(tz.minSekunden || 3600, tz.maxSekunden || 3600));
      /* Kommt der Notausgang vor dem Rahmen, ist er der Deckel - und der
       * Rahmen rueckt darunter, damit die Leiter nicht verkehrt herum steht. */
      var deckel = exitZug ? exitZug.gezogen : tzMax * DRAND_DECKEL_FAKTOR;
      tzMax = Math.min(tzMax, deckel);
      tzMin = Math.min(tzMin, tzMax);
      var tresorzeit = tzMax;                                // Start: ohne eine einzige Pruefung
      var leiter = T.zeitkonto.relativeLeiter(tzMin, deckel, 90);
      var runden = leiter.map(function (sek) { return T.drand.rundeZu(start + sek * 1000); });
      zeitschluessel = zufallsHex(32);
      melde({ phase: 'schmieden', text: 'Freigabe an das Netz binden ...', anteil: 0 });
      var pakete = await T.drand.verschliessen(runden, zeitschluessel, function (fertig, von) {
        melde({ phase: 'schmieden', text: 'Freigabe an das Netz binden ... ' + fertig + ' / ' + von,
          anteil: fertig / von * 0.8 });
      });
      freigabe = {
        art: 'drand', kette: T.drand.kette().hash, start: start,
        rahmen: [tzMin, tzMax], tresorzeit: tresorzeit, deckel: deckel,
        leiter: leiter, runden: runden, pakete: pakete,
        konto: { zielSek: tresorzeit },
        gutschrift: 0, takt: 0, fenster: 0, gutgeschrieben: [],
        letzteBuchung: null,
        z: null
      };
      tresorzeit = null;
    }

    /* Passphrase, falls gesetzt: Material einmal ableiten, Salze und Prüfwert
     * merken - die Passphrase selbst wird nirgends gespeichert. */
    var passSalz = null, passPruefSalz = null, passPruef = null, passMat = null;
    if (optionen.passphrase) {
      melde({ phase: 'passphrase', text: 'Passphrase verrechnen ...' });
      passSalz = T.krypto.neuesSalz();
      passPruefSalz = T.krypto.neuesSalz();
      passMat = await T.krypto.passMaterial(optionen.passphrase, passSalz, T.krypto.ITERATIONEN);
      passPruef = await T.krypto.passPruefung(optionen.passphrase, passPruefSalz, T.krypto.ITERATIONEN);
    }

    var rate = 0, sekundenProSchloss = 0, schritte = 0;
    if (mitRechenzeit) {
      melde({ phase: 'messen', text: 'Rechenleistung dieses Geräts messen ...' });
      rate = await T.zeitschloss.messen();
      sekundenProSchloss = RECHENZEIT_STUFEN[util.grenze(konfig.rechenzeit, 1, 5) - 1];
      schritte = Math.max(50000, Math.round(rate * sekundenProSchloss));
    }

    var plan = aufgabenPlan(zufall, konfig, laenge);
    var reihe = teile.map(function (_, i) { return i; });
    // Nur Ziffern lassen sich in beliebiger Reihenfolge freigeben; Bildstufen
    // bauen aufeinander auf und kommen immer von grob nach fein.
    var positionen = (art === 'zahl' && konfig.reihenfolge === 'zufall') ? zufall.mische(reihe) : reihe;

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

      /* Im leichten Modus gibt es kein Zeitschloss: Der Schlüsselanteil liegt
       * offen daneben. Das kostet keinen Strom und hält niemanden auf, der den
       * Speicher liest - die Aufgaben bleiben trotzdem eine Hürde, und
       * antwortgebundene Rätsel wirken weiter. */
      var schluessel = (mitRechenzeit || mitDrand) ? null : zufallsHex(32);
      var puzzle = mitRechenzeit ? await T.zeitschloss.erzeugen(schritte) : null;
      var geheimteil = teile[positionen[i]];
      var zeitteil = mitRechenzeit ? puzzle.b : (mitDrand ? zeitschluessel : schluessel);
      var paket = await T.krypto.verschluesseln(i, zeitteil, geheimteil, material, passMat);

      fragmente.push({
        index: i,
        position: positionen[i],
        aufgaben: eintrag.aufgaben,
        antwortSalz: antwortSalz,
        iterationen: T.krypto.ITERATIONEN,
        schluessel: schluessel,                               // nur im leichten Modus
        schloss: puzzle ? { n: puzzle.n, a: puzzle.a, t: puzzle.t } : null,   // b wird bewusst nicht gespeichert
        drand: mitDrand,                                      // Zeitteil ist der Zeitschluessel des Tresors
        paket: paket,
        stand: puzzle ? { erledigt: 0, x: puzzle.a } : { erledigt: 0, x: null },
        offen: false,
        inhalt: null
      });
      if (puzzle) puzzle.b = null;
    }

    if (freigabe) taktVerteilen(freigabe, fragmente);

    /* Notausgang: ein zweites, unabhängiges Zeitschloss über das ganze
     * Geheimnis. Es kennt keine Aufgaben - es kostet nur Rechenzeit.
     *
     * Die Schrittzahl wird zufällig aus der eingestellten Spanne gezogen und
     * NICHT gespeichert. Abgelegt wird nur SHA-256 der Lösung: Der Rechner
     * quadriert und merkt am Prüfwert selbst, wann er angekommen ist. Damit
     * weiß niemand vorher, wie lange es dauert - weder du noch die App noch
     * jemand, der den Speicher ausliest. Bekannt ist nur die Spanne. */
    /* Notausgang: der zweite Weg zum ganzen Geheimnis, falls man an einer
     * Aufgabe hängen bleibt. Drei Spielarten:
     *
     *   fest    - genau die eingestellte Dauer, wird angezeigt
     *   zufall  - aus der Spanne gezogen, der gezogene Wert wird angezeigt
     *   geheim  - aus der Spanne gezogen und nirgends abgelegt; bei
     *             Rechenzeit merkt der Rechner am Prüfwert selbst, wann er
     *             angekommen ist, sodass die Dauer wirklich niemand kennt.
     *
     * Ohne Rechenzeit zahlt derselbe Notausgang in Wartezeit statt in
     * Quadrierungen. */
    var notausgang = null;
    if (exitZug) {
      var exitModus = exitZug.modus, exitMin = exitZug.min, exitMax = exitZug.max;
      var gezogen = exitZug.gezogen;
      exitZug = null;

      melde({ phase: 'notausgang', text: 'Notausgang schmieden ...', anteil: 1 });

      if (mitDrand) {
        /* Ueber das Netz: Die Runde steht im Paket selbst, "geheim" verbirgt
         * sie deshalb nur in der Anzeige, nicht vor jemandem, der den
         * Speicher liest. Dafuer gilt die Zusage wirklich - frueher oeffnet
         * es niemand, spaeter jeder. */
        var exitZeitschluessel = zufallsHex(32);
        var exitRunde = T.drand.rundeZu(start + gezogen * 1000);
        var exitZeitpaket = (await T.drand.verschliessen([exitRunde], exitZeitschluessel))[0];
        notausgang = {
          art: 'drand', modus: exitModus,
          rahmen: [exitMin, exitMax],
          sekunden: exitModus === 'geheim' ? null : gezogen,
          frei: T.drand.zeitVon(exitRunde),
          runde: exitRunde,
          zeitpaket: exitZeitpaket,
          paket: await T.krypto.verschluesseln('notausgang', exitZeitschluessel, JSON.stringify(teile), null, passMat),
          benutzt: false
        };
        exitZeitschluessel = null;
      } else if (mitRechenzeit && exitModus === 'geheim') {
        var untergrenze = aufRaster(rate * exitMin);
        var obergrenze = Math.max(untergrenze + PRUEFSCHRITT, aufRaster(rate * exitMax));
        var exitSchritte = Math.min(Math.max(aufRaster(rate * gezogen), untergrenze), obergrenze);
        var blindPuzzle = await T.zeitschloss.erzeugen(exitSchritte);
        notausgang = {
          art: 'rechenzeit', modus: 'geheim', blind: true, mitlaufen: false,
          rahmen: [exitMin, exitMax], frei: 0,
          schloss: {
            n: blindPuzzle.n, a: blindPuzzle.a,
            pruef: await T.krypto.pruefwert(blindPuzzle.b),
            untergrenze: untergrenze, obergrenze: obergrenze, pruefschritt: PRUEFSCHRITT
          },
          paket: await T.krypto.verschluesseln('notausgang', blindPuzzle.b, JSON.stringify(teile), null, passMat),
          stand: { erledigt: 0, x: blindPuzzle.a },
          benutzt: false
        };
        blindPuzzle.b = null;
        exitSchritte = null;
      } else if (mitRechenzeit) {
        var offeneSchritte = Math.max(PRUEFSCHRITT, Math.round(rate * gezogen));
        var offenesPuzzle = await T.zeitschloss.erzeugen(offeneSchritte);
        notausgang = {
          art: 'rechenzeit', modus: exitModus, blind: false, mitlaufen: false,
          rahmen: [exitMin, exitMax], sekunden: gezogen, frei: 0,
          schloss: { n: offenesPuzzle.n, a: offenesPuzzle.a, t: offeneSchritte },
          paket: await T.krypto.verschluesseln('notausgang', offenesPuzzle.b, JSON.stringify(teile), null, passMat),
          stand: { erledigt: 0, x: offenesPuzzle.a },
          benutzt: false
        };
        offenesPuzzle.b = null;
      } else {
        /* Ohne Rechenzeit hilft nur die Uhr. Das ist keine kryptografische
         * Sperre - der Schlüssel liegt daneben, wie alles in diesem Modus. */
        var exitSchluessel = zufallsHex(32);
        notausgang = {
          art: 'wartezeit', modus: exitModus,
          rahmen: [exitMin, exitMax],
          sekunden: exitModus === 'geheim' ? null : gezogen,
          frei: Date.now() + gezogen * 1000,
          gesehen: Date.now(),
          schluessel: exitSchluessel,
          paket: await T.krypto.verschluesseln('notausgang', exitSchluessel, JSON.stringify(teile), null, passMat),
          benutzt: false
        };
      }
      gezogen = null;
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
    passMat = null;
    zeitschluessel = null;
    return {
      version: 3,
      passSalz: passSalz,
      passPruefSalz: passPruefSalz,
      passPruef: passPruef,
      id: 't' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36),
      art: art,
      frist: frist,
      erstellt: Date.now(),
      saat: saat,
      laenge: laenge,
      konfig: konfig,
      rate: rate,
      sekundenProSchloss: sekundenProSchloss,
      fragmente: fragmente,
      notausgang: notausgang,
      freigabe: freigabe
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
      if (f.offen && f.inhalt !== null) zeichen[f.position] = f.inhalt;
    });
    return zeichen;
  }

  /* Bild: die schärfste bereits freigegebene Stufe. */
  function besteStufe(tresor) {
    var bestes = null;
    tresor.fragmente.forEach(function (f) {
      if (f.offen && f.inhalt) bestes = { stufe: f.position + 1, bild: f.inhalt };
    });
    return bestes;
  }

  /* Ist das Zeitschloss geknackt, wird die Ziffer entschlüsselt. Die Antworten
   * der gebundenen Aufgaben gehen in den Schlüssel ein und werden danach
   * gelöscht - im Speicher bleibt nur die Ziffer. */
  async function fragmentOeffnen(tresor, fragment, bHex, passMat) {
    var antworten = fragment.aufgaben.filter(function (aufgabe) {
      return aufgabe.pruefung && aufgabe.zustand && aufgabe.zustand.antwort;
    }).map(function (aufgabe) { return aufgabe.zustand.antwort; });
    var material = await T.krypto.antwortMaterial(
      antworten, fragment.antwortSalz, fragment.iterationen || T.krypto.ITERATIONEN);
    fragment.inhalt = await T.krypto.entschluesseln(
      fragment.index, fragment.schluessel || bHex, fragment.paket, material, passMat);
    fragment.offen = true;
    if (fragment.schloss) fragment.stand.erledigt = fragment.schloss.t;
    fragment.aufgaben.forEach(function (aufgabe) {
      if (aufgabe.zustand && aufgabe.zustand.antwort) aufgabe.zustand.antwort = true;
    });
    return fragment.inhalt;
  }

  /* Notausgang geknackt: das ganze Geheimnis wird auf die Fragmente verteilt. */
  /* Wartezeit-Notausgang: läuft die Uhr rückwärts, wandert der Termin mit -
   * sonst wäre die Sperre mit einer Zeitumstellung erledigt. */
  function notausgangUhrPruefen(tresor) {
    var exit = tresor.notausgang;
    if (!exit || exit.art !== 'wartezeit' || exit.benutzt) return false;
    var jetzt = Date.now();
    var verschoben = false;
    if (exit.gesehen && jetzt < exit.gesehen - 120000) {
      exit.frei += (exit.gesehen - jetzt);
      verschoben = true;
    }
    exit.gesehen = Math.max(exit.gesehen || 0, jetzt);
    return verschoben;
  }

  function notausgangBereit(tresor) {
    var exit = tresor.notausgang;
    if (!exit || exit.benutzt) return false;
    return Date.now() >= (exit.frei || 0);
  }

  async function notausgangOeffnen(tresor, bHex, passMat) {
    var teile = JSON.parse(await T.krypto.entschluesseln(
      'notausgang', tresor.notausgang.schluessel || bHex, tresor.notausgang.paket, null, passMat));
    tresor.fragmente.forEach(function (fragment) {
      if (fragment.offen) return;
      fragment.inhalt = teile[fragment.position];
      fragment.offen = true;
      if (fragment.schloss) fragment.stand.erledigt = fragment.schloss.t;
    });
    tresor.notausgang.benutzt = true;
    return teile;
  }

  /* drand: die Sprosse, auf die das Zeitkonto gerade zeigt. */
  function freigabeKonto(tresor) {
    return new T.zeitkonto.Konto(tresor.freigabe.leiter, tresor.freigabe.konto);
  }

  function freigabeZiel(tresor) {
    var f = tresor.freigabe;
    if (!f) return null;
    var i = freigabeKonto(tresor).sprosse();
    return { index: i, sekunden: f.leiter[i], runde: f.runden[i],
             zeit: T.drand.zeitVon(f.runden[i]), paket: f.pakete[i] };
  }

  function freigabeErreicht(tresor) {
    var f = tresor.freigabe;
    if (!f) return false;
    return !!f.z || Date.now() >= freigabeZiel(tresor).zeit;
  }

  /* Den Zeitschluessel beim Netz abholen. Einmal geholt, bleibt er gespeichert -
   * der Beacon ist dann ohnehin oeffentlich, und so geht der Tresor auch
   * offline weiter auf, sobald die Aufgaben erledigt sind. */
  async function freigabeHolen(tresor) {
    var f = tresor.freigabe;
    if (f.z) return f.z;
    var ziel = freigabeZiel(tresor);
    f.z = await T.drand.oeffnen(ziel.runde, ziel.paket);
    return f.z;
  }

  /* Am Netz gibt es keine Reihenfolge der Fragmente: Die Zeit haengt am
   * ganzen Tresor, nicht an einem Fragment. Die Pruefungen laufen deshalb
   * ueber alle Fragmente hinweg in einer Reihe - begrenzt nur vom Takt.
   * Bisher lief es Fragment fuer Fragment, und das zweite kam erst nach der
   * Freigabe dran; dann haetten seine Pruefungen keine Zeit mehr holen
   * koennen. */
  function netzLage(tresor, jetzt) {
    jetzt = jetzt || Date.now();
    var offen = [], nr = 0, gesamt = 0, bereit = [];
    tresor.fragmente.forEach(function (fragment) {
      var alleErledigt = true;
      fragment.aufgaben.forEach(function (aufgabe) {
        gesamt++;
        if (!aufgabe.erledigt) {
          alleErledigt = false;
          if (!fragment.offen) offen.push({ fragment: fragment, aufgabe: aufgabe, nr: gesamt });
        }
      });
      if (alleErledigt && !fragment.offen) bereit.push(fragment);
    });
    var jetztDran = offen.filter(function (e) { return (e.aufgabe.frei || 0) <= jetzt; })[0] || null;
    var naechste = jetztDran ? null : offen[0] || null;
    return {
      fragment: jetztDran && jetztDran.fragment,
      aufgabe: jetztDran && jetztDran.aufgabe,
      nr: jetztDran ? jetztDran.nr : 0,
      gesamt: gesamt,
      naechsteAb: naechste ? naechste.aufgabe.frei : 0,
      offen: offen.length,
      bereit: bereit
    };
  }

  /* Was eine Pruefung jetzt einbringt - fuer die Anzeige vor dem Loesen. */
  function gutschriftWert(tresor, aufgabe, jetzt) {
    var f = tresor.freigabe;
    if (!f || f.z || !f.gutschrift) return { sekunden: 0, puenktlich: true };
    var puenktlich = (jetzt || Date.now()) <= (aufgabe.puenktlichBis || Infinity);
    return { sekunden: Math.round(f.gutschrift * (puenktlich ? 1 : TAKT.spaetAnteil)), puenktlich: puenktlich };
  }

  /* Pruefung geloest: Zeit gutschreiben. Jede nur einmal - faellt der Tresor
   * durch eine abgelaufene Hoechstzeit auf Anfang zurueck, gibt das zweite
   * Loesen keine zweite Gutschrift. */
  function gutschriftBuchen(tresor, fragment, aufgabe, jetzt) {
    var f = tresor.freigabe;
    if (!f || f.z) return null;
    var schluessel = fragment.index + ':' + fragment.aufgaben.indexOf(aufgabe);
    f.gutgeschrieben = f.gutgeschrieben || [];
    if (f.gutgeschrieben.indexOf(schluessel) !== -1) return null;
    var wert = gutschriftWert(tresor, aufgabe, jetzt);
    if (!wert.sekunden) return null;
    var konto = freigabeKonto(tresor);
    var ergebnis = konto.verschieben(-wert.sekunden);
    f.konto = konto.stand();
    f.gutgeschrieben.push(schluessel);
    ergebnis.art = 'gutschrift';
    ergebnis.puenktlich = wert.puenktlich;
    ergebnis.neueZeit = freigabeZiel(tresor).zeit;
    ergebnis.zeit = jetzt || Date.now();
    f.letzteBuchung = ergebnis;
    return ergebnis;
  }

  /* Strafe im drand-Modus: das Zeitkonto nach hinten schieben. Gibt zurueck,
   * was wirklich angekommen ist - am Deckel nichts mehr, und der Spieler soll
   * das sehen. Ist Z schon geholt, ist die Freigabe vorbei; dann wirkt keine
   * Strafe mehr auf die Zeit. */
  function strafeBuchen(tresor, fehlversuche) {
    var f = tresor.freigabe;
    if (!f || f.z) return null;
    var sekunden = drandStrafe(tresor.konfig, fehlversuche, f.tresorzeit);
    if (!sekunden) return null;
    var konto = freigabeKonto(tresor);
    var ergebnis = konto.verschieben(sekunden);
    f.konto = konto.stand();
    ergebnis.art = 'strafe';
    ergebnis.neueZeit = freigabeZiel(tresor).zeit;
    return ergebnis;
  }

  /* Das Zeitkonto direkt verschieben - fuer den Wurf ueber eine Strafe. Nach
   * vorn geht es nur bis zur gezogenen Tresorzeit, nach hinten bis zum Deckel. */
  function zeitkontoVerschieben(tresor, sekunden) {
    var f = tresor.freigabe;
    if (!f || f.z) return null;
    var konto = freigabeKonto(tresor);
    var ergebnis = konto.verschieben(sekunden);
    f.konto = konto.stand();
    return ergebnis;
  }

  /* Notausgang ueber das Netz: erst den Zeitschluessel holen, dann wie immer. */
  async function notausgangUeberNetz(tresor, passMat) {
    var exit = tresor.notausgang;
    var hex = await T.drand.oeffnen(exit.runde, exit.zeitpaket);
    return notausgangOeffnen(tresor, hex, passMat);
  }

  /* Eintrag für den Verlauf: das Ergebnis, damit ein neuer Tresor oder ein
   * geschlossener Tab es nicht mitnimmt. Bei Bildern wird nur die schärfste
   * Stufe aufbewahrt. */
  function archivEintrag(tresor) {
    var ergebnis = tresor.art === 'foto'
      ? (besteStufe(tresor) || {}).bild || ''
      : sichtbaresGeheimnis(tresor).join('');
    return {
      id: tresor.id || ('t' + tresor.erstellt),
      art: tresor.art || 'zahl',
      erstellt: tresor.erstellt,
      geoeffnet: Date.now(),
      stufen: tresor.laenge,
      sicherheit: (tresor.konfig || {}).sicherheit || 'rechenzeit',
      notausgangBenutzt: !!(tresor.notausgang && tresor.notausgang.benutzt),
      ergebnis: ergebnis
    };
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

  function brauchtPassphrase(tresor) { return !!(tresor && tresor.passSalz); }

  /* Stimmt die Passphrase? Kostet absichtlich eine volle PBKDF2-Ableitung. */
  async function passphrasePruefen(tresor, passphrase) {
    if (!brauchtPassphrase(tresor)) return true;
    var pruef = await T.krypto.passPruefung(passphrase, tresor.passPruefSalz, T.krypto.ITERATIONEN);
    return pruef === tresor.passPruef;
  }

  async function passphraseMaterial(tresor, passphrase) {
    if (!brauchtPassphrase(tresor)) return null;
    return T.krypto.passMaterial(passphrase, tresor.passSalz, T.krypto.ITERATIONEN);
  }

  T.tresorLogik = {
    brauchtPassphrase: brauchtPassphrase,
    passphrasePruefen: passphrasePruefen,
    passphraseMaterial: passphraseMaterial,
    fristAbgelaufen: fristAbgelaufen,
    fristAusloesen: fristAusloesen,
    FRIST_WERTE: FRIST_WERTE,
    standardKonfiguration: standardKonfiguration,
    blindKonfiguration: blindKonfiguration,
    zeitBudget: zeitBudget,
    geschaetzteDauer: geschaetzteDauer,
    erstellen: erstellen,
    aktuellesFragment: aktuellesFragment,
    offeneAufgabe: offeneAufgabe,
    alleOffen: alleOffen,
    sichtbaresGeheimnis: sichtbaresGeheimnis,
    besteStufe: besteStufe,
    archivEintrag: archivEintrag,
    fragmentOeffnen: fragmentOeffnen,
    notausgangOeffnen: notausgangOeffnen,
    notausgangBereit: notausgangBereit,
    notausgangUhrPruefen: notausgangUhrPruefen,
    rechenzeitModus: rechenzeitModus,
    drandModus: drandModus,
    drandStrafe: drandStrafe,
    freigabeZiel: freigabeZiel,
    freigabeErreicht: freigabeErreicht,
    freigabeHolen: freigabeHolen,
    strafeBuchen: strafeBuchen,
    netzLage: netzLage,
    gutschriftWert: gutschriftWert,
    gutschriftBuchen: gutschriftBuchen,
    TAKT: TAKT,
    zeitkontoVerschieben: zeitkontoVerschieben,
    notausgangUeberNetz: notausgangUeberNetz,
    strafzeit: strafzeit,
    neueFrist: neueFrist,
    RECHENZEIT_STUFEN: RECHENZEIT_STUFEN,
    NOTAUSGANG_WERTE: NOTAUSGANG_WERTE,
    NOTAUSGANG_RECHENZEIT_MAX: NOTAUSGANG_RECHENZEIT_MAX,
    TRESORZEIT_WERTE: TRESORZEIT_WERTE,
    PRUEFSCHRITT: PRUEFSCHRITT,
    STRAFZEIT_BASIS: STRAFZEIT_BASIS
  };
})(typeof window !== 'undefined' ? window : globalThis);
