/* Erinnerungen.
 *
 * Bewusst eine Einstellung des Tresors und keine der App: Ob man an ein
 * Check-in-Fenster erinnert wird oder selbst daran denken muss, gehört zur
 * Aufgabe. Deshalb wird es beim Verriegeln festgelegt und später nicht mehr
 * geändert - sonst schaltete man es genau dann ein, wenn es bequem ist.
 *
 * Grenze, die die Oberfläche auch so benennt: Eine Web-Benachrichtigung kann
 * nur verschickt werden, solange die Seite läuft - im Hintergrund-Tab ja, bei
 * geschlossenem Browser nicht. Ohne Server und Push geht es nicht anders. */
(function (global) {
  'use strict';
  var T = global.Tresor || (global.Tresor = {});
  var util = T.util;

  function moeglich() { return typeof global.Notification !== 'undefined'; }
  function erlaubt() { return moeglich() && global.Notification.permission === 'granted'; }
  function offen() { return moeglich() && global.Notification.permission === 'default'; }

  async function erlaubnisHolen() {
    if (!moeglich()) return 'nicht-verfuegbar';
    if (global.Notification.permission !== 'default') return global.Notification.permission;
    try { return await global.Notification.requestPermission(); }
    catch (fehler) { return 'denied'; }
  }

  /* Welche Zeitpunkte sind für diesen Tresor überhaupt interessant?
   * Die geheime Höchstzeit steht bewusst nicht dabei - sie ist geheim. */
  function lage(tresor) {
    var ereignisse = [];
    if (!tresor || T.tresorLogik.alleOffen(tresor)) return ereignisse;

    var fragment = T.tresorLogik.aktuellesFragment(tresor);
    var aufgabe = fragment && T.tresorLogik.offeneAufgabe(fragment);
    if (aufgabe) {
      var nummer = fragment.index + 1;
      var z = aufgabe.zustand || {};
      var p = aufgabe.params || {};

      if (aufgabe.id === 'wartezeit' && z.bis) {
        ereignisse.push({
          schluessel: 'wartezeit:' + fragment.index + ':' + z.bis,
          ab: z.bis,
          titel: 'Sperrfrist vorbei',
          text: 'Fragment ' + nummer + ' wartet auf dich.'
        });
      }

      if (aufgabe.id === 'intervall') {
        var letzter = 0;
        (z.checkins || []).forEach(function (eintrag) {
          letzter = Math.max(letzter, typeof eintrag === 'number' ? eintrag : eintrag.ts);
        });
        if (letzter) {
          var auf = letzter + p.abstand * 1000;
          var fenster = (p.fenster || p.abstand) * 1000;
          ereignisse.push({
            schluessel: 'checkin-auf:' + fragment.index + ':' + auf,
            ab: auf,
            titel: 'Check-in-Fenster offen',
            text: 'Noch ' + util.dauer(fenster / 1000) + ' Zeit für die nächste Rückmeldung.'
          });
          if (fenster > 300000) {
            ereignisse.push({
              schluessel: 'checkin-zu:' + fragment.index + ':' + auf,
              ab: auf + fenster - 120000,
              titel: 'Fenster schließt gleich',
              text: 'In zwei Minuten zählt die Rückmeldung nicht mehr.'
            });
          }
        }
      }

      if (aufgabe.id === 'zeitfenster') {
        var jetzt = new Date();
        var minuten = jetzt.getHours() * 60 + jetzt.getMinutes();
        var bisOeffnung = (p.von - minuten + 1440) % 1440;
        var oeffnet = Date.now() + bisOeffnung * 60000;
        if (minuten >= p.von && minuten < p.bis) oeffnet = Date.now();
        ereignisse.push({
          schluessel: 'zeitfenster:' + fragment.index + ':' + new Date(oeffnet).toDateString(),
          ab: oeffnet,
          titel: 'Zeitfenster offen',
          text: 'Fragment ' + nummer + ' lässt sich bis ' + util.minutenAlsUhr(p.bis) + ' Uhr öffnen.'
        });
      }
    }

    var exit = tresor.notausgang;
    if (exit && !exit.benutzt && exit.art === 'wartezeit' && exit.frei) {
      ereignisse.push({
        schluessel: 'notausgang:' + exit.frei,
        ab: exit.frei,
        titel: 'Notausgang offen',
        text: 'Du kommst jetzt auch ohne die restlichen Aufgaben an das Geheimnis.'
      });
    }
    return ereignisse;
  }

  /* Fällige Ereignisse melden. Sichtbare Seite: nichts schicken, die
   * Oberfläche sagt es ja selbst - aber als gemeldet vermerken, damit später
   * keine Nachzügler kommen. */
  function pruefen(tresor, sichern) {
    if (!tresor || !(tresor.konfig || {}).erinnerungen || !erlaubt()) return;
    var jetzt = Date.now();
    var geaendert = false;
    tresor.gemeldet = tresor.gemeldet || {};
    lage(tresor).forEach(function (ereignis) {
      if (jetzt < ereignis.ab || tresor.gemeldet[ereignis.schluessel]) return;
      tresor.gemeldet[ereignis.schluessel] = jetzt;
      geaendert = true;
      if (typeof document !== 'undefined' && !document.hidden) return;
      try {
        new global.Notification('Tresor · ' + ereignis.titel, {
          body: ereignis.text, tag: ereignis.schluessel, silent: false
        });
      } catch (fehler) { /* manche Browser erlauben das nur aus dem Service Worker */ }
    });
    if (geaendert && sichern) sichern();
  }

  T.erinnerung = {
    moeglich: moeglich, erlaubt: erlaubt, offen: offen,
    erlaubnisHolen: erlaubnisHolen, lage: lage, pruefen: pruefen
  };
})(typeof window !== 'undefined' ? window : globalThis);
