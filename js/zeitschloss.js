/* Bequeme Hülle um den Zeitschloss-Worker. */
(function (global) {
  'use strict';
  var T = global.Tresor || (global.Tresor = {});
  var BITS = 1024;
  var PFAD = 'js/worker-timelock.js';

  function einmal(nachricht, aufTyp, beiFortschritt) {
    return new Promise(function (erfuellen, ablehnen) {
      var worker = new Worker(PFAD);
      worker.onmessage = function (ereignis) {
        var m = ereignis.data;
        if (m.typ === 'fehler') { worker.terminate(); ablehnen(new Error(m.meldung)); return; }
        if (m.typ === 'fortschritt') { if (beiFortschritt) beiFortschritt(m); return; }
        if (m.typ === aufTyp) { worker.terminate(); erfuellen(m); }
      };
      worker.onerror = function (fehler) { worker.terminate(); ablehnen(new Error(fehler.message || 'Worker-Fehler')); };
      worker.postMessage(nachricht);
    });
  }

  /* Quadrierungen pro Sekunde auf diesem Gerät. */
  async function messen() {
    var antwort = await einmal({ cmd: 'messen', bits: BITS }, 'messung');
    return antwort.rate;
  }

  /* Neues Puzzle, das ungefähr `sekunden` Rechenzeit kostet. */
  async function erzeugen(schritte) {
    var antwort = await einmal({ cmd: 'erzeugen', bits: BITS, schritte: schritte }, 'erzeugt');
    return antwort.puzzle;
  }

  /* Eine Kette mit vielen Ziellinien - das Zeitkonto braucht sie, weil sich
   * die Restzeit spaeter verschieben koennen soll. Nach diesem Aufruf ist
   * phi(N) fort; was hier nicht gebaut wird, ist nie wieder erreichbar. */
  async function erzeugenLeiter(schritteListe) {
    var antwort = await einmal({ cmd: 'erzeugenLeiter', bits: BITS, schritte: schritteListe }, 'leiter');
    return antwort.leiter;
  }

  /* Laufender Löser. Kann pausiert werden und gibt seinen Zwischenstand heraus,
   * damit verbrauchte Rechenzeit einen Reload überlebt. */
  function Loeser(puzzle, stand, beiFortschritt) {
    this.puzzle = puzzle;
    this.erledigt = (stand && stand.erledigt) || 0;
    this.x = (stand && stand.x) || puzzle.a;
    this.beiFortschritt = beiFortschritt || function () {};
    this.worker = null;
    this.laeuft = false;
  }

  Loeser.prototype.starten = function () {
    var ich = this;
    if (ich.laeuft) return ich.versprechen;
    ich.laeuft = true;
    ich.versprechen = new Promise(function (erfuellen, ablehnen) {
      ich.aufloesen = erfuellen;
      ich.worker = new Worker(PFAD);
      ich.worker.onmessage = function (ereignis) {
        var m = ereignis.data;
        if (m.typ === 'fortschritt') {
          ich.erledigt = m.erledigt; ich.x = m.x;
          ich.beiFortschritt(ich.stand());
        } else if (m.typ === 'fertig') {
          ich.erledigt = m.erledigt; ich.laeuft = false;
          ich.worker.terminate(); ich.worker = null;
          ich.aufloesen = null;
          erfuellen(m.b);
        } else if (m.typ === 'fehler') {
          ich.laeuft = false;
          ich.worker.terminate(); ich.worker = null;
          ich.aufloesen = null;
          ablehnen(new Error(m.meldung));
        }
      };
      if (ich.puzzle.pruef) {
        // blind: die Schrittzahl ist nirgends gespeichert
        ich.worker.postMessage({
          cmd: 'loesenBlind', n: ich.puzzle.n, x: ich.x, erledigt: ich.erledigt,
          pruef: ich.puzzle.pruef, obergrenze: ich.puzzle.obergrenze,
          pruefschritt: ich.puzzle.pruefschritt
        });
      } else {
        ich.worker.postMessage({
          cmd: 'loesen', n: ich.puzzle.n, x: ich.x,
          erledigt: ich.erledigt, ziel: ich.puzzle.t
        });
      }
    });
    return ich.versprechen;
  };

  /* Pausieren heisst: Worker beenden. Er rechnet in einer geschlossenen
   * Schleife und koennte eine Nachricht gar nicht entgegennehmen. Weiter
   * geht es beim zuletzt gemeldeten Zwischenstand. */
  Loeser.prototype.anhalten = function () {
    if (!this.worker) return this.versprechen || Promise.resolve(null);
    this.laeuft = false;
    this.worker.terminate();
    this.worker = null;
    this.beiFortschritt(this.stand());
    if (this.aufloesen) { var fertig = this.aufloesen; this.aufloesen = null; fertig(null); }
    return this.versprechen || Promise.resolve(null);
  };

  Loeser.prototype.stand = function () {
    return { erledigt: this.erledigt, x: this.x, ziel: this.puzzle.t || this.puzzle.obergrenze };
  };

  T.zeitschloss = { messen: messen, erzeugen: erzeugen, erzeugenLeiter: erzeugenLeiter,
                    Loeser: Loeser, BITS: BITS };
})(typeof window !== 'undefined' ? window : globalThis);
