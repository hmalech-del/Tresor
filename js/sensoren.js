/* Zugang zu den Lagesensoren des Geräts.
 *
 * Android und iPhone verhalten sich hier verschieden, und beide Eigenheiten
 * werden an genau einer Stelle abgefangen:
 *
 *   - Beide Plattformen liefern nur über HTTPS etwas. Über file:// oder
 *     einfaches http:// kommt gar kein Ereignis.
 *   - iOS ab 13 verlangt eine ausdrückliche Freigabe, die aus einer echten
 *     Nutzergeste heraus angefordert werden muss. Android fragt nicht.
 *
 * Und die wichtigste Falle: 'DeviceOrientationEvent' in window ist auch im
 * Desktop-Chrome wahr. Die Schnittstelle existiert dort, es feuert nur nie
 * ein Ereignis. Verlässlich ist deshalb nur, kurz zuzuhören und zu schauen,
 * ob wirklich Messwerte ankommen. Genau das macht `lage()`. */
(function (global) {
  'use strict';
  var T = global.Tresor || (global.Tresor = {});

  var Orientierung = global.DeviceOrientationEvent;
  var Bewegung = global.DeviceMotionEvent;

  var HORCHZEIT = 1600;          // so lange warten wir auf das erste Messwertpaar
  var GEDAECHTNIS = 60000;       // eine geglückte Prüfung gilt eine Minute

  var letzte = null;             // { zeit, ergebnis }
  var freigabeStand = '';        // '', 'erteilt', 'verweigert'

  function brauchtFreigabe() {
    return !!(Orientierung && typeof Orientierung.requestPermission === 'function');
  }

  function sichererKontext() {
    return global.isSecureContext !== false;
  }

  /* Freigabe anfordern. MUSS synchron aus einem Klick heraus aufgerufen
   * werden - iOS verwirft den Aufruf sonst als "nicht vom Nutzer ausgelöst".
   * Beide Anfragen starten deshalb nebeneinander, ohne dazwischen zu warten. */
  function freigabeHolen() {
    if (!brauchtFreigabe()) return Promise.resolve(true);
    var eins, zwei;
    try {
      eins = Orientierung.requestPermission();
      zwei = (Bewegung && typeof Bewegung.requestPermission === 'function')
        ? Bewegung.requestPermission() : Promise.resolve('granted');
    } catch (fehler) {
      return Promise.resolve(false);
    }
    return Promise.all([
      Promise.resolve(eins).catch(function () { return 'denied'; }),
      Promise.resolve(zwei).catch(function () { return 'granted'; })
    ]).then(function (antworten) {
      return antworten[0] === 'granted' && antworten[1] === 'granted';
    });
  }

  function hatNeigung(e) {
    return e.beta !== null && e.gamma !== null
      && typeof e.beta === 'number' && typeof e.gamma === 'number';
  }

  function hatBewegung(e) {
    var b = e.accelerationIncludingGravity;
    if (!b || typeof b.x !== 'number' || b.x === null) return false;
    // Ein ruhig liegendes Gerät misst immer noch die Schwerkraft auf einer
    // Achse. Lauter Nullen heißt deshalb: es gibt gar keinen Sensor.
    return b.x !== 0 || b.y !== 0 || b.z !== 0;
  }

  function horchen(typ, pruefe, ms) {
    return new Promise(function (erfuellen) {
      var fertig = false, uhr;
      function beenden(ergebnis) {
        if (fertig) return;
        fertig = true;
        global.removeEventListener(typ, beiEreignis);
        clearTimeout(uhr);
        erfuellen(ergebnis);
      }
      function beiEreignis(e) { if (pruefe(e)) beenden(true); }
      global.addEventListener(typ, beiEreignis);
      uhr = setTimeout(function () { beenden(false); }, ms);
    });
  }

  /* Was kann dieses Gerät? Liefert
   *   { ok, neigung, bewegung, grund }
   * mit grund aus: '' | 'unsicher' | 'fehlt' | 'freigabe' | 'verweigert' | 'stumm'
   *
   * Ohne `optionen.freigeben` wird auf iOS nicht nachgefragt, sondern
   * 'freigabe' gemeldet - der Aufrufer soll dafür einen Knopf anbieten. */
  function lage(optionen) {
    optionen = optionen || {};
    if (!optionen.frisch && letzte && letzte.ergebnis.ok && Date.now() - letzte.zeit < GEDAECHTNIS) {
      return Promise.resolve(letzte.ergebnis);
    }
    if (!sichererKontext()) return Promise.resolve(merken({ ok: false, neigung: false, bewegung: false, grund: 'unsicher' }));
    if (!Orientierung || !global.addEventListener) {
      return Promise.resolve(merken({ ok: false, neigung: false, bewegung: false, grund: 'fehlt' }));
    }

    var vorlauf;
    if (brauchtFreigabe() && freigabeStand !== 'erteilt') {
      if (!optionen.freigeben) {
        return Promise.resolve({ ok: false, neigung: false, bewegung: false, grund: 'freigabe' });
      }
      vorlauf = freigabeHolen().then(function (erlaubt) {
        freigabeStand = erlaubt ? 'erteilt' : 'verweigert';
        return erlaubt;
      });
    } else {
      vorlauf = Promise.resolve(true);
    }

    return vorlauf.then(function (erlaubt) {
      if (!erlaubt) return merken({ ok: false, neigung: false, bewegung: false, grund: 'verweigert' });
      var ms = optionen.ms || HORCHZEIT;
      return Promise.all([
        horchen('deviceorientation', hatNeigung, ms),
        horchen('devicemotion', hatBewegung, ms)
      ]).then(function (ergebnisse) {
        return merken({
          ok: ergebnisse[0], neigung: ergebnisse[0], bewegung: ergebnisse[1],
          grund: ergebnisse[0] ? '' : 'stumm'
        });
      });
    });
  }

  function merken(ergebnis) {
    letzte = { zeit: Date.now(), ergebnis: ergebnis };
    return ergebnis;
  }

  function grundText(grund) {
    if (grund === 'unsicher') return 'Sensoren gibt es nur über HTTPS. Diese Seite läuft unverschlüsselt.';
    if (grund === 'fehlt') return 'Dieser Browser kennt die Lagesensoren nicht.';
    if (grund === 'freigabe') return 'Dieses Gerät verlangt eine ausdrückliche Freigabe.';
    if (grund === 'verweigert') return 'Die Freigabe wurde abgelehnt.';
    if (grund === 'stumm') return 'Es kommen keine Messwerte an - dieses Gerät hat wohl keine Lagesensoren.';
    return '';
  }

  /* Laufende Messung der Neigung. beta = vorn/hinten, gamma = links/rechts,
   * beide in Grad. Liefert eine Funktion zum Abmelden. */
  function neigung(rueckruf) {
    function beiEreignis(e) {
      if (e.beta === null || e.gamma === null) return;
      rueckruf({ beta: e.beta, gamma: e.gamma, alpha: e.alpha });
    }
    global.addEventListener('deviceorientation', beiEreignis);
    return function () { global.removeEventListener('deviceorientation', beiEreignis); };
  }

  /* Laufende Messung der Beschleunigung samt Schwerkraft. */
  function beschleunigung(rueckruf) {
    function beiEreignis(e) {
      var b = e.accelerationIncludingGravity;
      if (!b || b.x === null) return;
      rueckruf({ x: b.x || 0, y: b.y || 0, z: b.z || 0, takt: e.interval || 0 });
    }
    global.addEventListener('devicemotion', beiEreignis);
    return function () { global.removeEventListener('devicemotion', beiEreignis); };
  }

  T.sensoren = {
    brauchtFreigabe: brauchtFreigabe,
    sichererKontext: sichererKontext,
    lage: lage,
    grundText: grundText,
    neigung: neigung,
    beschleunigung: beschleunigung,
    vergessen: function () { letzte = null; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
