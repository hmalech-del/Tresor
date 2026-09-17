/* Die Stimme des Wächters.
 *
 * Der Tresor ist kein Werkzeug, das seinen Zustand meldet, sondern eine
 * Instanz, die urteilt. Alle Sätze, die der Nutzer im Ablauf zu lesen
 * bekommt, stehen deshalb hier zusammen - nicht verstreut zwischen
 * Zustandslogik, und nicht in der Sprache dessen, der das gebaut hat.
 *
 * Regeln für neue Sätze: kurz, ohne Ausrufezeichen, ohne Anbiederung. Der
 * Wächter erklärt nicht, er stellt fest. Wer wissen will, wie es innen
 * funktioniert, klappt die Technikzeile auf oder liest die README. */
(function (global) {
  'use strict';
  var T = global.Tresor || (global.Tresor = {});

  var SAETZE = {
    /* Aufgabe bestanden */
    lob: [
      'Angenommen.',
      'Das lasse ich gelten.',
      'Sauber. Weiter.',
      'Geht doch.',
      'Bestanden. Der nächste Teil wartet.',
      'Gut. Merk dir das Gefühl, es kommt noch mal.'
    ],
    /* Aufgabe verpatzt, ohne Strafe */
    tadel: [
      'Daneben.',
      'Nein. Von vorn.',
      'Das war nichts.',
      'Noch einmal, und diesmal richtig.',
      'Zu früh gefreut.'
    ],
    /* Strafe läuft */
    strafe: [
      'Gesperrt. Warte es ab.',
      'Das kostet. Die Uhr läuft für dich, nicht gegen dich.',
      'Zu oft danebengegriffen. Jetzt gibt es Pause.',
      'Fehler haben einen Preis. Hier ist er.'
    ],
    /* Zeitschloss rechnet */
    bann: [
      'Jetzt zahlt das Gerät für dich. Beschleunigen kannst du nichts.',
      'Der Bann läuft. Ungeduld ist hier wertlos.',
      'Kein Trick kürzt das ab. Nur Zeit.',
      'Von hier an arbeitet die Maschine. Du wartest.',
      'Der Bann kennt keine Abkürzung - auch für dich nicht.'
    ],
    /* Fragment ist auf */
    freigabe: [
      'Ein Stück gehört wieder dir.',
      'Genommen. Der Rest bleibt, wo er ist.',
      'Eins offen. Nicht nachlassen.',
      'Verdient.'
    ],
    /* Alles offen */
    sieg: [
      'Der Tresor ist leer. Du hast alles zurückgeholt.',
      'Durch. Das hat dich etwas gekostet - so war es gedacht.',
      'Vollständig. Von mir aus kannst du gehen.'
    ],
    /* Notausgang genommen */
    notausgang: [
      'Du nimmst den Ausgang. Vermerkt.',
      'Der zweite Weg. Auch der war nicht umsonst.',
      'Nicht der schöne Weg, aber ein Weg.'
    ],
    /* Frisch verriegelt */
    verriegelt: [
      'Verriegelt. Ab jetzt gilt, was du eingestellt hast.',
      'Das Geheimnis ist weg. Hol es dir zurück.',
      'Zu. Der Rest liegt bei dir.'
    ],
    /* Geheime Frist abgelaufen */
    fristAus: [
      'Zu langsam. Der Fortschritt ist hin.',
      'Die Frist war abgelaufen. Neuer Anlauf, neue Frist.',
      'Zeit verpasst. Zurück auf Anfang.'
    ],
    /* Zu spät zur Rückmeldung */
    verspaetet: [
      'Zu spät. Dieser Besuch zählt nicht.',
      'Das Fenster war zu. Der Abstand beginnt von vorn.'
    ]
  };

  /* Feste Bezeichnungen. Alles, was nach Innenleben klingt, bekommt hier
   * seinen Namen für die Oberfläche. */
  var WORT = {
    bann: 'Bann',
    bannLang: 'Der Bann',
    strafe: 'Strafe',
    ausgang: 'Notausgang'
  };

  function waehle(liste) { return liste[Math.floor(Math.random() * liste.length)]; }

  function sag(kategorie) {
    var liste = SAETZE[kategorie];
    return liste ? waehle(liste) : '';
  }

  T.stimme = { sag: sag, WORT: WORT, SAETZE: SAETZE };
})(typeof window !== 'undefined' ? window : globalThis);
