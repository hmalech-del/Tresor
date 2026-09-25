/* Die Stimme des Game Masters.
 *
 * Er bedient niemanden. Er stellt die Regeln auf, misst und urteilt. Der
 * Nutzer ist ein Spieler in seiner Prüfung, kein Kunde.
 *
 * Leitplanken für neue Sätze:
 *   - Von oben herab, aber stilvoll. Harter Lehrmeister, kein Schläger.
 *   - Kein Lob, das über "ausreichend" hinausgeht. Ein Sieg ist das Minimum.
 *   - Kein Mitleid, keine Hilfe, keine Motivationsfloskeln.
 *   - Keine Verhandlung. Die Zeit ist das Gesetz.
 *   - Kurz. Wer erklärt, rechtfertigt sich.
 *
 * Alles, was der Spieler im Ablauf liest, steht hier - nicht verstreut in
 * der Zustandslogik. Was die App technisch tut, gehört in die README. */
(function (global) {
  'use strict';
  var T = global.Tresor || (global.Tresor = {});

  var SAETZE = {
    /* Frisch verriegelt */
    verriegelt: [
      'Die Regeln sind diktiert. Dein Zug.',
      'Der Tribut ist deine Zeit. Enttäusch mich nicht.',
      'Verriegelt. Ab hier zählt nur, was du tust.',
      'Das Geheimnis gehört jetzt mir. Hol es dir.'
    ],
    /* Aufgabe bestanden */
    lob: [
      'Bestanden. Das Minimum.',
      'Angenommen. Mehr nicht.',
      'Ich bin fast beeindruckt. Fast.',
      'Erledigt. Der nächste Teil ist härter.',
      'Gut genug. Diesmal.',
      'Kein Fehlschlag. Noch keiner.'
    ],
    /* Aufgabe verpatzt */
    tadel: [
      'Kritischer Fehlschlag.',
      'Eingeknickt.',
      'Schwach. Noch einmal.',
      'Das war nichts. Beweis es besser.',
      'Prüfung nicht bestanden.'
    ],
    /* Strafe läuft */
    strafe: [
      'Du hast geraten. Jetzt wartest du.',
      'Der Tribut steigt. Deine Schuld.',
      'Gesperrt. Das ist keine Verhandlung.',
      'Zu oft danebengegriffen. Sitz es ab.'
    ],
    /* Am Netz: Eine Strafe sperrt nichts, sie schiebt die Freigabe weg. */
    verschoben: [
      'Daneben. Die Tür rückt weiter weg.',
      'Der Tribut steigt. Du zahlst in Zeit.',
      'Jeder Fehler kostet. Die Freigabe wandert.',
      'Falsch. Das Netz wartet. Du jetzt länger.'
    ],
    /* Am Netz: Eine geloeste Pruefung holt Zeit zurueck. Kein Lob - Zeit. */
    gutschrift: [
      'Bezahlt. Die Tür kommt näher.',
      'Das zählt. Nicht viel, aber es zählt.',
      'Zeit zurück. Verdient, nicht geschenkt.',
      'Weniger Warten. Mehr gibt es nicht.'
    ],
    /* Kapitulation: aufgegeben, gegen gewuerfelte Zeit. Kein Trost. */
    kapitulation: [
      'Aufgegeben. Das kostet.',
      'Du weichst aus. Ich schreibe es an.',
      'Kapitulation angenommen. Der Preis steht.',
      'Zu schwer? Dann zahl.'
    ],
    /* Zeitschloss rechnet */
    bann: [
      'Der Tribut ist Zeit. Zahl ihn.',
      'Hier hilft dir nichts. Ungeduld am wenigsten.',
      'Die Maschine arbeitet. Du nicht.',
      'Kein Weg daran vorbei. Auch nicht für dich.',
      'Warte. Das ist die ganze Prüfung.'
    ],
    /* Fragment ist auf */
    freigabe: [
      'Ein Stück. Nicht mehr.',
      'Genommen. The Keep bleibt zu.',
      'Eins. Der Rest gehört noch mir.',
      'Verdient. Kaum.'
    ],
    /* Alles offen */
    sieg: [
      'The Keep is open. Für dieses Mal.',
      'Du hast den Tribut gezollt. Ich hätte anders gewettet.',
      'Durch. Mach dich bereit für die nächste Runde.'
    ],
    /* Notausgang genommen */
    notausgang: [
      'Der leichte Weg. Vermerkt.',
      'Du bist nicht durchgekommen. Du bist rausgelassen worden.',
      'Kapituliert und abgewartet. Auch eine Art zu gewinnen.'
    ],
    /* Geheime Frist abgelaufen */
    fristAus: [
      'Zeit verfallen. Kritischer Fehlschlag.',
      'Zu langsam. Der Fortschritt ist weg.',
      'Die Frist war das Gesetz. Du hast sie verpasst.'
    ],
    /* Zu spät zur Rückmeldung */
    verspaetet: [
      'Zu spät. Zählt nicht.',
      'Das Fenster war offen. Du warst es nicht.'
    ],
    /* Ersatzweg statt Sensor oder Marke */
    ersatz: [
      'Dein Gerät kann es nicht. Dann zahlst du eben anders.',
      'Keine Ausrüstung, kein Rabatt.',
      'Du weichst aus. Das kostet.'
    ],
    /* Willkür: was der Spieler nicht erfaehrt */
    dunkel: [
      'Du erfährst es nicht.',
      'Das geht dich nichts an.',
      'Frag nicht. Lauf.',
      'Im Dunkeln. So hast du es gewollt.'
    ]
  };

  /* Namen für die Oberfläche. Nichts hier klingt nach Innenleben. */
  var WORT = {
    bann: 'Bann',
    bannLang: 'Der Bann',
    strafe: 'Strafe',
    ausgang: 'Notausgang',
    keep: 'The Keep'
  };

  function waehle(liste) { return liste[Math.floor(Math.random() * liste.length)]; }

  function sag(kategorie) {
    var liste = SAETZE[kategorie];
    return liste ? waehle(liste) : '';
  }

  T.stimme = { sag: sag, WORT: WORT, SAETZE: SAETZE };
})(typeof window !== 'undefined' ? window : globalThis);
