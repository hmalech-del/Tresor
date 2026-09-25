/* Oberfläche und Ablauf. */
(function (global) {
  'use strict';
  var T = global.Tresor;
  var util = T.util, el = util.el, $ = util.$;

  var zustand = {
    tresor: null,
    konfig: null,
    art: 'zahl',
    geheimnis: '',
    bild: null,
    laenge: 5,
    aufraeumen: null,
    loeser: null,
    exitLoeser: null,
    exitAnzeige: null,
    passMaterial: null,            // nur im Arbeitsspeicher, nie gesichert
    letzteSicherung: 0,
    fotoErgebnis: null
  };

  /* ---------------- Bildschirm wachhalten ----------------
   * Rechnet der Tresor, ist der Tab im Vordergrund am schnellsten - und auf
   * dem Handy schlaeft der Bildschirm sonst mitten in der Rechnung ein.
   * Kostet zusaetzlich Strom, deshalb als Schalter und nicht automatisch. */

  var wachhalter = T.wachhalter;

  function wachWunschLaden() {
    try { return global.localStorage.getItem('tresor.wachhalten') === '1'; }
    catch (fehler) { return false; }
  }

  function wachWunschSichern(an) {
    try { global.localStorage.setItem('tresor.wachhalten', an ? '1' : '0'); } catch (fehler) {}
  }

  function bildschirmWachHalten(an) {
    if (an) wachhalter.an('rechnen'); else wachhalter.aus('rechnen');
  }

  /* Schalter für die Rechenansichten. */
  function wachSchalter() {
    if (!global.navigator.wakeLock) return null;
    var kaestchen = el('input', { type: 'checkbox', checked: wachWunschLaden() ? 'checked' : null });
    kaestchen.addEventListener('change', function () {
      wachWunschSichern(kaestchen.checked);
      bildschirmWachHalten(kaestchen.checked);
    });
    return el('label', { class: 'schalterzeile klein' }, [
      kaestchen, el('span', { class: 'flaut', text: 'Bildschirm anlassen (braucht zusätzlich Strom)' })
    ]);
  }

  /* ---------------- Speichern ---------------- */

  function sichern(erzwingen) {
    if (!zustand.tresor) return;
    var jetzt = Date.now();
    if (!erzwingen && jetzt - zustand.letzteSicherung < 1500) return;
    zustand.letzteSicherung = jetzt;
    T.speicher.sichern(zustand.tresor);
  }

  function aufraeumen() {
    if (zustand.fristUhr) { clearInterval(zustand.fristUhr); zustand.fristUhr = null; }
    if (zustand.exitUhr) { clearInterval(zustand.exitUhr); zustand.exitUhr = null; }
    if (zustand.freigabeUhr) { clearInterval(zustand.freigabeUhr); zustand.freigabeUhr = null; }
    // Der Notausgang rechnet weiter - nur seine Anzeige verschwindet
    zustand.exitAnzeige = null;
    bildschirmWachHalten(false);
    if (zustand.aufraeumen) { try { zustand.aufraeumen(); } catch (fehler) {} zustand.aufraeumen = null; }
    if (zustand.loeser) { zustand.loeser.anhalten(); zustand.loeser = null; }
  }

  /* ---------------- Einrichten ---------------- */

  function ziffernFelder(wurzel) {
    util.leeren(wurzel);
    for (var i = 0; i < zustand.laenge; i++) {
      var feld = el('input', {
        type: 'text', inputmode: 'numeric', maxlength: '1', class: 'zifferfeld',
        'aria-label': 'Ziffer ' + (i + 1), value: zustand.geheimnis.charAt(i) || ''
      });
      feld.dataset.index = String(i);
      wurzel.appendChild(feld);
    }
    util.$$('.zifferfeld', wurzel).forEach(function (feld) {
      feld.addEventListener('input', function () {
        feld.value = feld.value.replace(/\D/g, '').slice(0, 1);
        var index = Number(feld.dataset.index);
        var zeichen = zustand.geheimnis.padEnd(zustand.laenge, ' ').split('');
        zeichen[index] = feld.value || ' ';
        zustand.geheimnis = zeichen.join('').slice(0, zustand.laenge);
        if (feld.value && feld.nextSibling) feld.nextSibling.focus();
        pruefeBereit();
      });
      feld.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !feld.value && feld.previousSibling) feld.previousSibling.focus();
      });
    });
  }

  /* Ehrliche Einordnung dessen, was Rechenzeit real kostet. Die Zahlen sind
   * Hausnummern - ein Kern unter Volllast, Geraet und Drosselung entscheiden. */
  function rechenaufwand(sekunden) {
    if (!sekunden) return '';
    var text = 'Ein Rechenkern ist dabei ' + util.dauer(sekunden) + ' voll ausgelastet, der Tab muss offen bleiben. ';
    if (sekunden <= 120) return text + 'Akku: kaum spürbar.';
    if (sekunden <= 900) return text + 'Akku: wenige Prozent, das Gerät wird warm.';
    if (sekunden <= 3600) return text + 'Akku: am Handy grob 10 bis 25 Prozent.';
    return text + 'Auf dem Handy unrealistisch (mehr als eine Akkuladung) – eher Laptop am Netzteil. '
      + 'Der Fortschritt wird gespeichert, du kannst die Strecke in Etappen abarbeiten.';
  }

  function notausgangOptionen(vorgabe) {
    return T.tresorLogik.NOTAUSGANG_WERTE.map(function (sekunden) {
      var option = el('option', { value: String(sekunden), selected: sekunden === vorgabe ? 'selected' : null },
        util.dauer(sekunden));
      option.dataset.sekunden = String(sekunden);
      return option;
    });
  }

  /* "meist 4 h bis 11 h, selten bis 29 h" */
  function spanneText(sp) {
    return util.dauer(sp.meistVon) + ' bis ' + util.dauer(sp.meistBis)
      + (sp.seltenBis > sp.meistBis * 1.2 ? ', selten bis ' + util.dauer(sp.seltenBis) : '');
  }

  /* "nach 7 Tage" ist falsch - nach verlangt den Dativ. Stunden und Minuten
   * sind abgekuerzt und aendern sich nicht. */
  function nachDauer(sekunden) {
    return util.dauer(sekunden).replace(/(\d+) Tage\b/, '$1 Tagen');
  }

  function tresorzeitOptionen(vorgabe) {
    return T.tresorLogik.TRESORZEIT_WERTE.map(function (sekunden) {
      return el('option', { value: String(sekunden), selected: sekunden === vorgabe ? 'selected' : null },
        util.dauer(sekunden));
    });
  }

  /* Welches Zeitschloss gilt gerade? Unter Willkür gibt es nur
   * Rechenzeit oder keine - dort waehlt der Game Master. */
  function zeitschlossArt() {
    if ($('#blindgang') && $('#blindgang').checked) return $('#blind-zeitschloss').value;
    return $('#sicherheit').value;
  }

  function zeitOptionen(vorgabe) {
    return T.tresorLogik.FRIST_WERTE.map(function (sekunden) {
      return el('option', { value: String(sekunden), selected: sekunden === vorgabe ? 'selected' : null },
        util.dauer(sekunden));
    });
  }

  function pruefeBereit() {
    var knopf = $('#verriegeln');
    if (!knopf) return;
    var vollstaendig = zustand.art === 'foto'
      ? !!zustand.bild
      : /^\d+$/.test(zustand.geheimnis) && zustand.geheimnis.length === zustand.laenge;
    var blind = $('#blindgang') && $('#blindgang').checked;
    var dimensionen = blind ? ['meine-regeln'] : aktiveDimensionen();
    var passAn = $('#passphrase-aktiv') && $('#passphrase-aktiv').checked;
    var pass = passAn ? $('#passphrase').value : '';
    var passWdh = passAn ? $('#passphrase-wdh').value : '';
    var passOk = !passAn || (pass.length >= 4 && pass === passWdh);
    var stationenNoetig = !blind && dimensionen.indexOf('ort') !== -1;
    var stationenOk = !stationenNoetig || (zustand.stationen || []).length >= 2;
    if (passAn) {
      $('#passphrase-hinweis').textContent = !pass.length ? 'Noch keine Passphrase.'
        : pass.length < 4 ? 'Zu kurz - nimm lieber einen ganzen Satz.'
        : pass !== passWdh ? 'Die beiden Eingaben stimmen noch nicht überein.'
        : 'Passt. Schreib sie dir auf, bevor du verriegelst.';
    }
    knopf.disabled = !(vollstaendig && dimensionen.length && passOk && stationenOk);
    $('#bereit-hinweis').textContent = !vollstaendig
      ? (zustand.art === 'foto' ? 'Es fehlt noch ein Bild.' : 'Es fehlen noch Ziffern.')
      : !dimensionen.length ? 'Wähle mindestens eine Dimension.'
      : !passOk ? 'Die Passphrase ist noch nicht vollständig.'
      : !stationenOk ? 'Für die Dimension „Ort“ brauchst du mindestens zwei beschriebene Marken.' : '';
  }

  /* Technisches bleibt verfuegbar, aber zugeklappt: Der Game Master erklaert nicht,
   * wie er gebaut ist - wer es wissen will, klappt es auf. */
  function technikZeile(text) {
    var block = el('details', { class: 'technik' });
    block.appendChild(el('summary', { text: 'Was dahintersteckt' }));
    block.appendChild(el('p', { class: 'flaut klein', text: text }));
    return block;
  }

  function aktiveDimensionen() {
    return util.$$('.dimension-karte input[type=checkbox]:checked').map(function (feld) { return feld.value; });
  }

  /* Sensorlage im Einrichtungsscreen.
   *
   * Der Schalter laesst sich nur setzen, wenn wirklich Messwerte ankommen -
   * geprueft wird also die Faehigkeit des Geraets, nicht seine Identitaet.
   * Das ist Absicht: Eine Geraetemarke im Speicher laege genau dort, wo auch
   * der Tresor liegt, und waere beim Loeschen der Browserdaten mit weg. */
  function sensorlageZeigen(mitGeste) {
    var schalter = $('#sensoren-aktiv');
    if (!schalter || !T.sensoren) return;
    var hinweis = $('#sensoren-hinweis');
    var knopf = $('#sensoren-freigeben');
    hinweis.textContent = 'Sensor wird geprüft ...';
    knopf.classList.add('versteckt');
    T.sensoren.lage({ freigeben: !!mitGeste, frisch: true }).then(function (ergebnis) {
      if ($('#sensoren-aktiv') !== schalter) return;    // Bildschirm inzwischen gewechselt
      if (ergebnis.ok) {
        schalter.disabled = false;
        hinweis.textContent = ergebnis.bewegung
          ? 'Dieses Gerät misst Lage und Bewegung - Sensoraufgaben sind möglich.'
          : 'Dieses Gerät misst die Lage, aber keine Bewegung - Schritte fallen dann weg.';
      } else {
        schalter.checked = false;
        schalter.disabled = true;
        if (ergebnis.grund === 'freigabe') {
          hinweis.textContent = 'Dieses Gerät fragt erst nach, bevor eine Seite die Lagesensoren lesen darf.';
          knopf.classList.remove('versteckt');
        } else {
          hinweis.textContent = T.sensoren.grundText(ergebnis.grund) + ' Sensoraufgaben bleiben deshalb aus.';
        }
      }
      sensorWarnung();
      schaetzungAktualisieren();
    });
  }

  /* Willkür: keine Zahl, die die Zukunft verrät.
   *
   * Was schon passiert ist, darf stehen bleiben - drei von fünf Fragmenten
   * sind offen, das sieht man ohnehin am Band. Weg muss alles, woraus sich
   * ablesen liesse, wie lange es noch dauert. Ausgenommen sind Aufgaben, die
   * ohne Uhrzeit unlösbar wären: Wer zu einem Zeitfenster zurückkommen soll,
   * muss wissen, wann. */
  /* Ein Schlag des Mahlwerks. Aufgerufen wird das aus dem Fortschritts-
   * rueckruf des Loesers - der Balken laeuft also nur, solange wirklich
   * gerechnet wird, und steht still, sobald es pausiert. Wie weit es ist,
   * zeigt er nicht: Er hat keine Fuellung, nur Bewegung. */
  function mahlwerkSchlag(mahlwerk, laeuft) {
    mahlwerk.classList.toggle('ist-still', !laeuft);
    if (!laeuft) return;
    mahlwerk.classList.add('ist-schlag');
    clearTimeout(mahlwerk.__schlag);
    mahlwerk.__schlag = setTimeout(function () { mahlwerk.classList.remove('ist-schlag'); }, 220);
  }

  function imDunkeln() {
    return !!(((zustand.tresor || {}).konfig) || {}).blind;
  }

  function offeneSensorAufgaben(tresor) {
    return (tresor.fragmente || []).some(function (fragment) {
      if (fragment.offen) return false;
      return (fragment.aufgaben || []).some(function (aufgabe) {
        if (aufgabe.erledigt) return false;
        var modul = T.herausforderungen.hole(aufgabe.id);
        return !!(modul && modul.sensor);
      });
    });
  }

  /* Die Stationskarte: sichtbar, sobald die Dimension "Ort" gewählt ist.
   * Ohne NFC bleibt sie sichtbar, aber gesperrt - dann sagt sie, warum. */
  function stationLageZeigen() {
    var karte = $('#stationkarte');
    if (!karte) return;
    var gewaehlt = aktiveDimensionen().indexOf('ort') !== -1;
    karte.classList.toggle('versteckt', !gewaehlt);
    if (!gewaehlt) return;

    var moeglich = T.nfc.moeglich();
    $('#station-lage').textContent = moeglich
      ? 'Marke ans Gerät, Knopf drücken. Mindestens zwei. Fünf bis zehn machen es interessant.'
      : T.nfc.grundText() + ' Marken beschreiben geht nur auf einem Gerät, das NFC kann.';
    $('#station-schreiben').disabled = !moeglich;

    var reihe = util.leeren($('#stationsreihe'));
    (zustand.stationen || []).forEach(function (_, i) {
      reihe.appendChild(el('span', { class: 'stationsmarke', text: String(i + 1) }));
    });
    $('#station-verwerfen').classList.toggle('versteckt', !(zustand.stationen || []).length);
  }

  async function stationBeschreiben() {
    var knopf = $('#station-schreiben');
    var meldung = $('#station-meldung');
    knopf.disabled = true;
    meldung.className = 'aufgabe-meldung ist-laeuft';
    meldung.textContent = 'Halte jetzt eine Marke an das Gerät ...';
    var geheimnis = T.nfc.neuesGeheimnis();
    try {
      await T.nfc.schreiben(geheimnis);
      zustand.stationen = (zustand.stationen || []).concat([geheimnis]);
      T.ortAufgaben.vorratSetzen(zustand.stationen);
      meldung.className = 'aufgabe-meldung ist-gut';
      meldung.textContent = 'Marke ' + zustand.stationen.length + ' beschrieben. Leg sie weg und nimm die nächste.';
    } catch (fehler) {
      meldung.className = 'aufgabe-meldung ist-fehler';
      meldung.textContent = 'Das hat nicht geklappt: ' + (fehler.message || fehler);
    }
    knopf.disabled = false;
    stationLageZeigen();
    schaetzungAktualisieren();
    pruefeBereit();
  }

  function sensorWarnung() {
    var warnung = $('#sensoren-warnung');
    if (!warnung) return;
    var an = $('#sensoren-aktiv').checked;
    warnung.classList.toggle('versteckt', !an);
    if (!an) return;
    warnung.textContent = 'Ab hier brauchst du ein Gerät mit Lagesensoren. Auf einem ohne bleibt nur der Ersatzweg - '
      + 'und der kostet ein Vielfaches.';
  }

  function konfigurationLesen() {
    var notausgang = {
      modus: $('#notausgang-modus').value,
      sekunden: Number($('#notausgang-dauer').value),
      minSekunden: Number($('#notausgang-min').value),
      maxSekunden: Number($('#notausgang-max').value)
    };
    if ($('#blindgang') && $('#blindgang').checked) {
      var sensorenMoeglich = !!($('#sensoren-aktiv') && !$('#sensoren-aktiv').disabled);
      return T.tresorLogik.blindKonfiguration(notausgang, sensorenMoeglich,
        $('#blind-zeitschloss').value);
    }
    var stufen = {};
    aktiveDimensionen().forEach(function (dimension) {
      stufen[dimension] = Number(($('#stufe-' + dimension) || {}).value || 3);
    });
    var minFaktor = Number($('#frist-min').value) / 10;
    var maxFaktor = Number($('#frist-max').value) / 10;
    if (maxFaktor < minFaktor + 0.2) maxFaktor = minFaktor + 0.2;
    return {
      dimensionen: aktiveDimensionen(),
      stufen: stufen,
      aufgabenProFragment: Number($('#aufgaben-pro-fragment').value),
      rechenzeit: Number($('#rechenzeit').value),
      reihenfolge: $('#reihenfolge').value,
      sicherheit: $('#sicherheit').value,
      tresorzeit: {
        minSekunden: Math.min(Number($('#tresorzeit-min').value), Number($('#tresorzeit-max').value)),
        maxSekunden: Math.max(Number($('#tresorzeit-min').value), Number($('#tresorzeit-max').value))
      },
      sensoren: !!($('#sensoren-aktiv') && $('#sensoren-aktiv').checked),
      mitPassphrase: $('#passphrase-aktiv').checked,
      strafe: Number($('#strafzeit').value),
      gluecksspiel: $('#gluecksspiel').checked,
      erinnerungen: $('#erinnerungen').checked,
      geheimeFrist: {
        aktiv: $('#frist-aktiv').checked,
        bezug: $('#frist-bezug').value,
        minSekunden: Number($('#frist-min-zeit').value),
        maxSekunden: Number($('#frist-max-zeit').value),
        minFaktor: minFaktor,
        maxFaktor: maxFaktor,
        folge: $('#frist-folge').value
      },
      notausgang: notausgang
    };
  }

  function aufwandAktualisieren() {
    if (!$('#rechenzeit-aufwand')) return;
    var ohneRechenzeit = zeitschlossArt() !== 'rechenzeit';

    if (ohneRechenzeit) {
      $('#rechenzeit-aufwand').textContent = '';
    } else {
      var proSchloss = T.tresorLogik.RECHENZEIT_STUFEN[Number($('#rechenzeit').value) - 1];
      $('#rechenzeit-aufwand').textContent = rechenaufwand(proSchloss * zustand.laenge)
        + ' (' + zustand.laenge + ' × ' + util.dauer(proSchloss) + ', in Etappen verteilbar)';
    }

    // Den Notausgang gibt es in beiden Modi - nur zahlt er einmal in
    // Rechenzeit und einmal schlicht in Wartezeit.
    var exit = notausgangFelderZeigen(ohneRechenzeit);
    var exitAufwand = exit.modus === 'aus' ? 0 : exit.modus === 'fest' ? exit.fest : exit.max;
    $('#notausgang-aufwand').textContent = exitAufwand && !ohneRechenzeit ? rechenaufwand(exitAufwand) : '';
  }

  /* Sichtbarkeit und Erklaerung der Notausgang-Felder.
   *
   * Steht bewusst ausserhalb von aufwandAktualisieren: Unter Willkür
   * gibt es nichts zu schaetzen, weshalb die Schaetzung dort frueh aussteigt -
   * aber der Notausgang ist genau dort der einzige Wert, den der Spieler
   * setzt, und der einzige Boden nach unten. Wer das Risiko eingeht, muss
   * seine feste Zeit auch einstellen koennen. */
  function notausgangFelderZeigen(ohneRechenzeit) {
    var modus = $('#notausgang-modus').value;
    var drand = zeitschlossArt() === 'drand';
    var art = drand ? '' : ohneRechenzeit ? 'Wartezeit' : 'Rechenzeit';
    var obergrenze = zeitschlossArt() === 'rechenzeit' ? T.tresorLogik.NOTAUSGANG_RECHENZEIT_MAX : Infinity;

    /* Werte ueber einem Tag gibt es nur ohne Rechnen. Ist gerade einer davon
     * gewaehlt und der Modus wechselt zu Rechenzeit, rutscht die Wahl auf den
     * groessten erlaubten - sonst stuende eine Woche Rechenzeit im Formular. */
    ['#notausgang-dauer', '#notausgang-min', '#notausgang-max'].forEach(function (auswahl) {
      var feld = $(auswahl);
      util.$$(auswahl + ' option').forEach(function (option) {
        if (!option.dataset.sekunden) return;
        var sek = Number(option.dataset.sekunden);
        option.hidden = sek > obergrenze;
        option.disabled = sek > obergrenze;
        option.textContent = util.dauer(sek) + (art ? ' ' + art : '');
      });
      if (Number(feld.value) > obergrenze) feld.value = String(obergrenze);
    });
    var fest = Number($('#notausgang-dauer').value);
    var min = Math.min(Number($('#notausgang-min').value), Number($('#notausgang-max').value));
    var max = Math.max(Number($('#notausgang-min').value), Number($('#notausgang-max').value));

    $('#notausgang-fest-feld').classList.toggle('versteckt', modus !== 'fest');
    $('#notausgang-spanne-felder').classList.toggle('versteckt', modus !== 'zufall' && modus !== 'geheim');
    $('#notausgang-spanne').textContent =
      modus === 'aus' ? ''
      : modus === 'fest'
        ? 'Der Notausgang springt nach genau ' + nachDauer(fest) + (art ? ' ' + art : '')
          + ' auf. Du weißt also von Anfang an, woran du bist.'
      : modus === 'zufall'
        ? 'Die Dauer wird beim Verriegeln zufällig zwischen ' + util.dauer(min) + ' und ' + util.dauer(max)
          + ' gezogen - und dir danach angezeigt. Du weißt sie erst nach dem Verriegeln, dann aber genau.'
      : 'Die Dauer wird beim Verriegeln zufällig zwischen ' + util.dauer(min) + ' und ' + util.dauer(max)
        + ' gezogen und bleibt geheim. '
        + (drand
            ? 'Angezeigt wird sie nicht. Im Speicher steht die Runde des Netzes allerdings - ohne sie ließe er sich nicht öffnen.'
          : ohneRechenzeit
            ? 'Angezeigt wird sie nicht - im Browser-Speicher steht sie allerdings, wie alles in diesem Modus.'
            : 'Sie wird nirgends gespeichert: Der Rechner merkt am Prüfwert selbst, wann er angekommen ist. Du erfährst sie erst, wenn der Notausgang aufspringt.');
    return { modus: modus, art: art, fest: fest, min: min, max: max };
  }

  function schaetzungAktualisieren() {
    var anzeige = $('#schaetzung');
    if (!anzeige) return;

    /* Unter Willkür gibt es nichts zu schätzen - das ist der Punkt. Der
     * Notausgang zahlt dort immer in Rechenzeit. */
    if ($('#blindgang') && $('#blindgang').checked) {
      anzeige.textContent = 'Das erfährst du nicht.';
      $('#schaetzung-detail').textContent = '';
      notausgangFelderZeigen(zeitschlossArt() !== 'rechenzeit');
      $('#notausgang-aufwand').textContent = '';
      return;
    }

    var dimensionen = aktiveDimensionen();
    if (!dimensionen.length) { anzeige.textContent = '-'; return; }
    var konfig = konfigurationLesen();
    var ohneRechenzeit = !T.tresorLogik.rechenzeitModus(konfig);
    var drand = T.tresorLogik.drandModus(konfig);
    var schaetzung = T.tresorLogik.geschaetzteDauer(konfig, zustand.laenge);
    var rechen = ohneRechenzeit ? 0 : T.tresorLogik.RECHENZEIT_STUFEN[util.grenze(konfig.rechenzeit, 1, 5) - 1];
    var tz = konfig.tresorzeit;
    /* "nach 2 bis 5 Tagen" statt "nach 2 Tage bis 5 Tagen" */
    var beideTage = /^\d+ Tage$/.test(util.dauer(tz.minSekunden)) && /^\d+ Tage$/.test(util.dauer(tz.maxSekunden));
    var tzText = tz.minSekunden === tz.maxSekunden ? nachDauer(tz.minSekunden)
      : (beideTage ? util.dauer(tz.minSekunden).replace(' Tage', '') : util.dauer(tz.minSekunden))
        + ' bis ' + nachDauer(tz.maxSekunden);
    anzeige.textContent = drand
      ? 'offen nach ' + tzText
      : 'ungefähr ' + util.dauer(schaetzung.sekunden);
    $('#rechenzeit-feld').classList.toggle('versteckt', ohneRechenzeit);
    $('#tresorzeit-felder').classList.toggle('versteckt', !drand);
    /* Am Netz gehen alle Fragmente zur selben Zeit auf - die Reihenfolge
     * der Freigabe hat dort keine Bedeutung. */
    $('#reihenfolge-feld').classList.toggle('versteckt', zustand.art === 'foto' || drand);

    /* Zeitrahmen am Netz: was eine Pruefung wert ist und ob sie im Takt kommen. */
    var pruefungen = zustand.laenge * Math.max(1, konfig.aufgabenProFragment);
    var takt = (tz.minSekunden >= T.tresorLogik.TAKT.ab && pruefungen > 1) ? tz.minSekunden / pruefungen : 0;
    var fenster = takt ? Math.max(takt, T.tresorLogik.TAKT.fensterMin) : 0;
    var wert = (tz.maxSekunden - tz.minSekunden) / pruefungen;
    $('#tresorzeit-hinweis').textContent = (tz.minSekunden === tz.maxSekunden
      ? 'Kein Spielraum: Prüfungen holen keine Zeit zurück, Fehler schieben trotzdem.'
      : 'Du startest bei ' + nachDauer(tz.maxSekunden) + '. Jede gelöste Prüfung holt Zeit zurück, bis '
        + util.dauer(tz.minSekunden) + ' - meist ' + spanneText(T.tresorLogik.ausschlagSpanne(konfig, wert, tz.maxSekunden))
        + '. Jeder Fehler schiebt dich weg, bis zum Notausgang.')
      + (takt
        ? ' Die ' + pruefungen + ' Prüfungen kommen verteilt, etwa alle ' + util.dauer(takt)
          + '. Binnen ' + util.dauer(fenster) + ' gelöst zählt voll, später die Hälfte.'
        : ' Alle Prüfungen stehen sofort bereit.');

    /* Strafe und Wurf erklaeren sich je nach Modus anders. */
    var strafOptionen = $('#strafzeit').options;
    strafOptionen[1].textContent = drand ? 'mild – um 4 % des oberen Werts' : 'mild – ab 20 s, steigend';
    strafOptionen[2].textContent = drand ? 'hart – um 8 % des oberen Werts' : 'hart – ab 60 s, steigend';
    $('#strafzeit-hinweis').textContent = drand
      ? 'Eine Strafe schiebt die Freigabe nach hinten, meist '
        + spanneText(T.tresorLogik.ausschlagSpanne(konfig,
            T.tresorLogik.drandStrafe({ strafe: konfig.strafe || 1 }, 1, tz.maxSekunden), tz.maxSekunden))
        + '. Wie viel, wird jedes Mal gezogen. Jeder weitere Fehlversuch an derselben Prüfung wiegt ein Drittel mehr.'
      : 'Jeder weitere Fehlversuch kostet das 1,7-Fache. Höchstens 30 Minuten.';
    $('#gluecksspiel-titel').textContent = drand ? 'Gutschriften, Strafen und Wartezeiten dürfen verwürfelt werden'
      : 'Wartezeiten dürfen verwürfelt werden';
    $('#gluecksspiel-hinweis').textContent = drand
      ? 'Wartezeiten immer, Gutschriften und Strafen ab und zu - etwa jede dritte. 5 oder 6: Die Strafe fällt weg, '
        + 'die Gutschrift verdoppelt sich. 1 bis 4: Die Strafe wird um die Hälfte länger, die Gutschrift halbiert. '
        + 'Im Mittel kostet dich das nichts. Im Einzelfall alles.'
      : 'Einmal je Wartezeit. 5 oder 6: die Zeit fällt weg. 1 bis 4: der Rest wird um die Hälfte länger. '
        + 'Im Mittel kostet dich das nichts. Im Einzelfall alles.';
    $('#sicherheit-hinweis').textContent = drand
      ? 'Fern: Der Tresor hängt an drand, einem öffentlichen Netz unabhängiger Betreiber. Vor der Zeit öffnet ihn niemand - '
        + 'du nicht, eine verstellte Uhr nicht, jemand mit Entwicklerwerkzeug nicht. Das Gerät muss dafür nicht rechnen, '
        + 'der Bildschirm darf aus sein. Zum Öffnen braucht es Internet. Verschwindet das Netz vor dem Termin, ist das Geheimnis verloren.'
      : ohneRechenzeit
      ? 'Nachsichtig: Es hält dich nichts als dein eigener Vorsatz. Wer den Speicher dieses Browsers liest, hat das Geheimnis sofort. Dafür kostet es keinen Strom, und der Notausgang zahlt in Wartezeit. Aufgaben, die eine Antwort verlangen, wirken trotzdem - ihre Lösung steckt im Schlüssel.'
      : 'Eisern: Jedes Fragment kostet echte Zeit, die niemand abkürzen kann - du nicht, und jemand mit Entwicklerwerkzeug auch nicht.';
    var exitModusW = konfig.notausgang.modus;
    var exitDauerText = exitModusW === 'fest'
      ? nachDauer(konfig.notausgang.sekunden)
      : util.dauer(Math.min(konfig.notausgang.minSekunden, konfig.notausgang.maxSekunden))
        + ' bis ' + nachDauer(Math.max(konfig.notausgang.minSekunden, konfig.notausgang.maxSekunden));
    aufwandAktualisieren();
    var exitMaxW = exitModusW === 'aus' ? 0 : exitModusW === 'fest' ? konfig.notausgang.sekunden
      : Math.max(konfig.notausgang.minSekunden, konfig.notausgang.maxSekunden);
    $('#abschluss-warnung').textContent = drand
      ? 'Ab hier öffnet ihn nur noch das Netz - bestenfalls nach ' + nachDauer(tz.minSekunden)
        + ', ohne eine Prüfung nach ' + nachDauer(tz.maxSekunden) + ', mit jeder Strafe später'
        + (exitModusW !== 'aus'
            ? ', spätestens über den Notausgang nach ' + exitDauerText + '.'
              + (exitMaxW < tz.minSekunden ? ' Der Notausgang kommt vor dem Rahmen - er ist damit der einzige Weg.' : '')
            : '. Ohne Notausgang bis zum Zehnfachen.')
        + ' Zum Öffnen braucht es Internet. Löschen des Tresors löscht das Geheimnis.'
      : ohneRechenzeit
      ? 'Der weniger sichere Modus hält niemanden auf, der den Browser-Speicher liest - er hält dich auf.'
        + (exitModusW !== 'aus' ? ' Der Notausgang öffnet nach ' + exitDauerText + ' Wartezeit.' : '')
        + ' Löschen des Tresors löscht das Geheimnis.'
      : exitModusW !== 'aus'
        ? 'Ab hier führen nur noch die Aufgaben zur Zahl - oder der Notausgang, der '
          + exitDauerText + ' Rechenzeit kostet. Löschen des Tresors löscht die Zahl.'
        : 'Danach gibt es keinen Notausgang: Nur die Aufgaben und die Rechenzeit führen zur Zahl zurück. Löschen des Tresors löscht die Zahl.';
    $('#schaetzung-detail').textContent =
      zustand.laenge + ' Fragmente · ' + konfig.aufgabenProFragment
      + (konfig.aufgabenProFragment === 1 ? ' Aufgabe' : ' Aufgaben') + ' je Fragment · '
      + (drand ? 'am Netz' : rechen ? util.dauer(rechen) + ' Bann je Fragment' : 'ohne Bann')
      + (schaetzung.gebundeneAufgaben ? ' · ' + schaetzung.gebundeneAufgaben + ' Aufgaben gehen in die Schlüssel ein' : '')
      + (schaetzung.mitZeitfenster ? ' · enthält ein Zeitfenster, das an eine Tageszeit gebunden ist' : '')
      + (konfig.strafe ? (drand ? ' · Strafen verschieben die Freigabe' : ' · Strafzeiten aktiv') : '')
      + (konfig.erinnerungen ? ' · mit Erinnerungen' : ' · ohne Erinnerungen')
      + (konfig.geheimeFrist.aktiv
          ? ' · geheime Höchstzeit ' + (konfig.geheimeFrist.bezug === 'tresor'
              ? 'zwischen ' + util.dauer(Math.min(konfig.geheimeFrist.minSekunden, konfig.geheimeFrist.maxSekunden))
                + ' und ' + util.dauer(Math.max(konfig.geheimeFrist.minSekunden, konfig.geheimeFrist.maxSekunden))
              : 'je Aufgabe')
          : '');
  }

  function zeichneEinrichten() {
    aufraeumen();
    var wurzel = util.leeren($('#buehne'));
    var dimensionen = T.herausforderungen.dimensionen;

    var geheimTeil = el('section', { class: 'karte' }, [
      el('h2', { text: '1 · Das Geheimnis' }),
      el('div', { class: 'reiter' }, [
        el('button', { class: 'reiter-knopf' + (zustand.art === 'zahl' ? ' ist-aktiv' : ''), type: 'button', id: 'art-zahl', text: 'Zahl' }),
        el('button', { class: 'reiter-knopf' + (zustand.art === 'foto' ? ' ist-aktiv' : ''), type: 'button', id: 'art-foto', text: 'Bild' })
      ]),

      el('div', { id: 'art-bereich-zahl', class: zustand.art === 'zahl' ? '' : 'versteckt' }, [
        el('p', { class: 'flaut', text: 'Eine Ziffer je Fragment. Danach existiert die Zahl nirgends mehr - auch nicht für mich.' }),
        el('div', { class: 'reiter' }, [
          el('button', { class: 'reiter-knopf ist-aktiv', type: 'button', id: 'reiter-tippen', text: 'Tippen' }),
          el('button', { class: 'reiter-knopf', type: 'button', id: 'reiter-foto', text: 'Vom Foto ablesen' })
        ]),
        el('div', { id: 'eingabe-tippen' }, [
          el('div', { class: 'zifferzeile', id: 'ziffernfelder' }),
          el('label', { class: 'nebenlabel' }, [
            'Stellen: ',
            el('select', { id: 'laenge' }, [3, 4, 5, 6, 7, 8].map(function (n) {
              return el('option', { value: String(n), selected: n === zustand.laenge ? 'selected' : null }, String(n));
            }))
          ])
        ]),
        el('div', { id: 'eingabe-foto', class: 'versteckt' }, [
          el('p', { class: 'flaut', text: 'Foto oder Screenshot. Hell, Ziffern gerade. Korrigieren kannst du danach.' }),
          el('input', { type: 'file', accept: 'image/*', capture: 'environment', id: 'fotodatei' }),
          el('div', { id: 'foto-ergebnis' })
        ])
      ]),

      el('div', { id: 'art-bereich-foto', class: zustand.art === 'foto' ? '' : 'versteckt' }, [
        el('p', { class: 'flaut', text: 'Zerlegt in Schärfestufen - erst ein Farbfleck, zuletzt das ganze Bild. Jede Stufe kostet dich einzeln.' }),
        el('input', { type: 'file', accept: 'image/*', id: 'bilddatei' }),
        el('div', { class: 'feld' }, [
          el('label', { for: 'bild-stufen', text: 'Schärfestufen' }),
          el('select', { id: 'bild-stufen' }, [3, 4, 5, 6, 7, 8].map(function (n) {
            return el('option', { value: String(n), selected: n === 5 ? 'selected' : null }, String(n) + ' Stufen');
          }))
        ]),
        el('div', { class: 'feld' }, [
          el('label', { for: 'bild-vorletzte', text: 'Wie viel die vorletzte Stufe zeigt' }),
          el('input', { type: 'range', min: '0', max: '6', value: '3', id: 'bild-vorletzte' }),
          el('output', { id: 'bild-vorletzte-anzeige', text: '1/8' })
        ]),
        el('p', { class: 'flaut klein', text:
          'Das letzte Fragment macht den Sprung auf das ganze Bild. Wie weit es davor noch weg ist, '
          + 'hängt davon ab, wie groß dein Motiv im Bild steht - sieh es dir unten an.' }),
        el('div', { id: 'bild-ergebnis' })
      ])
    ]);

    var dimensionTeil = el('section', { class: 'karte' }, [
      el('h2', { text: '2 · Womit soll ich dich aufhalten?' }),
      el('p', { class: 'flaut klein', id: 'dimension-hinweis', text: '' }),
      el('div', { class: 'dimension-gitter' }, dimensionen.map(function (dimension) {
        var module = T.herausforderungen.nachDimension(dimension.id);
        var kasten = el('label', { class: 'dimension-karte' + (dimension.fertig ? '' : ' ist-geplant') }, [
          el('div', { class: 'dimension-kopf' }, [
            el('input', {
              type: 'checkbox', value: dimension.id,
              checked: dimension.fertig && zustand.konfig.dimensionen.indexOf(dimension.id) !== -1 ? 'checked' : null,
              disabled: dimension.fertig ? null : 'disabled'
            }),
            el('strong', { text: dimension.name }),
            dimension.fertig ? el('span', { class: 'zaehler', text: module.length + ' Typen' })
              : el('span', { class: 'zaehler', text: 'geplant' })
          ]),
          el('p', { class: 'flaut', text: dimension.beschreibung })
        ]);
        if (dimension.fertig) {
          var startStufe = String(zustand.konfig.stufen[dimension.id] || 3);
          kasten.appendChild(el('div', { class: 'stufenzeile' }, [
            el('span', { class: 'flaut', text: 'Intensität' }),
            el('input', { type: 'range', min: '1', max: '5', value: startStufe, id: 'stufe-' + dimension.id }),
            el('output', { id: 'stufe-anzeige-' + dimension.id, text: startStufe })
          ]));
          if (dimension.gebunden) {
            kasten.appendChild(el('p', { class: 'flaut klein', text:
              'Die Antworten gehen in die Schlüssel ein. Je mehr gebundene Aufgaben ein Fragment hat, desto teurer wird Durchprobieren - die Ratebereiche multiplizieren sich.' }));
          }
          kasten.appendChild(el('ul', { class: 'typenliste' }, module.map(function (m) {
            return el('li', { text: m.name + ' - ' + m.kurz });
          })));
        }
        return kasten;
      }))
    ]);

    var zeitTeil = el('section', { class: 'karte' }, [
      el('h2', { text: '3 · Zeitregeln' }),
      el('div', { id: 'zeitschloss-wahl' }, [
        el('div', { class: 'feld' }, [
          el('label', { for: 'sicherheit', text: 'Was hält ihn verschlossen?' }),
          el('select', { id: 'sicherheit' }, [
            el('option', { value: 'rechenzeit' }, 'eisern – jedes Fragment muss freigerechnet werden'),
            el('option', { value: 'drand' }, 'fern – das Netz hält ihn, auch wochenlang'),
            el('option', { value: 'ohne-rechenzeit' }, 'nachsichtig – kein Bann, nur Uhr und Aufgaben')
          ])
        ]),
        el('p', { class: 'flaut klein', id: 'sicherheit-hinweis', text: '' }),
        el('div', { id: 'tresorzeit-felder', class: 'versteckt' }, [
          el('div', { class: 'feld' }, [
            el('label', { for: 'tresorzeit-min', text: 'Bestenfalls offen nach' }),
            el('select', { id: 'tresorzeit-min' }, tresorzeitOptionen(3600))
          ]),
          el('div', { class: 'feld' }, [
            el('label', { for: 'tresorzeit-max', text: 'Ohne eine Prüfung offen nach' }),
            el('select', { id: 'tresorzeit-max' }, tresorzeitOptionen(10800))
          ]),
          el('p', { class: 'flaut klein', id: 'tresorzeit-hinweis', text: '' })
        ])
      ]),
      el('div', { class: 'feld' }, [
        el('label', { for: 'strafzeit', text: 'Strafe bei Fehlversuch' }),
        el('select', { id: 'strafzeit' }, [
          el('option', { value: '0' }, 'aus'),
          el('option', { value: '1' }, 'mild – ab 20 s, steigend'),
          el('option', { value: '2' }, 'hart – ab 60 s, steigend')
        ])
      ]),
      el('p', { class: 'flaut klein', id: 'strafzeit-hinweis', text: 'Jeder weitere Fehlversuch kostet das 1,7-Fache. Höchstens 30 Minuten.' }),
      el('label', { class: 'schalterzeile' }, [
        el('input', { type: 'checkbox', id: 'gluecksspiel' }),
        el('span', { id: 'gluecksspiel-titel', text: 'Wartezeiten dürfen verwürfelt werden' })
      ]),
      el('p', { class: 'flaut klein', id: 'gluecksspiel-hinweis', text:
        'Einmal je Wartezeit. 5 oder 6: die Zeit fällt weg. 1 bis 4: der Rest wird um die Hälfte länger. '
        + 'Im Mittel kostet dich das nichts. Im Einzelfall alles.' }),
      el('label', { class: 'schalterzeile' }, [
        el('input', { type: 'checkbox', id: 'erinnerungen' }),
        el('span', { text: 'Erinnerungen schicken' })
      ]),
      el('p', { class: 'flaut klein', id: 'erinnerungen-hinweis', text:
        'Eine Nachricht, wenn eine Sperrfrist abläuft, ein Check-in-Fenster aufgeht oder der Notausgang offen ist. '
        + 'Ohne Erinnerungen musst du selbst daran denken - das kann genau der Punkt sein. '
        + 'Die Einstellung gehört zum Tresor und lässt sich später nicht mehr ändern.' }),
      el('label', { class: 'schalterzeile' }, [
        el('input', { type: 'checkbox', id: 'frist-aktiv' }),
        el('span', { text: 'Geheimes Zeitlimit für die Aufgaben' })
      ]),
      el('p', { class: 'flaut klein', text: 'Eine Frist, deren Länge du nicht kennst. Läufst du hinein, fällt dein Fortschritt zurück. Du siehst nur, wie lange du schon brauchst.' }),
      el('div', { id: 'frist-bereich' }, [
        el('div', { class: 'feld' }, [
          el('label', { for: 'frist-bezug', text: 'Wofür gilt sie?' }),
          el('select', { id: 'frist-bezug' }, [
            el('option', { value: 'tresor' }, 'für den ganzen Tresor'),
            el('option', { value: 'aufgabe' }, 'für jede einzelne Aufgabe')
          ])
        ]),
        el('div', { id: 'frist-absolut' }, [
          el('div', { class: 'feld' }, [
            el('label', { for: 'frist-min-zeit', text: 'Mindestens' }),
            el('select', { id: 'frist-min-zeit' }, zeitOptionen(3600))
          ]),
          el('div', { class: 'feld' }, [
            el('label', { for: 'frist-max-zeit', text: 'Höchstens' }),
            el('select', { id: 'frist-max-zeit' }, zeitOptionen(18000))
          ]),
          el('p', { class: 'flaut klein', id: 'frist-spanne-hinweis', text: '' })
        ]),
        el('div', { id: 'frist-relativ', class: 'versteckt' }, [
          el('div', { class: 'feld' }, [
            el('label', { text: 'Vielfaches der geschätzten Dauer' }),
            el('div', { class: 'doppelregler' }, [
              el('input', { type: 'range', min: '10', max: '30', value: '12', id: 'frist-min' }),
              el('input', { type: 'range', min: '15', max: '60', value: '30', id: 'frist-max' })
            ]),
            el('output', { id: 'frist-anzeige', text: '1,2× bis 3,0×' })
          ])
        ]),
        el('div', { class: 'feld' }, [
          el('label', { for: 'frist-folge', text: 'Wenn die Zeit abläuft' }),
          el('select', { id: 'frist-folge' }, [
            el('option', { value: 'aufgaben' }, 'Aufgaben fallen auf Anfang zurück'),
            el('option', { value: 'alles' }, 'zusätzlich verfällt die Rechenzeit')
          ])
        ])
      ]),
      el('div', { class: 'feld' }, [
        el('label', { for: 'notausgang-modus', text: 'Notausgang' }),
        el('select', { id: 'notausgang-modus' }, [
          el('option', { value: 'aus' }, 'kein Notausgang'),
          el('option', { value: 'fest', selected: 'selected' }, 'feste Dauer'),
          el('option', { value: 'zufall' }, 'zufällig aus einer Spanne – Dauer wird angezeigt'),
          el('option', { value: 'geheim' }, 'zufällig aus einer Spanne – Dauer bleibt geheim')
        ])
      ]),
      el('div', { class: 'feld', id: 'notausgang-fest-feld' }, [
        el('label', { for: 'notausgang-dauer', text: 'Dauer' }),
        el('select', { id: 'notausgang-dauer' }, notausgangOptionen(1800))
      ]),
      el('div', { id: 'notausgang-spanne-felder' }, [
        el('div', { class: 'feld' }, [
          el('label', { for: 'notausgang-min', text: 'frühestens nach' }),
          el('select', { id: 'notausgang-min' }, notausgangOptionen(1800))
        ]),
        el('div', { class: 'feld' }, [
          el('label', { for: 'notausgang-max', text: '… und spätestens nach' }),
          el('select', { id: 'notausgang-max' }, notausgangOptionen(10800))
        ])
      ]),
      el('p', { class: 'flaut klein', id: 'notausgang-spanne', text: '' }),
      el('p', { class: 'flaut klein', text: 'Der Weg für die, die es nicht schaffen. Keine Aufgaben, keine Fristen - nur abwarten.' }),
      el('p', { class: 'flaut klein aufwandzeile', id: 'notausgang-aufwand', text: '' })
    ]);

    var feinTeil = el('section', { class: 'karte' }, [
      el('h2', { text: '4 · Feineinstellung' }),
      el('div', { class: 'feld' }, [
        el('label', { for: 'aufgaben-pro-fragment', text: 'Aufgaben pro Fragment' }),
        el('input', { type: 'range', min: '1', max: '4', value: '2', id: 'aufgaben-pro-fragment' }),
        el('output', { id: 'aufgaben-anzeige', text: '2' })
      ]),
      el('label', { class: 'schalterzeile' }, [
        el('input', { type: 'checkbox', id: 'sensoren-aktiv', disabled: 'disabled' }),
        el('span', { text: 'Sensoraufgaben zulassen (Wasserwaage, Lagenfolge, Schritte)' })
      ]),
      el('p', { class: 'flaut klein', id: 'sensoren-hinweis', text: 'Sensor wird geprüft ...' }),
      el('button', { class: 'knopf versteckt', type: 'button', id: 'sensoren-freigeben',
        text: 'Sensor freigeben und prüfen' }),
      el('p', { class: 'warnung versteckt', id: 'sensoren-warnung', text: '' }),
      el('label', { class: 'schalterzeile' }, [
        el('input', { type: 'checkbox', id: 'passphrase-aktiv' }),
        el('span', { text: 'Zusätzlich mit einer Passphrase verschließen' })
      ]),
      el('div', { id: 'passphrase-felder', class: 'versteckt' }, [
        el('div', { class: 'antwortzeile' }, [
          el('input', { type: 'password', id: 'passphrase', class: 'antwortfeld',
            autocomplete: 'new-password', placeholder: 'Passphrase' })
        ]),
        el('div', { class: 'antwortzeile' }, [
          el('input', { type: 'password', id: 'passphrase-wdh', class: 'antwortfeld',
            autocomplete: 'new-password', placeholder: 'noch einmal' })
        ]),
        el('p', { class: 'warnung', text:
          'Sie liegt nirgends - nicht hier, nicht in einer Sicherung. Ohne sie kommt niemand an das Geheimnis. '
          + 'Auch nicht über den Notausgang. Auch du nicht. Vergessen heißt verloren.' }),
        el('p', { class: 'flaut klein', id: 'passphrase-hinweis', text: '' })
      ]),
      el('div', { class: 'feld', id: 'rechenzeit-feld' }, [
        el('label', { for: 'rechenzeit', text: 'Wie lange der Bann auf jedem Fragment liegt' }),
        el('input', { type: 'range', min: '1', max: '5', value: '2', id: 'rechenzeit' }),
        el('output', { id: 'rechenzeit-anzeige', text: '45 s' }),
        el('p', { class: 'flaut klein aufwandzeile', id: 'rechenzeit-aufwand', text: '' })
      ]),
      el('div', { class: 'feld', id: 'reihenfolge-feld' }, [
        el('label', { for: 'reihenfolge', text: 'Freigabereihenfolge' }),
        el('select', { id: 'reihenfolge' }, [
          el('option', { value: 'links' }, 'von links nach rechts'),
          el('option', { value: 'zufall' }, 'zufällige Stellen zuerst')
        ])
      ]),
      el('div', { class: 'schaetzkasten' }, [
        el('span', { class: 'flaut', text: 'Was dich das kosten wird' }),
        el('strong', { id: 'schaetzung', text: '-' }),
        el('span', { class: 'flaut klein', id: 'schaetzung-detail', text: '' })
      ])
    ]);

    var abschluss = el('section', { class: 'karte' }, [
      el('p', { class: 'warnung', id: 'abschluss-warnung', text: '' }),
      el('button', { id: 'verriegeln', class: 'knopf gross haupt', type: 'button', disabled: 'disabled', text: 'Tresor verriegeln' }),
      el('p', { class: 'flaut', id: 'bereit-hinweis', text: '' })
    ]);

    var blindTeil = el('section', { class: 'karte blindkarte' }, [
      el('label', { class: 'schalterzeile' }, [
        el('input', { type: 'checkbox', id: 'blindgang' }),
        el('span', { class: 'blindtitel', text: 'Willkür' })
      ]),
      el('p', { class: 'flaut klein', text:
        'Du setzt den Notausgang. Alles andere bestimme ich - wie viele Prüfungen, welche, wie hart, '
        + 'und was sie dich an Zeit kosten oder bringen. Kein Fahrplan, keine Schätzung, keine Uhr. '
        + 'Du erfährst nichts, bis es so weit ist.' }),
      el('div', { class: 'feld versteckt', id: 'blind-sanft-zeile' }, [
        el('label', { for: 'blind-zeitschloss', text: 'Was ihn hält' }),
        el('select', { id: 'blind-zeitschloss' }, [
          el('option', { value: 'drand', selected: 'selected' }, 'das Netz - Zeit, die ich dir gebe oder nehme'),
          el('option', { value: 'rechenzeit' }, 'Rechenzeit - das Gerät muss ackern'),
          el('option', { value: 'ohne-rechenzeit' }, 'nur dein Vorsatz - schont den Akku')
        ])
      ]),
      el('p', { class: 'warnung versteckt', id: 'blindgang-warnung', text: '' })
    ]);

    var stationTeil = el('section', { class: 'karte versteckt', id: 'stationkarte' }, [
      el('h2', { text: 'Deine Stationen' }),
      el('p', { class: 'flaut klein', id: 'station-lage', text: '' }),
      el('p', { class: 'flaut klein', text:
        'Verteil sie, wo du willst - hinter dem Regal, im Keller, unter der Fensterbank. Jedes Fragment '
        + 'hängt an genau einer. An welcher, erfährst du nicht.' }),
      el('div', { class: 'stationsreihe', id: 'stationsreihe' }),
      el('button', { class: 'knopf', type: 'button', id: 'station-schreiben', text: 'Nächste Marke beschreiben' }),
      el('button', { class: 'knopf', type: 'button', id: 'station-verwerfen', text: 'Von vorn' }),
      el('p', { class: 'aufgabe-meldung', id: 'station-meldung', role: 'status' }),
      el('p', { class: 'warnung', text:
        'Verlierst du eine Marke, bleibt für ihr Fragment nur der Notausgang. Und wer eine in die Hand '
        + 'bekommt, liest sie mit jeder NFC-App aus: Das hält dich auf, nicht jemanden, der bei dir ein und aus geht.' })
    ]);

    wurzel.appendChild(geheimTeil);
    wurzel.appendChild(blindTeil);
    wurzel.appendChild(dimensionTeil);
    wurzel.appendChild(stationTeil);
    wurzel.appendChild(zeitTeil);
    wurzel.appendChild(feinTeil);
    wurzel.appendChild(abschluss);

    /* Probelauf: Ob eine Uebung zu schaffen ist, zeigt sich erst beim
     * Spielen - und dann steht der Tresor schon zu. */
    wurzel.appendChild(el('section', { class: 'karte' }, [
      el('p', { class: 'flaut klein', text:
        'Unsicher, ob eine Prüfung zu schaffen ist? Probier sie aus, bevor du verriegelst.' }),
      el('button', { class: 'knopf', type: 'button', text: 'Prüfungen ausprobieren',
        onclick: function () { T.probe.zeige(zeichneEinrichten); } })
    ]));

    ziffernFelder($('#ziffernfelder'));

    $('#laenge').addEventListener('change', function () {
      zustand.laenge = Number(this.value);
      zustand.geheimnis = zustand.geheimnis.slice(0, zustand.laenge);
      ziffernFelder($('#ziffernfelder'));
      schaetzungAktualisieren(); pruefeBereit();
    });

    $('#art-zahl').addEventListener('click', function () { artWechsel('zahl'); });
    $('#art-foto').addEventListener('click', function () { artWechsel('foto'); });
    $('#bilddatei').addEventListener('change', bildVerarbeiten);
    $('#bild-vorletzte').addEventListener('input', function () {
      $('#bild-vorletzte-anzeige').textContent = '1/' + VORLETZTE_TEILER[Number(this.value)];
      if (zustand.bild && zustand.bild.datei) bildVerarbeiten({ target: { files: [zustand.bild.datei] } });
    });
    $('#bild-stufen').addEventListener('change', function () {
      if (zustand.bild && zustand.bild.datei) bildVerarbeiten({ target: { files: [zustand.bild.datei] } });
      schaetzungAktualisieren();
    });
    $('#reiter-tippen').addEventListener('click', function () { reiterWechsel('tippen'); });
    $('#reiter-foto').addEventListener('click', function () { reiterWechsel('foto'); });
    $('#fotodatei').addEventListener('change', fotoVerarbeiten);

    util.$$('.dimension-karte input[type=checkbox]').forEach(function (feld) {
      feld.addEventListener('change', function () {
        stationLageZeigen();
        schaetzungAktualisieren();
        pruefeBereit();
      });
    });
    $('#station-schreiben').addEventListener('click', stationBeschreiben);
    $('#station-verwerfen').addEventListener('click', function () {
      zustand.stationen = [];
      T.ortAufgaben.vorratLeeren();
      $('#station-meldung').textContent = 'Verworfen. Die Marken selbst behalten ihr Geheimnis, bis du sie neu beschreibst.';
      $('#station-meldung').className = 'aufgabe-meldung';
      stationLageZeigen();
      pruefeBereit();
    });
    stationLageZeigen();
    T.herausforderungen.dimensionen.forEach(function (dimension) {
      var regler = $('#stufe-' + dimension.id);
      if (!regler) return;
      regler.addEventListener('input', function () {
        $('#stufe-anzeige-' + dimension.id).textContent = regler.value;
        schaetzungAktualisieren();
      });
    });
    $('#strafzeit').addEventListener('change', schaetzungAktualisieren);
    $('#erinnerungen').addEventListener('change', async function () {
      var hinweis = $('#erinnerungen-hinweis');
      if (!this.checked) { schaetzungAktualisieren(); return; }
      if (!T.erinnerung.moeglich()) {
        this.checked = false;
        hinweis.textContent = 'Dieser Browser kann keine Benachrichtigungen anzeigen.';
        return;
      }
      var antwort = await T.erinnerung.erlaubnisHolen();
      if (antwort !== 'granted') {
        this.checked = false;
        hinweis.textContent = 'Der Browser hat Benachrichtigungen abgelehnt. Ohne seine Erlaubnis geht es nicht - '
          + 'du kannst das in den Seiteneinstellungen ändern und es dann erneut versuchen.';
      } else {
        hinweis.textContent = 'Erinnerungen sind erlaubt. Sie erreichen dich nur, solange diese Seite läuft - '
          + 'ein Hintergrund-Tab genügt, ein geschlossener Browser nicht.';
      }
      schaetzungAktualisieren();
    });
    ['#notausgang-modus', '#notausgang-dauer', '#notausgang-min', '#notausgang-max'].forEach(function (auswahl) {
      $(auswahl).addEventListener('change', schaetzungAktualisieren);
    });
    function fristAnsichtAktualisieren() {
      var aufTresor = $('#frist-bezug').value === 'tresor';
      $('#frist-absolut').classList.toggle('versteckt', !aufTresor);
      $('#frist-relativ').classList.toggle('versteckt', aufTresor);
      var min = Number($('#frist-min-zeit').value), max = Number($('#frist-max-zeit').value);
      $('#frist-spanne-hinweis').textContent = min >= max
        ? 'Mindestens muss kleiner als höchstens sein – die Werte werden beim Verriegeln getauscht.'
        : 'Gezogen wird irgendwo zwischen ' + util.dauer(min) + ' und ' + util.dauer(max) + ', ab dem Verriegeln.';
      schaetzungAktualisieren();
    }
    $('#frist-aktiv').addEventListener('change', function () {
      $('#frist-bereich').classList.toggle('versteckt', !this.checked);
      schaetzungAktualisieren();
    });
    $('#frist-bereich').classList.add('versteckt');
    $('#frist-bezug').addEventListener('change', fristAnsichtAktualisieren);
    $('#frist-min-zeit').addEventListener('change', fristAnsichtAktualisieren);
    $('#frist-max-zeit').addEventListener('change', fristAnsichtAktualisieren);
    $('#frist-folge').addEventListener('change', schaetzungAktualisieren);
    fristAnsichtAktualisieren();
    [$('#frist-min'), $('#frist-max')].forEach(function (regler) {
      regler.addEventListener('input', function () {
        var min = Number($('#frist-min').value) / 10, max = Number($('#frist-max').value) / 10;
        if (max < min + 0.2) max = min + 0.2;
        $('#frist-anzeige').textContent = min.toFixed(1).replace('.', ',') + '× bis ' + max.toFixed(1).replace('.', ',') + '×';
      });
    });
    $('#aufgaben-pro-fragment').addEventListener('input', function () {
      $('#aufgaben-anzeige').textContent = this.value;
      schaetzungAktualisieren();
    });
    $('#rechenzeit').addEventListener('input', function () {
      $('#rechenzeit-anzeige').textContent = util.dauer(T.tresorLogik.RECHENZEIT_STUFEN[Number(this.value) - 1]);
      schaetzungAktualisieren();
    });
    aufwandAktualisieren();
    $('#reihenfolge').addEventListener('change', schaetzungAktualisieren);
    $('#sicherheit').addEventListener('change', schaetzungAktualisieren);
    $('#tresorzeit-min').addEventListener('change', schaetzungAktualisieren);
    $('#tresorzeit-max').addEventListener('change', schaetzungAktualisieren);
    $('#sensoren-aktiv').addEventListener('change', function () {
      sensorWarnung();
      schaetzungAktualisieren();
    });
    $('#sensoren-freigeben').addEventListener('click', function () { sensorlageZeigen(true); });
    sensorlageZeigen(false);
    /* Unter Willkür zieht der Game Master die Dimensionen selbst - Stationen
     * kämen ohne beschriebene Marken nicht zustande. */

    /* Der Modus blendet alles aus, was der Game Master selbst entscheidet - bis
     * auf den Notausgang, der in den Zeitregeln stehen bleibt. */
    function blindgangAnwenden() {
      var an = $('#blindgang').checked;
      blindTeil.classList.toggle('ist-an', an);
      $('#blind-sanft-zeile').classList.toggle('versteckt', !an);
      $('#blindgang-warnung').classList.toggle('versteckt', !an);
      var art = $('#blind-zeitschloss').value;
      $('#blindgang-warnung').textContent = art === 'ohne-rechenzeit'
        ? 'Ohne Rechenzeit hält dich nichts als dein eigener Vorsatz - wer den Browser-Speicher liest, '
          + 'hat das Geheimnis sofort. Der Notausgang zahlt dann in Wartezeit.'
        : art === 'drand'
        ? 'Immer mit Strafen, und ich ziehe, wie viel sie wiegen. Mal fast nichts, mal ein Vielfaches. '
          + 'Setz den Notausgang so, dass du damit leben kannst - er ist die einzige Zahl, die gilt. '
          + 'Zum Öffnen braucht es Internet.'
        : 'Immer mit Strafen. Setz den Notausgang so, dass du damit leben kannst - '
          + 'du weisst nicht, wie lang der Weg wird.';
      dimensionTeil.classList.toggle('versteckt', an);
      feinTeil.classList.toggle('versteckt', an);

      var kinder = Array.prototype.slice.call(zeitTeil.children);
      var grenze = -1;
      kinder.forEach(function (kind, i) {
        if (grenze < 0 && kind.querySelector && kind.querySelector('#notausgang-modus')) grenze = i;
      });
      kinder.forEach(function (kind, i) {
        if (i === 0 || (grenze >= 0 && i >= grenze)) return;
        kind.classList.toggle('versteckt', an);
      });
      zeitTeil.querySelector('h2').textContent = an ? '2 · Der Notausgang' : '3 · Zeitregeln';
      schaetzungAktualisieren();
      pruefeBereit();
    }
    $('#blindgang').addEventListener('change', blindgangAnwenden);
    $('#blind-zeitschloss').addEventListener('change', blindgangAnwenden);
    $('#passphrase-aktiv').addEventListener('change', function () {
      $('#passphrase-felder').classList.toggle('versteckt', !this.checked);
      pruefeBereit();
      schaetzungAktualisieren();
    });
    [$('#passphrase'), $('#passphrase-wdh')].forEach(function (feld) {
      feld.addEventListener('input', pruefeBereit);
    });
    $('#verriegeln').addEventListener('click', verriegeln);

    wurzel.appendChild(sicherungsKarte());
    var verlauf = verlaufKarte();
    if (verlauf) wurzel.appendChild(verlauf);

    schaetzungAktualisieren();
    pruefeBereit();
  }

  function artWechsel(welche) {
    zustand.art = welche;
    $('#art-zahl').classList.toggle('ist-aktiv', welche === 'zahl');
    $('#art-foto').classList.toggle('ist-aktiv', welche === 'foto');
    $('#art-bereich-zahl').classList.toggle('versteckt', welche !== 'zahl');
    $('#art-bereich-foto').classList.toggle('versteckt', welche !== 'foto');
    schaetzungAktualisieren();
    pruefeBereit();
  }

  /* Die einstellbaren Anteile der vorletzten Stufe. Sechs Ziffern ueber die
   * ganze Breite sind auch bei einem Achtel noch zu lesen; ein Motiv, das
   * klein im Bild steht, ist bei der Haelfte schon verschwunden. Deshalb ein
   * weiter Bereich statt eines gut gemeinten Festwerts. */
  var VORLETZTE_TEILER = [3, 4, 6, 8, 12, 16, 24];

  function vorletzteAnteil() {
    var regler = $('#bild-vorletzte');
    var i = regler ? util.grenze(Number(regler.value), 0, VORLETZTE_TEILER.length - 1) : 3;
    return 1 / VORLETZTE_TEILER[i];
  }

  /* Bild einlesen und in Schärfestufen zerlegen. Gezeigt wird die gröbste
   * Stufe - so sieht man vorher, wie wenig das erste Fragment verrät. */
  async function bildVerarbeiten(ereignis) {
    var datei = ereignis.target.files && ereignis.target.files[0];
    if (!datei) return;
    var ziel = util.leeren($('#bild-ergebnis'));
    ziel.appendChild(el('p', { class: 'flaut', text: 'Bild wird zerlegt ...' }));
    try {
      var stufen = Number($('#bild-stufen').value);
      var ergebnis = await T.foto.stufenBilder(datei, stufen, 1280, vorletzteAnteil());
      ergebnis.datei = datei;
      zustand.bild = ergebnis;
      zustand.laenge = stufen;
      util.leeren(ziel);
      ziel.appendChild(el('div', { class: 'stufenreihe' }, ergebnis.stufen.map(function (stufe, i) {
        var kachel = el('figure', { class: 'stufenbild' + (i === ergebnis.stufen.length - 2 ? ' ist-entscheidend' : ''),
          role: 'button', tabindex: '0',
          title: 'Stufe ' + (i + 1) + ' groß ansehen' }, [
          el('img', { src: stufe.bild, alt: 'Stufe ' + (i + 1) }),
          el('figcaption', { text: (i + 1) + ' · ' + stufe.breite + ' px' })
        ]);
        function oeffnen() { stufeVergroessern(ergebnis.stufen, i); }
        kachel.addEventListener('click', oeffnen);
        kachel.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); oeffnen(); }
        });
        return kachel;
      })));
      ziel.appendChild(el('p', { class: 'flaut klein', text:
        'Antippen zum Prüfen - so groß kommt die Stufe später heraus. Wer auf der vorletzten schon lesen kann, '
        + 'was drauf steht, hat zu nah fotografiert.' }));
      var kilobyte = Math.round(ergebnis.groesse / 1024);
      ziel.appendChild(el('p', { class: 'flaut klein', text:
        'Vollbild ' + ergebnis.vollBreite + ' × ' + ergebnis.vollHoehe + ' px, alle Stufen zusammen rund '
        + kilobyte + ' kB verschlüsselt im Browser-Speicher.' }));
      if (ergebnis.groesse > 3500000) {
        ziel.appendChild(el('p', { class: 'warnung', text: 'Das ist zu groß für den Browser-Speicher. Nimm ein kleineres Bild oder weniger Stufen.' }));
        zustand.bild = null;
      }
      pruefeBereit();
      schaetzungAktualisieren();
    } catch (fehler) {
      util.leeren(ziel).appendChild(el('p', { class: 'warnung', text: 'Bild konnte nicht gelesen werden: ' + fehler.message }));
      zustand.bild = null;
      pruefeBereit();
    }
  }

  /* Lupe: eine Stufe so gross, wie sie spaeter im Tresor erscheint.
   *
   * Ohne das laesst sich vorher nicht beurteilen, ob ein Bild zu frueh
   * lesbar wird - genau die Frage, die bei einem Foto von Text
   * entscheidend ist. Wie viel eine Stufe verraet, haengt daran, wie gross
   * das Motiv im Bild steht, und das weiss nur der Fotograf. */
  function stufeVergroessern(stufen, index) {
    var bild = el('img', { class: 'lupenbild', src: stufen[index].bild, alt: '' });
    var beschriftung = el('p', { class: 'lupentext flaut' });
    var zurueck = el('button', { class: 'knopf', type: 'button', text: '‹ gröber' });
    var weiter = el('button', { class: 'knopf', type: 'button', text: 'schärfer ›' });
    var schliessen = el('button', { class: 'knopf haupt', type: 'button', text: 'Schließen' });

    function zeige(i) {
      index = util.grenze(i, 0, stufen.length - 1);
      bild.src = stufen[index].bild;
      beschriftung.textContent = 'Stufe ' + (index + 1) + ' von ' + stufen.length
        + ' · ' + stufen[index].breite + ' px'
        + (index === stufen.length - 1 ? ' · das ganze Bild'
           : index === stufen.length - 2 ? ' · die letzte Stufe vor der Freigabe' : '');
      zurueck.disabled = index === 0;
      weiter.disabled = index === stufen.length - 1;
    }

    var lupe = el('div', { class: 'lupe' }, [
      el('div', { class: 'lupeninhalt' }, [
        bild,
        beschriftung,
        el('div', { class: 'knopfzeile mittig' }, [zurueck, weiter, schliessen])
      ])
    ]);

    function zu() {
      lupe.remove();
      document.removeEventListener('keydown', beiTaste);
    }
    function beiTaste(e) {
      if (e.key === 'Escape') { zu(); return; }
      if (e.key === 'ArrowLeft') zeige(index - 1);
      if (e.key === 'ArrowRight') zeige(index + 1);
    }
    zurueck.addEventListener('click', function () { zeige(index - 1); });
    weiter.addEventListener('click', function () { zeige(index + 1); });
    schliessen.addEventListener('click', zu);
    lupe.addEventListener('click', function (e) { if (e.target === lupe) zu(); });
    document.addEventListener('keydown', beiTaste);

    zeige(index);
    document.body.appendChild(lupe);
    schliessen.focus();
  }

  function reiterWechsel(welcher) {
    $('#reiter-tippen').classList.toggle('ist-aktiv', welcher === 'tippen');
    $('#reiter-foto').classList.toggle('ist-aktiv', welcher === 'foto');
    $('#eingabe-tippen').classList.toggle('versteckt', welcher !== 'tippen');
    $('#eingabe-foto').classList.toggle('versteckt', welcher !== 'foto');
  }

  async function fotoVerarbeiten(ereignis) {
    var datei = ereignis.target.files && ereignis.target.files[0];
    if (!datei) return;
    var ziel = util.leeren($('#foto-ergebnis'));
    ziel.appendChild(el('p', { class: 'flaut', text: 'Bild wird gelesen ...' }));
    try {
      var ergebnis = await T.foto.lesen(datei, zustand.laenge);
      util.leeren(ziel);
      ziel.appendChild(el('img', { src: ergebnis.vorschau, class: 'fotovorschau', alt: 'Vorschau des Fotos' }));
      if (!ergebnis.ziffern.length) {
        ziel.appendChild(el('p', { class: 'warnung', text: 'Keine Ziffernzeile gefunden. Tippe die Zahl bitte von Hand ein.' }));
        return;
      }
      var zeile = el('div', { class: 'zifferzeile' });
      ergebnis.ziffern.forEach(function (treffer, i) {
        var feld = el('input', {
          type: 'text', inputmode: 'numeric', maxlength: '1',
          class: 'zifferfeld' + (treffer.sicherheit < 0.55 ? ' ist-unsicher' : ''),
          value: treffer.zeichen === '?' ? '' : treffer.zeichen
        });
        feld.dataset.index = String(i);
        zeile.appendChild(el('div', { class: 'fotoziffer' }, [
          el('img', { src: treffer.bild, alt: 'Erkannter Ausschnitt ' + (i + 1) }),
          feld
        ]));
      });
      ziel.appendChild(zeile);
      ziel.appendChild(el('p', { class: 'flaut klein', text: 'Rot umrandete Ziffern waren unsicher. Korrigiere, was nicht stimmt.' }));
      var uebernehmen = el('button', { class: 'knopf', type: 'button', text: 'Als Geheimnis übernehmen' });
      ziel.appendChild(uebernehmen);
      uebernehmen.addEventListener('click', function () {
        var werte = util.$$('input', zeile).map(function (f) { return f.value.replace(/\D/g, ''); });
        var zahl = werte.join('');
        if (zahl.length !== zustand.laenge) {
          ziel.appendChild(el('p', { class: 'warnung', text: 'Es fehlen Ziffern - bitte alle ' + zustand.laenge + ' Felder füllen.' }));
          return;
        }
        zustand.geheimnis = zahl;
        ziffernFelder($('#ziffernfelder'));
        reiterWechsel('tippen');
        pruefeBereit();
      });
    } catch (fehler) {
      util.leeren(ziel).appendChild(el('p', { class: 'warnung', text: 'Bild konnte nicht gelesen werden: ' + fehler.message }));
    }
  }

  async function verriegeln() {
    var konfig = konfigurationLesen();
    // vor dem Leeren der Bühne auslesen - danach gibt es die Felder nicht mehr
    var passphrase = konfig.mitPassphrase ? $('#passphrase').value : '';
    var art = zustand.art;
    var teile = art === 'foto'
      ? zustand.bild.stufen.map(function (stufe) { return stufe.bild; })
      : zustand.geheimnis.split('');
    var wurzel = util.leeren($('#buehne'));
    var kasten = el('section', { class: 'karte mittig' }, [
      el('h2', { text: 'Wird verriegelt' }),
      el('p', { class: 'flaut', id: 'schmiede-text', text: 'Einen Moment ...' }),
      el('div', { class: 'balken' }, [el('i', { id: 'schmiede-balken' })])
    ]);
    wurzel.appendChild(kasten);
    /* Die Stationsgeheimnisse gehen nur durch den Aufgabenplan, nie in die
     * Konfiguration - die landet im Speicher, sie sind der Schlüssel. */
    T.ortAufgaben.vorratSetzen(zustand.stationen || []);
    try {
      var tresor = await T.tresorLogik.erstellen({
        art: art,
        teile: teile,
        konfig: konfig,
        passphrase: passphrase,
        beiFortschritt: function (m) {
          $('#schmiede-text').textContent = m.text;
          if (typeof m.anteil === 'number') $('#schmiede-balken').style.width = (m.anteil * 100) + '%';
        }
      });
      T.ortAufgaben.vorratLeeren();
      zustand.stationen = [];
      zustand.geheimnis = '';
      zustand.bild = null;
      teile = null;
      if (passphrase) {
        zustand.passMaterial = await T.tresorLogik.passphraseMaterial(tresor, passphrase);
        passphrase = null;
      }
      zustand.tresor = tresor;
      if (!T.speicher.sichern(tresor)) {
        util.leeren(kasten).appendChild(el('p', { class: 'warnung', text:
          'Der Tresor passt nicht in den Browser-Speicher. Nimm ein kleineres Bild oder weniger Stufen.' }));
        zustand.tresor = null;
        return;
      }
      zeichneTresor();
    } catch (fehler) {
      util.leeren(kasten).appendChild(el('p', { class: 'warnung', text: 'Verriegeln fehlgeschlagen: ' + fehler.message }));
    }
  }

  /* ---------------- Tresoransicht ---------------- */

  function zeichneBildbuehne(tresor) {
    var beste = T.tresorLogik.besteStufe(tresor);
    return el('div', { class: 'bildbuehne' }, [
      beste
        ? el('img', { class: 'stufenbild-gross', src: beste.bild, alt: 'Freigegebene Schärfestufe' })
        : el('div', { class: 'bildplatzhalter', text: '▦' }),
      el('p', { class: 'flaut mittig-text', text: beste
        ? 'Stufe ' + beste.stufe + ' von ' + tresor.laenge + ' freigegeben'
        : 'Noch keine Stufe frei' })
    ]);
  }

  function zeichneZiffernband() {
    var sichtbar = T.tresorLogik.sichtbaresGeheimnis(zustand.tresor);
    return el('div', { class: 'ziffernband' }, sichtbar.map(function (zeichen, i) {
      return el('div', { class: 'bandziffer' + (zeichen === null ? ' ist-zu' : ' ist-offen') },
        zeichen === null ? '▦' : zeichen);
    }));
  }

  function fragmentUebersicht() {
    var tresor = zustand.tresor;
    var aktuell = T.tresorLogik.aktuellesFragment(tresor);
    return el('ol', { class: 'fragmentliste' }, tresor.fragmente.map(function (fragment) {
      var offeneAufgaben = fragment.aufgaben.filter(function (a) { return !a.erledigt; }).length;
      /* Am Netz gibt es kein "aktuelles" Fragment: Alle laufen parallel. */
      var status = fragment.offen ? 'frei'
        : fragment.drand ? (offeneAufgaben ? offeneAufgaben + (offeneAufgaben === 1 ? ' Prüfung offen' : ' Prüfungen offen')
            : 'abgelegt, wartet auf die Zeit')
        : fragment === aktuell ? (offeneAufgaben ? offeneAufgaben + ' Aufgaben offen' : 'Bann läuft')
          : 'verriegelt';
      return el('li', {
        class: 'fragment' + (fragment.offen ? ' ist-offen'
          : (fragment === aktuell && !fragment.drand) ? ' ist-aktuell' : '')
      }, [
        el('div', { class: 'fragment-kopf' }, [
          el('strong', { text: 'Fragment ' + (fragment.index + 1) }),
          el('span', { class: 'status', text: status })
        ]),
        el('ul', { class: 'aufgabenliste' }, fragment.aufgaben.map(function (aufgabe) {
          var modul = T.herausforderungen.hole(aufgabe.id);
          return el('li', { class: aufgabe.erledigt ? 'ist-erledigt' : '' }, [
            el('span', { class: 'marke marke-' + aufgabe.dimension, text: dimensionName(aufgabe.dimension) }),
            /* Text und Freischaltzeit in einem Block: Die Zeit steht darunter,
             * statt als schmale Spalte neben dem Text zu klemmen. */
            el('span', { class: 'aufgabentext' }, [
              modul.name + ': ' + modul.beschreibe(aufgabe.params)
                + (aufgabe.zustand && aufgabe.zustand.kapituliert ? ' - aufgegeben' : ''),
              !aufgabe.erledigt && aufgabe.frei && aufgabe.frei > Date.now()
                ? el('span', { class: 'freischaltung', text: 'kommt ' + util.zeitpunkt(aufgabe.frei) }) : null
            ]),
            modul.antwortGebunden ? el('span', { class: 'schluesselmarke', title: 'Antwort geht in den Schlüssel ein', text: ' 🔑' }) : null,
            aufgabe.frist ? el('span', { class: 'schluesselmarke', title: 'Geheime Frist', text: ' ⏳' }) : null
          ]);
        }).concat(fragment.schloss ? [
          el('li', { class: fragment.offen ? 'ist-erledigt' : '' }, [
            el('span', { class: 'marke marke-zeit', text: 'Zeit' }),
            'Bann: ' + util.dauer(zustand.tresor.sekundenProSchloss)
          ])
        ] : []))
      ]);
    }));
  }

  function zeichneTresor() {
    aufraeumen();
    var tresor = zustand.tresor;

    // Läuft eine tresorweite Höchstzeit ab - auch bei geschlossener App?
    if (T.tresorLogik.fristAbgelaufen(tresor)) {
      var bericht = T.tresorLogik.fristAusloesen(tresor);
      zustand.fristMeldung = T.stimme.sag('fristAus') + ' '
        + bericht.fragmente + (bericht.fragmente === 1 ? ' verschlossenes Fragment fällt' : ' verschlossene Fragmente fallen')
        + ' auf Anfang zurück'
        + (bericht.aufgaben ? ' (' + bericht.aufgaben + ' erledigte Aufgaben)' : '')
        + (bericht.rechenzeitVerfallen && bericht.schritte
            ? ', dazu verfallen ' + bericht.schritte.toLocaleString('de-DE') + ' Rechenschritte' : '')
        + '. Eine neue Frist läuft ab jetzt.';
      sichern(true);
    }

    var wurzel = util.leeren($('#buehne'));
    var fertig = T.tresorLogik.alleOffen(tresor);

    if (zustand.fristMeldung) {
      wurzel.appendChild(el('section', { class: 'karte' }, [
        el('p', { class: 'warnung', text: zustand.fristMeldung })
      ]));
      zustand.fristMeldung = null;
    }

    wurzel.appendChild(el('section', { class: 'karte band-karte' }, [
      tresor.art === 'foto' ? zeichneBildbuehne(tresor) : zeichneZiffernband(),
      el('p', { class: 'flaut mittig-text', text: bandText(tresor) })
    ]));

    if (!fertig && tresor.freigabe) wurzel.appendChild(freigabeKarte(tresor));

    if (fertig) {
      // Ergebnis in den Verlauf legen, bevor irgendetwas es überschreiben kann
      if (!tresor.archiviert) {
        tresor.archiviert = T.speicher.archivErgaenzen(T.tresorLogik.archivEintrag(tresor));
        sichern(true);
      }
      var bild = tresor.art === 'foto' ? (T.tresorLogik.besteStufe(tresor) || {}).bild : null;
      wurzel.appendChild(el('section', { class: 'karte mittig' }, [
        el('p', { class: 'wachterwort gross', text: T.stimme.sag((tresor.notausgang && tresor.notausgang.benutzt) ? 'notausgang' : 'sieg') }),
        el('h2', { text: 'Dein Geheimnis' }),
        bild
          ? el('img', { class: 'ergebnisbild', src: bild, alt: 'Das freigegebene Bild' })
          : el('p', { class: 'grossezahl', text: T.tresorLogik.sichtbaresGeheimnis(tresor).join('') }),
        bild ? el('a', { class: 'knopf', href: bild, download: 'tresor-bild.jpg' }, 'Bild sichern') : null,
        el('p', { class: 'flaut', text: 'Erstellt ' + util.zeitpunkt(tresor.erstellt) + '. Das Ergebnis liegt jetzt auch im Verlauf.' }),
        el('button', { class: 'knopf gross', type: 'button', text: 'Neuen Tresor anlegen', onclick: neuAnlegen })
      ]));
    } else if (T.tresorLogik.brauchtPassphrase(tresor) && !zustand.passMaterial) {
      wurzel.appendChild(passphraseKarte());
    } else {
      var aufgabenKarte = el('section', { class: 'karte aufgabenkarte', id: 'aufgabenkarte' });
      wurzel.appendChild(aufgabenKarte);
      starteAktuelles(aufgabenKarte);
    }

    if (!fertig && tresor.frist && tresor.frist.sekunden) {
      var rahmen = tresor.frist.rahmen || [tresor.frist.sekunden, tresor.frist.sekunden];
      var verstrichen = el('strong', { class: 'fristzeit', text: '–' });
      wurzel.appendChild(el('section', { class: 'karte frist-karte' }, [
        el('h2', { text: '⏳ Geheime Höchstzeit' }),
        el('p', { class: 'flaut', text: 'Irgendwo zwischen ' + util.dauer(rahmen[0]) + ' und ' + util.dauer(rahmen[1])
          + ' – gezogen beim Verriegeln, nicht angezeigt. Die Uhr läuft auch bei geschlossener App.' }),
        el('p', {}, ['verstrichen: ', verstrichen]),
        el('p', { class: 'flaut klein', text: 'Bei Ablauf fallen alle noch verschlossenen Fragmente auf Anfang zurück'
          + ((tresor.konfig.geheimeFrist || {}).folge === 'alles' ? ' und die bereits geleistete Rechenzeit verfällt' : '')
          + '. Geöffnete Ziffern bleiben offen.'
          + (tresor.frist.abgelaufen ? ' Bisher abgelaufen: ' + tresor.frist.abgelaufen + '×.' : '') })
      ]));
      zustand.fristUhr = setInterval(function () {
        if (T.tresorLogik.fristAbgelaufen(tresor)) { zeichneTresor(); return; }
        verstrichen.textContent = util.dauer((Date.now() - tresor.frist.start) / 1000);
      }, 1000);
      verstrichen.textContent = util.dauer((Date.now() - tresor.frist.start) / 1000);
    }

    if (!fertig && (tresor.konfig || {}).erinnerungen && !T.erinnerung.erlaubt()) {
      var erlaubnisKarte = el('section', { class: 'karte' }, [
        el('p', { class: 'flaut klein', text: T.erinnerung.offen()
          ? 'Dieser Tresor soll dich erinnern, aber der Browser hat noch nicht zugestimmt.'
          : 'Dieser Tresor soll dich erinnern, doch der Browser lässt keine Benachrichtigungen zu. '
            + 'Das lässt sich in den Einstellungen dieser Seite ändern.' })
      ]);
      if (T.erinnerung.offen()) {
        erlaubnisKarte.appendChild(el('button', { class: 'knopf', type: 'button', text: 'Erinnerungen erlauben',
          onclick: async function () { await T.erinnerung.erlaubnisHolen(); zeichneTresor(); } }));
      }
      wurzel.appendChild(erlaubnisKarte);
    }

    if (!fertig && tresor.notausgang && !tresor.notausgang.benutzt) {
      wurzel.appendChild(notausgangKarte(tresor));
      exitAnzeigeAktualisieren();          // erst jetzt hängt die Karte im Dokument
    }

    /* Unter Willkür gibt es keinen Fahrplan - auch keine leere Karte,
     * die daran erinnert. Was es nicht gibt, soll auch keinen Platz belegen. */
    if (!imDunkeln()) {
      wurzel.appendChild(el('section', { class: 'karte' }, [
        el('h2', { text: 'Fahrplan' }),
        fragmentUebersicht()
      ]));
    }

    /* Verlauf, Sicherung, Löschen und das Innenleben sind Verwaltung. Sie
     * müssen erreichbar sein, aber sie gehören nicht in den Weg: Auf dem
     * Bildschirm, auf dem man eine Prüfung ablegt, ist jede Karte, die nichts
     * mit ihr zu tun hat, Lärm. Deshalb eine einzige zugeklappte Lade. */
    var gebunden = gebundeneAufgaben(tresor);
    var lade = el('details', { class: 'verwaltung' });
    lade.appendChild(el('summary', { text: 'Verwaltung' }));

    lade.appendChild(el('section', { class: 'karte flaut klein' }, [
      el('p', { text: tresor.freigabe
        ? 'Fern. Das Netz hält ihn. Vor der Zeit öffnet ihn niemand - du nicht, eine verstellte Uhr nicht.'
        : tresor.fragmente[0].schloss
        ? 'Eisern. Jedes Fragment liegt unter einem Bann, den nur Zeit bricht.'
        : 'Nachsichtig. Es hält dich nichts als dein eigener Vorsatz.' }),
      el('p', { text: gebunden
        ? gebunden + (gebunden === 1 ? ' Prüfung hält' : ' Prüfungen halten') + ' ein Stück des Schlüssels. Raten kostet.'
        : 'Keine Prüfung hält den Schlüssel. Du hältst dich selbst auf.' }),
      T.tresorLogik.brauchtPassphrase(tresor)
        ? el('p', { text: 'Dazu die Passphrase. Ohne sie: nichts. Auch nicht der Notausgang.' })
        : null,
      technikZeile(
        (tresor.freigabe
          ? 'Zeitschloss: drand quicknet, tlock (identitätsbasierte Verschlüsselung auf BLS12-381). '
            + tresor.freigabe.leiter.length + ' Sprossen von ' + util.dauer(tresor.freigabe.leiter[0]) + ' bis '
            + util.dauer(tresor.freigabe.deckel) + ' nach dem Verriegeln; der Zeitschlüssel wird erst beim Netz abgeholt. '
          : tresor.fragmente[0].schloss
          ? 'Zeitschlösser: ' + tresor.fragmente[0].schloss.t.toLocaleString('de-DE')
            + ' sequentielle Quadrierungen modulo einer 1024-Bit-Zahl, gemessen mit '
            + (tresor.rate || 0).toLocaleString('de-DE') + ' Quadrierungen/s auf diesem Gerät. '
          : 'Ohne Zeitschloss liegen die Schlüsselanteile offen im Browser-Speicher. ')
        + (gebunden
          ? gebunden + ' Aufgaben sind an den Schlüssel gebunden: gespeichert ist nur ein Prüfwert mit '
            + (tresor.fragmente[0].iterationen || 0).toLocaleString('de-DE') + ' PBKDF2-Runden. '
          : '')
        + (T.tresorLogik.brauchtPassphrase(tresor)
          ? 'Die Passphrase geht über PBKDF2 in jeden Fragmentschlüssel und in den Notausgang ein und liegt nirgends - auch nicht in einer Sicherung. '
          : '')
        + 'Fragmente sind einzeln AES-256-GCM-verschlüsselt.'),
      el('button', { class: 'knopf gefahr', type: 'button', text: 'Tresor löschen', onclick: tresorLoeschen })
    ]));

    lade.appendChild(sicherungsKarte());
    var verlauf = verlaufKarte();
    if (verlauf) lade.appendChild(verlauf);
    wurzel.appendChild(lade);
  }

  /* Am Netz gehen die Fragmente nicht einzeln auf, sondern alle zur Freigabe.
   * "0 von 5 frei" sah dort nach Stillstand aus - also sagt das Band, was
   * schon geschafft ist und worauf es wartet. */
  function bandText(tresor) {
    var offen = tresor.fragmente.filter(function (f) { return f.offen; }).length;
    var text = offen + ' von ' + tresor.laenge + ' Fragmenten frei';
    if (!tresor.freigabe || tresor.freigabe.z || offen === tresor.laenge) return text;
    var abgelegt = tresor.fragmente.filter(function (f) {
      return !f.offen && f.aufgaben.every(function (a) { return a.erledigt; });
    }).length;
    return (abgelegt ? abgelegt + ' von ' + tresor.laenge + ' abgelegt' : text)
      + ' · die Ziffern kommen alle zur Freigabe';
  }

  /* Wie lange der Notausgang dauert - bei blinden Schlössern ist das
   * absichtlich eine Spanne und keine Zahl. */
  function notausgangSpanne(exit) {
    var rahmen = exit.rahmen || [0, 0];
    var einheit = exit.art === 'wartezeit' ? ' Wartezeit' : exit.art === 'drand' ? '' : ' Rechenzeit';
    var modus = exit.modus || (exit.blind ? 'geheim' : 'fest');

    if (modus === 'fest') {
      return 'Genau ' + util.dauer(exit.sekunden) + einheit + '.';
    }
    if (modus === 'zufall') {
      return util.dauer(exit.sekunden) + einheit + ' – gezogen aus '
        + util.dauer(rahmen[0]) + ' bis ' + util.dauer(rahmen[1]) + '.';
    }
    /* Geheim: Die Spanne hat der Spieler selbst gesetzt, die darf er wissen.
     * Den gezogenen Wert nicht. */
    return 'Irgendwo zwischen ' + util.dauer(rahmen[0]) + ' und ' + util.dauer(rahmen[1])
      + einheit + '. Wo genau, sage ich nicht.';
  }

  function dimensionName(id) {
    var treffer = T.herausforderungen.dimensionen.filter(function (d) { return d.id === id; })[0];
    return treffer ? treffer.name : id;
  }

  function gebundeneAufgaben(tresor) {
    return tresor.fragmente.reduce(function (summe, fragment) {
      return summe + fragment.aufgaben.filter(function (a) { return !!a.pruefung; }).length;
    }, 0);
  }

  /* ---------------- Notausgang ----------------
   *
   * Er läuft im Hintergrund weiter, egal welche Aufgabe gerade angezeigt wird,
   * und nimmt seinen Lauf nach einem Neuladen von selbst wieder auf. Anhalten
   * geht jederzeit; der Zwischenstand bleibt erhalten. */

  function notausgangLaeuft() { return !!zustand.exitLoeser; }

  function notausgangStarten() {
    var tresor = zustand.tresor;
    var exit = tresor && tresor.notausgang;
    if (!exit || exit.benutzt || exit.art === 'wartezeit' || exit.art === 'drand' || zustand.exitLoeser) return;
    exit.mitlaufen = true;
    zustand.exitStart = { zeit: Date.now(), schritte: exit.stand.erledigt };
    zustand.exitLoeser = new T.zeitschloss.Loeser(exit.schloss, exit.stand, function (stand) {
      exit.stand.erledigt = stand.erledigt;
      exit.stand.x = stand.x;
      exitAnzeigeAktualisieren();
      sichern(false);
    });
    if (wachWunschLaden()) bildschirmWachHalten(true);
    zustand.exitLoeser.starten().then(function (b) {
      zustand.exitLoeser = null;
      if (!b) { exitAnzeigeAktualisieren(); sichern(true); return; }
      return T.tresorLogik.notausgangOeffnen(tresor, b, zustand.passMaterial).then(function () {
        exit.mitlaufen = false;
        sichern(true);
        zeichneTresor();
      });
    }).catch(function (fehler) {
      zustand.exitLoeser = null;
      exit.mitlaufen = false;
      sichern(true);
      global.alert('Notausgang: Rechenfehler – ' + fehler.message);
    });
    sichern(true);
    exitAnzeigeAktualisieren();
  }

  function notausgangAnhalten() {
    var exit = zustand.tresor && zustand.tresor.notausgang;
    if (exit) exit.mitlaufen = false;
    if (zustand.exitLoeser) { zustand.exitLoeser.anhalten(); zustand.exitLoeser = null; }
    bildschirmWachHalten(false);
    sichern(true);
    exitAnzeigeAktualisieren();
  }

  /* Hält die sichtbare Notausgang-Karte aktuell, ohne sie zu besitzen: Ist
   * gerade eine andere Ansicht offen, passiert schlicht nichts. */
  function exitAnzeigeAktualisieren() {
    var teile = zustand.exitAnzeige;
    var tresor = zustand.tresor;
    if (!teile || !tresor || !tresor.notausgang) return;
    // Noch nicht (oder nicht mehr) im Dokument: dann gibt es nichts zu malen.
    // Die Bezüge bleiben stehen, der nächste Aufruf trifft die fertige Karte.
    if (!teile.wurzel.isConnected) return;
    if (imDunkeln()) { exitKnopfAktualisieren(teile, tresor); return; }
    var exit = tresor.notausgang;
    var erledigt = exit.stand.erledigt;
    var ziel = exit.schloss.t || 0;                       // 0 = blind, Ziel unbekannt
    var obergrenze = exit.schloss.obergrenze || ziel || 1;
    var untergrenze = exit.schloss.untergrenze || 0;
    var rate = tresor.rate || 1;
    teile.fuellung.style.width = (Math.min(1, erledigt / obergrenze) * 100).toFixed(2) + '%';
    if (ziel) {
      // bekannte Dauer: Restzeit und Prozent sind ehrlich anzeigbar
      teile.anzeige.textContent = util.uhrwerk(Math.max(0, (ziel - erledigt) / rate));
      teile.text.textContent = erledigt.toLocaleString('de-DE') + ' von ' + ziel.toLocaleString('de-DE')
        + ' Schritten · ' + (erledigt / ziel * 100).toFixed(1) + ' %';
    } else {
      teile.anzeige.textContent = util.dauer(erledigt / rate);
      teile.text.textContent = erledigt.toLocaleString('de-DE') + ' Schritte · '
        + (untergrenze && erledigt < untergrenze
            ? 'frühestens ab ' + util.dauer(untergrenze / rate) + ' kann es aufspringen'
            : 'kann jederzeit aufspringen');
    }
    exitKnopfAktualisieren(teile, tresor);
  }

  function exitKnopfAktualisieren(teile) {
    if (teile.mahlwerk) mahlwerkSchlag(teile.mahlwerk, notausgangLaeuft());
    teile.knopf.textContent = notausgangLaeuft() ? 'Anhalten' : 'Ausgang freirechnen';
    teile.zustandstext.textContent = notausgangLaeuft()
      ? (imDunkeln() ? 'Läuft. Im Hintergrund, solange diese Seite offen ist.'
                     : 'Läuft im Hintergrund – auch während du an den Aufgaben arbeitest, solange diese Seite offen bleibt.')
      : 'Angehalten. Der Stand bleibt.';
  }

  /* Die Karte auf dem Tresor-Bildschirm. Sie steuert den Notausgang, hält ihn
   * aber nicht am Leben - das tut der Löser selbst. */
  function notausgangKarte(tresor) {
    var exit = tresor.notausgang;
    if (T.tresorLogik.notausgangUhrPruefen(tresor)) sichern(true);
    var karte = el('section', { class: 'karte notausgang-karte' }, [
      el('h2', { text: 'Notausgang' }),
      el('p', { class: 'flaut', text: imDunkeln()
        ? 'Der Weg für die, die es nicht schaffen. ' + notausgangSpanne(exit)
        : 'Der zweite Weg zum ganzen Geheimnis. ' + notausgangSpanne(exit) })
    ]);

    if (exit.art === 'drand') return notausgangNetzKarte(tresor, karte);

    if (exit.art === 'wartezeit') {
      var bereit = T.tresorLogik.notausgangBereit(tresor);
      var geheim = (exit.modus || 'geheim') === 'geheim';
      var verstrichen = el('strong', { class: 'fristzeit',
        text: geheim ? util.dauer((Date.now() - tresor.erstellt) / 1000)
                     : util.dauer(Math.max(0, (exit.frei - Date.now()) / 1000)) });
      if (!imDunkeln()) {
        karte.appendChild(el('p', {}, [geheim ? 'verstrichen: ' : 'noch: ', verstrichen]));
        if (!geheim && !bereit) {
          karte.appendChild(el('p', { class: 'flaut klein', text: 'Offen ab ' + util.zeitpunkt(exit.frei) + '.' }));
        }
      }
      var oeffnen = el('button', { class: 'knopf gross' + (bereit ? ' haupt' : ''), type: 'button', text: 'Geheimnis freigeben' });
      oeffnen.disabled = !bereit;
      oeffnen.addEventListener('click', function () {
        if (oeffnen.disabled) return;
        oeffnen.disabled = true;
        T.tresorLogik.notausgangOeffnen(tresor, null, zustand.passMaterial).then(function () {
          sichern(true);
          zeichneTresor();
        }).catch(function (fehler) {
          karte.appendChild(el('p', { class: 'warnung', text: 'Entschlüsseln fehlgeschlagen: ' + fehler.message }));
        });
      });
      karte.appendChild(oeffnen);
      karte.appendChild(el('p', { class: 'flaut klein', text: bereit
        ? 'Offen.'
        : imDunkeln() ? 'Zu. Frag nicht, wie lange noch.'
        : 'Noch zu. Die Uhr läuft weiter, auch bei geschlossener App.' }));
      if (!bereit) {
        zustand.exitUhr = setInterval(function () {
          if (T.tresorLogik.notausgangBereit(tresor)) { zeichneTresor(); return; }
          verstrichen.textContent = geheim
            ? util.dauer((Date.now() - tresor.erstellt) / 1000)
            : util.dauer(Math.max(0, (exit.frei - Date.now()) / 1000));
        }, 1000);
      }
      return karte;
    }

    var anzeige = el('div', { class: 'countdown', text: '–' });
    var fuellung = el('i');
    var balken = el('div', { class: 'balken' }, [fuellung]);
    var untergrenze = exit.schloss.untergrenze || 0;
    var obergrenze = exit.schloss.obergrenze || exit.schloss.t || 1;
    if (untergrenze && untergrenze < obergrenze) {
      balken.appendChild(el('span', { class: 'balken-marke',
        style: 'left:' + (untergrenze / obergrenze * 100).toFixed(1) + '%' }));
    }
    var text = el('span', { class: 'balken-text', text: '' });
    var knopf = el('button', { class: 'knopf', type: 'button', text: 'Ausgang freirechnen' });
    var zustandstext = el('p', { class: 'flaut klein', text: '' });
    knopf.addEventListener('click', function () {
      if (notausgangLaeuft()) notausgangAnhalten(); else notausgangStarten();
    });

    var exitMahlwerk = null;
    if (imDunkeln()) {
      exitMahlwerk = el('div', { class: 'mahlwerk ist-still' });
      karte.appendChild(exitMahlwerk);
    } else {
      karte.appendChild(el('p', { class: 'flaut klein',
        text: exit.schloss.t ? 'verbleibende Rechenzeit' : 'bisher gerechnet' }));
      karte.appendChild(anzeige);
      karte.appendChild(balken);
      karte.appendChild(text);
    }
    karte.appendChild(knopf);
    var schalter = wachSchalter();
    if (schalter) karte.appendChild(schalter);
    karte.appendChild(zustandstext);

    zustand.exitAnzeige = { wurzel: karte, anzeige: anzeige, fuellung: fuellung, text: text,
      knopf: knopf, zustandstext: zustandstext, mahlwerk: exitMahlwerk };
    return karte;
  }


  /* Passphrase-Schloss: ohne sie geht in diesem Tresor gar nichts - weder
   * Aufgaben noch Notausgang. Gemerkt wird nur das abgeleitete Material, und
   * nur im Arbeitsspeicher dieser Sitzung. */
  function passphraseKarte() {
    var karte = el('section', { class: 'karte aufgabenkarte' }, [
      el('p', { class: 'aufgabe-titel', text: 'Passphrase' }),
      el('p', { class: 'aufgabe-hinweis', text:
        'Ohne die Passphrase geht hier gar nichts. Weder Prüfungen noch Zeit noch der Notausgang.' })
    ]);
    var feld = el('input', { type: 'password', class: 'antwortfeld', autocomplete: 'current-password',
      placeholder: 'Passphrase' });
    var knopf = el('button', { class: 'knopf haupt', type: 'button', text: 'Aufschließen' });
    var meldung = el('p', { class: 'aufgabe-meldung', text: '' });
    karte.appendChild(el('div', { class: 'antwortzeile' }, [feld, knopf]));
    karte.appendChild(meldung);
    karte.appendChild(el('p', { class: 'flaut klein', text:
      'Nur für diese Sitzung gemerkt - nach einem Neuladen fragt der Tresor wieder.' }));

    async function pruefen() {
      if (!feld.value) return;
      knopf.disabled = true;
      meldung.className = 'aufgabe-meldung';
      meldung.textContent = 'wird geprüft ...';
      var richtig = await T.tresorLogik.passphrasePruefen(zustand.tresor, feld.value);
      if (!richtig) {
        knopf.disabled = false;
        meldung.className = 'aufgabe-meldung ist-fehler';
        meldung.textContent = 'Das war sie nicht.';
        feld.select();
        return;
      }
      zustand.passMaterial = await T.tresorLogik.passphraseMaterial(zustand.tresor, feld.value);
      feld.value = '';
      zeichneTresor();
    }
    knopf.addEventListener('click', pruefen);
    feld.addEventListener('keydown', function (e) { if (e.key === 'Enter') pruefen(); });
    setTimeout(function () { feld.focus(); }, 50);
    return karte;
  }

  /* ---------------- Sicherung ----------------
   *
   * Ein Tresor lebt sonst ausschließlich im Browser-Speicher dieses Geräts:
   * Cache geleert, Browser gewechselt, Handy verloren - Geheimnis weg. Die
   * Sicherung ist eine wortgetreue Kopie, kein neuer Tresor: Aufgaben,
   * Parameter, Rechenfortschritt und Fristen kommen mit, beim Einlesen wird
   * nichts neu gewählt. */

  function dateiAusgeben(name, text) {
    var blob = new Blob([text], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var verweis = el('a', { href: url, download: name });
    document.body.appendChild(verweis);
    verweis.click();
    setTimeout(function () { URL.revokeObjectURL(url); verweis.remove(); }, 2000);
  }

  function sicherungsKarte() {
    var tresor = zustand.tresor;
    var karte = el('section', { class: 'karte' }, [el('h2', { text: 'Sicherung' })]);

    if (tresor) {
      var offen = tresor.fragmente.filter(function (f) { return f.offen; }).length;
      karte.appendChild(el('p', { class: 'flaut klein', text:
        'Eine Kopie als Datei - Prüfungen, Bannzustand, laufende Fristen. Auf einem anderen Gerät machst du dort weiter.'
        + (T.tresorLogik.brauchtPassphrase(tresor)
            ? ' Die Passphrase steckt nicht in der Datei - ohne sie ist auch die Sicherung wertlos.' : '') }));
      if (offen) {
        karte.appendChild(el('p', { class: 'warnung', text:
          'Achtung: ' + offen + (offen === 1 ? ' Fragment ist' : ' Fragmente sind') + ' bereits offen und '
          + (offen === 1 ? 'steht' : 'stehen') + ' im Klartext in der Datei. Ohne Passphrase ist die Sicherung '
          + 'nur so sicher wie ihr Ablageort.' }));
      }
      var feldAus = el('input', { type: 'password', class: 'antwortfeld', autocomplete: 'new-password',
        placeholder: 'Passphrase (empfohlen)' });
      var verlaufMit = el('input', { type: 'checkbox' });
      var knopfAus = el('button', { class: 'knopf', type: 'button', text: 'Sichern' });
      karte.appendChild(el('div', { class: 'antwortzeile' }, [feldAus, knopfAus]));
      karte.appendChild(el('label', { class: 'schalterzeile klein' }, [
        verlaufMit, el('span', { class: 'flaut', text: 'Verlauf mitsichern (enthält geöffnete Geheimnisse)' })
      ]));
      var meldungAus = el('p', { class: 'flaut klein', text: '' });
      karte.appendChild(meldungAus);

      knopfAus.addEventListener('click', async function () {
        knopfAus.disabled = true;
        meldungAus.textContent = 'Sicherung wird erstellt ...';
        try {
          var text = await T.sicherung.exportieren({
            tresor: tresor,
            passphrase: feldAus.value,
            mitVerlauf: verlaufMit.checked
          });
          var datum = new Date();
          var stempel = datum.getFullYear() + '-' + String(datum.getMonth() + 1).padStart(2, '0')
            + '-' + String(datum.getDate()).padStart(2, '0');
          dateiAusgeben('tresor-' + stempel + '.json', text);
          meldungAus.textContent = feldAus.value
            ? 'Gesichert und mit deiner Passphrase verschlüsselt. Ohne sie ist die Datei wertlos - auch für dich.'
            : 'Gesichert - unverschlüsselt. Leg die Datei entsprechend ab.';
          meldungAus.className = 'flaut klein';
        } catch (fehler) {
          meldungAus.textContent = 'Fehlgeschlagen: ' + fehler.message;
          meldungAus.className = 'warnung';
        }
        knopfAus.disabled = false;
      });
      karte.appendChild(el('hr', { class: 'trenner' }));
    }

    karte.appendChild(el('p', { class: 'flaut klein', text: tresor
      ? 'Eine andere Sicherung einlesen? Sie ersetzt den Tresor, der gerade hier liegt.'
      : 'Sicherung einlesen und dort weitermachen, wo du aufgehört hast.' }));
    var datei = el('input', { type: 'file', accept: '.json,application/json' });
    var feldEin = el('input', { type: 'password', class: 'antwortfeld', autocomplete: 'current-password',
      placeholder: 'Passphrase, falls verschlüsselt' });
    var knopfEin = el('button', { class: 'knopf', type: 'button', text: 'Einlesen' });
    var meldungEin = el('p', { class: 'flaut klein', text: '' });
    karte.appendChild(datei);
    karte.appendChild(el('div', { class: 'antwortzeile' }, [feldEin, knopfEin]));
    karte.appendChild(meldungEin);

    knopfEin.addEventListener('click', async function () {
      var auswahl = datei.files && datei.files[0];
      if (!auswahl) { meldungEin.textContent = 'Erst eine Datei auswählen.'; meldungEin.className = 'warnung'; return; }
      knopfEin.disabled = true;
      meldungEin.className = 'flaut klein';
      meldungEin.textContent = 'Datei wird gelesen ...';
      try {
        var ergebnis = await T.sicherung.importieren(await auswahl.text(), feldEin.value);
        var frage = 'Diese Sicherung einlesen?\n\n' + T.sicherung.beschreibung(ergebnis.tresor)
          + (zustand.tresor ? '\n\nDer Tresor, der gerade auf diesem Gerät liegt, wird dabei ersetzt.' : '');

        /* Offene Sensoraufgaben auf einem Gerät ohne Sensoren? Dann vorher
         * sagen, was das kostet. Gefragt wird ohne Freigabedialog: Die Geste
         * des Klicks ist nach dem Entschlüsseln längst verfallen, und ein
         * noch nicht gefragtes iPhone ist kein Grund zur Warnung. */
        if (T.sensoren && offeneSensorAufgaben(ergebnis.tresor)) {
          meldungEin.textContent = 'Sensor dieses Geräts prüfen ...';
          var lage = await T.sensoren.lage({ freigeben: false, frisch: true });
          if (!lage.ok && lage.grund !== 'freigabe') {
            frage += '\n\nAchtung: Dieser Tresor enthält noch Sensoraufgaben. '
              + T.sensoren.grundText(lage.grund)
              + ' Für jede dieser Aufgaben bleibt nur der Ersatzweg - ein Vielfaches ihrer Dauer an Rechenzeit.';
          }
        }
        if (!global.confirm(frage)) {
          meldungEin.textContent = 'Abgebrochen.';
          knopfEin.disabled = false;
          return;
        }
        if (zustand.exitLoeser) { zustand.exitLoeser.anhalten(); zustand.exitLoeser = null; }
        aufraeumen();

        // Die Kalibrierung stammt vom alten Gerät - für die Restzeitanzeige neu messen
        if (ergebnis.tresor.fragmente[0].schloss) {
          meldungEin.textContent = 'Rechenleistung dieses Geräts messen ...';
          try { ergebnis.tresor.rate = await T.zeitschloss.messen(); } catch (fehler) {}
        }
        if (ergebnis.verlauf) {
          ergebnis.verlauf.slice().reverse().forEach(function (eintrag) { T.speicher.archivErgaenzen(eintrag); });
        }
        zustand.tresor = ergebnis.tresor;
        zustand.laenge = ergebnis.tresor.laenge;
        zustand.art = ergebnis.tresor.art || 'zahl';
        if (!T.speicher.sichern(ergebnis.tresor)) {
          meldungEin.textContent = 'Der Tresor passt nicht in den Browser-Speicher dieses Geräts.';
          meldungEin.className = 'warnung';
          zustand.tresor = null;
          knopfEin.disabled = false;
          return;
        }
        zeichneTresor();
      } catch (fehler) {
        meldungEin.textContent = fehler.message;
        meldungEin.className = 'warnung';
        knopfEin.disabled = false;
      }
    });

    return karte;
  }

  /* ---------------- Verlauf ---------------- */

  function verlaufKarte() {
    var liste = T.speicher.archivLaden();
    if (!liste.length) return null;
    return el('section', { class: 'karte' }, [
      el('h2', { text: 'Verlauf' }),
      el('p', { class: 'flaut klein', text: 'Was du dir zurückgeholt hast, liegt hier, bis du es löschst. Offen - der Tresor war es ja auch.' }),
      el('ul', { class: 'verlaufliste' }, liste.map(function (eintrag) {
        return el('li', { class: 'verlaufzeile' }, [
          eintrag.art === 'foto'
            ? el('img', { class: 'verlaufbild', src: eintrag.ergebnis, alt: 'Ergebnisbild' })
            : el('span', { class: 'verlaufzahl', text: eintrag.ergebnis }),
          el('div', { class: 'verlaufinfo' }, [
            el('strong', { text: eintrag.art === 'foto' ? 'Bild, ' + eintrag.stufen + ' Stufen' : eintrag.ergebnis.length + '-stellige Zahl' }),
            el('span', { class: 'flaut klein', text: 'geöffnet ' + util.zeitpunkt(eintrag.geoeffnet)
              + ' · ' + (eintrag.sicherheit === 'rechenzeit' ? 'mit Zeitschloss'
                 : eintrag.sicherheit === 'drand' ? 'am Netz' : 'ohne Rechenzeit')
              + (eintrag.notausgangBenutzt ? ' · über den Notausgang' : '') })
          ]),
          el('button', { class: 'knopf', type: 'button', text: 'ansehen',
            onclick: function () { zeichneVerlaufEintrag(eintrag.id); } })
        ]);
      }))
    ]);
  }

  function zeichneVerlaufEintrag(id) {
    aufraeumen();
    var eintrag = T.speicher.archivLaden().filter(function (e) { return e.id === id; })[0];
    var wurzel = util.leeren($('#buehne'));
    var zurueck = function () { if (zustand.tresor) zeichneTresor(); else zeichneEinrichten(); };
    wurzel.appendChild(el('section', { class: 'karte' }, [
      el('button', { class: 'knopf', type: 'button', text: '← zurück', onclick: zurueck })
    ]));
    if (!eintrag) {
      wurzel.appendChild(el('section', { class: 'karte' }, [el('p', { class: 'warnung', text: 'Dieser Eintrag ist nicht mehr da.' })]));
      return;
    }
    wurzel.appendChild(el('section', { class: 'karte mittig' }, [
      el('h2', { text: eintrag.art === 'foto' ? 'Bild aus dem Verlauf' : 'Zahl aus dem Verlauf' }),
      eintrag.art === 'foto'
        ? el('img', { class: 'ergebnisbild', src: eintrag.ergebnis, alt: 'Ergebnisbild' })
        : el('p', { class: 'grossezahl', text: eintrag.ergebnis }),
      eintrag.art === 'foto'
        ? el('a', { class: 'knopf', href: eintrag.ergebnis, download: 'tresor-bild.jpg' }, 'Bild sichern')
        : null,
      el('p', { class: 'flaut klein', text: 'Erstellt ' + util.zeitpunkt(eintrag.erstellt)
        + ', geöffnet ' + util.zeitpunkt(eintrag.geoeffnet) + '.' }),
      el('button', { class: 'knopf gefahr', type: 'button', text: 'Aus dem Verlauf löschen', onclick: function () {
        if (!global.confirm('Diesen Eintrag endgültig löschen?')) return;
        T.speicher.archivLoeschen(id);
        zurueck();
      } })
    ]));
  }

  function neuAnlegen() {
    if (!global.confirm('Neuen Tresor anlegen? Das Ergebnis bleibt im Verlauf, der Tresor selbst wird gelöscht.')) return;
    if (zustand.exitLoeser) { zustand.exitLoeser.anhalten(); zustand.exitLoeser = null; }
    T.speicher.loeschen();
    zustand.tresor = null;
    zustand.geheimnis = '';
    zeichneEinrichten();
  }

  function tresorLoeschen() {
    if (!global.confirm('Tresor endgültig löschen? Die Zahl ist danach nicht mehr rekonstruierbar.')) return;
    aufraeumen();
    if (zustand.exitLoeser) { zustand.exitLoeser.anhalten(); zustand.exitLoeser = null; }
    T.speicher.loeschen();
    zustand.tresor = null;
    zustand.geheimnis = '';
    zeichneEinrichten();
  }

  /* Nächster Schritt: entweder eine offene Aufgabe oder das Zeitschloss. */
  function starteAktuelles(karte) {
    var tresor = zustand.tresor;
    var fragment, aufgabe, lage = null;
    if (tresor.freigabe) {
      lage = T.tresorLogik.netzLage(tresor);
      /* Erst abholen, was abzuholen ist: Ist die Freigabe erreicht, gehen
       * alle Fragmente auf, deren Pruefungen erledigt sind - auch wenn
       * anderswo noch Pruefungen offen sind. */
      /* "Erst weiter pruefen" gilt nur, solange es etwas zu pruefen gibt -
       * sonst zeichnete die Warteansicht sich endlos selbst neu. */
      if (lage.bereit.length && T.tresorLogik.freigabeErreicht(tresor)
          && !(zustand.netzSpaeter && lage.aufgabe)) {
        netzAbholen(karte, lage);
        return;
      }
      if (!lage.aufgabe) { netzWarten(karte, lage); return; }
      fragment = lage.fragment;
      aufgabe = lage.aufgabe;
    } else {
      fragment = T.tresorLogik.aktuellesFragment(tresor);
      if (!fragment) return;
      aufgabe = T.tresorLogik.offeneAufgabe(fragment);
    }

    var kopf = el('div', { class: 'aufgaben-kopf' }, lage ? [
      el('span', { class: 'flaut', text: imDunkeln() ? 'Prüfung' : 'Prüfung ' + lage.nr + ' von ' + lage.gesamt }),
      el('span', { class: 'flaut', text: gutschriftText(tresor, aufgabe) })
    ] : [
      el('span', { class: 'flaut', text: 'Fragment ' + (fragment.index + 1) + ' von ' + tresor.laenge }),
      el('span', { class: 'flaut', text: (tresor.konfig || {}).blind
        ? (aufgabe ? 'Aufgabe' : T.stimme.WORT.bann)
        : (aufgabe
            ? 'Aufgabe ' + (fragment.aufgaben.indexOf(aufgabe) + 1) + ' von ' + fragment.aufgaben.length
            : T.stimme.WORT.bann) })
    ]);
    util.leeren(karte).appendChild(kopf);
    if (zustand.wachterwort) {
      karte.appendChild(el('p', { class: 'wachterwort', text: zustand.wachterwort }));
      zustand.wachterwort = null;
    }
    var buehne = el('div', { class: 'aufgaben-buehne' });
    karte.appendChild(buehne);

    if (aufgabe) {
      var modul = T.herausforderungen.hole(aufgabe.id);
      if (aufgabe.zustand.strafeBis && Date.now() < aufgabe.zustand.strafeBis) {
        strafBuehne(buehne, aufgabe);
        return;
      }
      if (T.tresorLogik.kapitulationAbgesessen(aufgabe)) {
        aufgabe.erledigt = true;
        sichern(true);
        zeichneTresor();
        return;
      }
      if (!aufgabe.zustand.__begonnen) {
        if (modul.aktiviere) modul.aktiviere(aufgabe.params, aufgabe.zustand);
        aufgabe.zustand.__begonnen = Date.now();
        sichern(true);
      }
      if (aufgabe.frist) {
        if (!aufgabe.zustand.fristStart) aufgabe.zustand.fristStart = Date.now();
        kopf.appendChild(el('span', { class: 'fristmarke', text: '⏳ geheime Frist' }));
      }

      var beendet = false;
      var kontext = {
        wurzel: buehne,
        params: aufgabe.params,
        zustand: aufgabe.zustand,
        konfig: tresor.konfig,
        rate: tresor.rate,
        speichern: function () { sichern(false); },
        fertig: function () {
          if (beendet) return;
          beendet = true;
          aufgabe.erledigt = true;
          if (tresor.freigabe) T.tresorLogik.gutschriftBuchen(tresor, fragment, aufgabe);
          zustand.wachterwort = T.stimme.sag('lob');
          sichern(true);
          zeichneTresor();
        },
        /* Antwortgebundene Aufgaben: der Prüfwert kostet absichtlich eine
         * volle PBKDF2-Ableitung, damit Durchprobieren teuer bleibt. */
        pruefeAntwort: async function (text) {
          if (beendet || !aufgabe.pruefung) return false;
          var normalisiert = modul.normalisiere ? modul.normalisiere(text) : String(text).trim();
          if (!normalisiert) return false;
          var hash = await T.krypto.antwortPruefung(
            normalisiert, aufgabe.pruefung.salz, fragment.iterationen || T.krypto.ITERATIONEN);
          if (hash !== aufgabe.pruefung.hash) return false;
          aufgabe.zustand.antwort = normalisiert;
          kontext.fertig();
          return true;
        },
        fehlschlag: function (grund) {
          if (beendet) return false;
          /* Abmachung: Aufgaben, deren Teilfortschritt einen Neustart
           * ueberleben soll, legen ihn unter zustand.stand ab. Ein
           * Fehlschlag - etwa eine abgelaufene Frist - loescht ihn. Genau
           * das ist die Strafe; ohne das waere die Frist folgenlos. */
          delete aufgabe.zustand.stand;
          aufgabe.zustand.fehlversuche = (aufgabe.zustand.fehlversuche || 0) + 1;
          /* Am Netz sperrt eine Strafe nicht die Aufgabe, sie schiebt die
           * Freigabe nach hinten. Das ist echte Zeit: Die frueheren Sprossen
           * bleiben zwar im Speicher, aber die App bietet sie nicht mehr an.
           * Ist die Freigabe schon abgeholt, gibt es keine Zeit mehr zu
           * verschieben - dann gilt die gewoehnliche Strafzeit. */
          if (tresor.freigabe && !tresor.freigabe.z) {
            var buchung = T.tresorLogik.strafeBuchen(tresor, aufgabe.zustand.fehlversuche);
            if (!buchung) { sichern(false); return false; }
            beendet = true;
            buchung.grund = grund || '';
            buchung.fehlversuch = aufgabe.zustand.fehlversuche;
            buchung.zeit = Date.now();
            buchung.gewuerfelt = false;
            tresor.freigabe.letzteBuchung = buchung;
            if (aufgabe.frist) aufgabe.zustand.fristStart = 0;
            sichern(true);
            zeichneTresor();
            return true;
          }
          var sekunden = T.tresorLogik.strafzeit(tresor.konfig, aufgabe.zustand.fehlversuche);
          if (!sekunden) { sichern(false); return false; }
          beendet = true;
          aufgabe.zustand.strafeBis = Date.now() + sekunden * 1000;
          aufgabe.zustand.strafGrund = grund || '';
          if (aufgabe.frist) aufgabe.zustand.fristStart = 0;
          sichern(true);
          zeichneTresor();
          return true;
        }
      };

      // Bildschirm während der Aufgabe anlassen: Auf dem Handy geht er sonst
      // mitten in einer Geduldsübung aus.
      wachhalter.an('aufgabe');
      var aufraeumenAufgabe = modul.starte(kontext);
      kapitulationsLeiste(karte, fragment, aufgabe, modul, function () { beendet = true; });
      var fristUhr = null;
      if (aufgabe.frist) {
        fristUhr = setInterval(function () {
          if (beendet) return;
          if (Date.now() - aufgabe.zustand.fristStart < aufgabe.frist * 1000) return;
          // Frist abgelaufen: neue ziehen, damit der nächste Anlauf anders liegt
          aufgabe.frist = T.tresorLogik.neueFrist(tresor.konfig, modul.schaetzung(aufgabe.params));
          aufgabe.zustand.fristStart = Date.now();
          aufgabe.zustand.fristAbgelaufen = true;
          if (!kontext.fehlschlag('Die geheime Frist ist abgelaufen.')) {
            sichern(true);
            zeichneTresor();
          }
        }, 1000);
      }
      zustand.aufraeumen = function () {
        if (fristUhr) clearInterval(fristUhr);
        wachhalter.aus('aufgabe');
        if (aufraeumenAufgabe) aufraeumenAufgabe();
      };
      if (aufgabe.zustand.fristAbgelaufen) {
        aufgabe.zustand.fristAbgelaufen = false;
        buehne.appendChild(el('p', { class: 'warnung', text: 'Die geheime Frist war abgelaufen. Neuer Anlauf, neue Frist.' }));
      }
    } else if (!fragment.schloss) {
      freigabeOhneZeitschloss(buehne, fragment);
    } else {
      zeitschlossBuehne(buehne, fragment);
    }
  }

  /* Ohne Zeitschloss: Das Fragment geht sofort auf. */
  function freigabeOhneZeitschloss(buehne, fragment) {
    util.leeren(buehne);
    buehne.appendChild(el('p', { class: 'aufgabe-titel', text: 'Fragment freigeben' }));
    buehne.appendChild(el('p', { class: 'aufgabe-hinweis', text:
      'Alle Aufgaben dieses Fragments sind erledigt. Dieser Tresor läuft ohne Rechenzeit, es geht also sofort weiter.' }));
    var knopf = el('button', { class: 'knopf gross haupt', type: 'button', text: 'Freigeben' });
    buehne.appendChild(knopf);
    knopf.addEventListener('click', function () {
      knopf.disabled = true;
      T.tresorLogik.fragmentOeffnen(zustand.tresor, fragment, null, zustand.passMaterial).then(function () {
        sichern(true);
        zeichneTresor();
      }).catch(function (fehler) {
        buehne.appendChild(el('p', { class: 'warnung', text: 'Entschlüsseln fehlgeschlagen: ' + fehler.message }));
      });
    });
  }

  /* Restzeit fuer Uhren, die ueber Tage laufen koennen. */
  function restUhr(sekunden) {
    sekunden = Math.max(0, Math.ceil(sekunden));
    if (sekunden < 86400) return util.uhrwerk(sekunden);
    var tage = Math.floor(sekunden / 86400);
    return (tage === 1 ? '1 Tag' : tage + ' Tage') + ' · ' + util.uhrwerk(sekunden % 86400);
  }

  function netzFehlerText(fehler) {
    if (fehler.art === 'netz') return 'Das Netz antwortet nicht. Ohne Internet bleibt er zu - versuch es gleich noch einmal.';
    if (fehler.art === 'zufrueh') return 'Noch nicht. Stimmt die Uhr dieses Geräts?';
    return 'Die Antwort des Netzes passt nicht zum Schloss: ' + fehler.message;
  }

  /* Was die laufende Pruefung einbringt - steht im Kopf, damit man weiss,
   * worum es geht, bevor man anfaengt. */
  function gutschriftText(tresor, aufgabe) {
    var wert = T.tresorLogik.gutschriftWert(tresor, aufgabe);
    if (!wert.sekunden) return '';
    var frist = tresor.freigabe.takt && wert.puenktlich
      ? 'pünktlich bis ' + util.zeitpunkt(aufgabe.puenktlichBis).replace(' Uhr', '') : '';
    /* Unter Willkuer steht da kein Betrag - nur, bis wann es zaehlt. Das
     * braucht man, um ueberhaupt puenktlich sein zu koennen. */
    if (imDunkeln()) return frist || (wert.puenktlich ? '' : 'verspätet');
    /* Der Betrag wird beim Loesen gezogen; hier steht sein Normalwert. */
    return 'holt ~' + util.dauer(wert.sekunden) + (!wert.puenktlich ? ' (verspätet)' : frist ? ' · ' + frist : '');
  }

  /* Was der gezogene Ausschlag bedeutet - fuer den Kasten nach dem Buchen. */
  function ausschlagWort(b) {
    var x = b.ausschlag || 1;
    if (b.art === 'gutschrift') return x >= 2.5 ? ' Ein Treffer.' : x >= 1.5 ? ' Mehr als sonst.' : x < 0.6 ? ' Weniger als sonst.' : '';
    return x >= 2.5 ? ' Hart getroffen.' : x >= 1.5 ? ' Mehr als sonst.' : x < 0.6 ? ' Glück gehabt.' : '';
  }

  /* Die Uhr ueber allem, solange die Freigabe aussteht. Sie zeichnet den
   * Tresor nie neu - sonst risse sie einem mitten in einer Aufgabe die
   * Buehne weg. */
  function freigabeKarte(tresor) {
    var f = tresor.freigabe;
    var karte = el('section', { class: 'karte freigabe-karte' }, [el('h2', { text: 'Freigabe' })]);
    if (f.z) {
      karte.appendChild(el('p', { class: 'flaut', text: 'Das Netz hat freigegeben. Was noch fehlt, sind deine Prüfungen.' }));
      return karte;
    }
    var anzeige = el('div', { class: 'countdown', text: '–' });
    var wann = el('p', { class: 'flaut klein mittig-text', text: '' });
    karte.appendChild(anzeige);
    karte.appendChild(wann);
    var dunkel = imDunkeln();
    if (!dunkel) {
      var unten = T.drand.zeitVon(f.runden[0]);
      var oben = T.drand.zeitVon(f.runden[f.runden.length - 1]);
      karte.appendChild(el('p', { class: 'flaut klein mittig-text', text:
        'Bestenfalls ' + util.zeitpunkt(unten) + ' · spätestens ' + util.zeitpunkt(oben)
        + (tresor.notausgang ? ' (Notausgang)' : '') }));
    }

    var b = f.letzteBuchung || f.letzteStrafe;
    if (b && !b.erledigt && (b.gewuenscht || b.art === 'strafe')) {
      var strafe = b.art !== 'gutschrift';
      var aufgegeben = b.art === 'kapitulation';
      var kasten = el('div', { class: strafe ? 'strafkasten' : 'gutkasten' }, [
        el('p', { class: 'aufgabe-titel', text: aufgegeben ? 'Kapituliert' : strafe ? T.stimme.WORT.strafe : 'Gutschrift' }),
        el('p', { class: 'wachterwort', text: T.stimme.sag(aufgegeben ? 'kapitulation' : strafe ? 'verschoben' : 'gutschrift') }),
        el('p', { class: 'aufgabe-hinweis', text: aufgegeben
          ? 'Gewürfelt: ' + b.augen + '. ' + (b.amDeckel && !b.wirksam ? 'Weiter nach hinten geht es nicht.' : '+' + util.dauer(b.gewuenscht) + '.')
          : strafe
          /* Angezeigt wird, was gebucht ist, nicht der Sprung auf der Leiter:
           * Das Konto rechnet exakt, die Leiter in Stufen. Mehrere kleine
           * Buchungen summieren sich richtig, auch wenn die Uhr erst beim
           * naechsten Sprossenwechsel springt. */
          ? (b.grund ? b.grund + ' ' : '') + 'Fehlversuch ' + b.fehlversuch + '. '
            + (b.amDeckel && !b.wirksam ? 'Weiter nach hinten geht es nicht.' : '+' + util.dauer(b.gewuenscht) + '.' + ausschlagWort(b))
          : '−' + util.dauer(-b.gewuenscht) + (b.puenktlich ? '.' : ' - verspätet, nur die Hälfte.') + ausschlagWort(b)
            + (b.amBoden ? ' Weiter nach vorn geht es nicht.' : '') })
      ]);
      karte.appendChild(kasten);
      /* Ab und zu - nicht immer - bietet der Game Master einen Wurf an.
       * Beide Wuerfe sind im Mittel ausgeglichen: 1/3 x 0 + 2/3 x 1,5 bei
       * der Strafe, 1/3 x 2 + 2/3 x 0,5 bei der Gutschrift - jeweils genau 1. */
      var betrag = Math.abs(b.gewuenscht || 0);
      if (!aufgegeben && b.angebot && !b.gewuerfelt && betrag > 0 && !(strafe && b.amDeckel && !b.wirksam)) {
        kasten.appendChild(el('p', { class: 'wachterwort', text: strafe ? 'Willst du es drauf ankommen lassen?' : 'Mehr? Oder weniger?' }));
        T.herausforderungen.werkzeug.wuerfel(kasten, function (gewonnen) {
          b.gewuerfelt = true;
          /* Fuer beide dieselbe Bewegung: Gewonnen zieht die Freigabe um den
           * Betrag nach vorn (Strafe weg / Gutschrift doppelt), verloren um
           * den halben nach hinten (Strafe x1,5 / Gutschrift halbiert). */
          var zug = T.tresorLogik.zeitkontoVerschieben(tresor, gewonnen ? -betrag : Math.round(betrag * 0.5));
          b.nachWurf = zug ? zug.gewuenscht : 0;
          sichern(true);
          takt();
        }, strafe ? {
          regel: '5 oder 6: diese Strafe fällt weg. 1 bis 4: sie wird um die Hälfte länger. Ein Wurf - oder lass es.',
          gewonnen: 'Gewonnen. Die Strafe ist weg.',
          verloren: 'Verloren. Die Strafe wird um die Hälfte länger.'
        } : {
          regel: '5 oder 6: die Gutschrift verdoppelt sich. 1 bis 4: die Hälfte ist weg. Ein Wurf - oder lass es.',
          gewonnen: 'Gewonnen. Noch einmal so viel.',
          verloren: 'Verloren. Die Hälfte ist weg.'
        });
      }
      kasten.appendChild(el('button', { class: 'knopf', type: 'button', text: 'Verstanden',
        onclick: function () { b.erledigt = true; sichern(true); kasten.remove(); } }));
    }

    karte.appendChild(el('p', { class: 'flaut klein', text:
      'Das Netz hält ihn, nicht dieses Gerät. Der Bildschirm darf aus sein, die App geschlossen. '
      + 'Jede gelöste Prüfung holt Zeit zurück, jeder Fehler schiebt die Freigabe weg.' }));

    function takt() {
      var ziel = T.tresorLogik.freigabeZiel(tresor);
      var rest = (ziel.zeit - Date.now()) / 1000;
      /* Unter Willkuer keine Uhr: Sie waere die eine Zahl, aus der sich alles
       * ablesen liesse. Was eine Buchung bewegt hat, steht im Kasten - wohin
       * es fuehrt, nicht. */
      if (dunkel) {
        anzeige.textContent = rest > 0 ? '· · ·' : 'Die Zeit ist um.';
        anzeige.classList.remove('ist-lang');
        wann.textContent = rest > 0 ? 'Wie lange noch, sage ich nicht.' : 'Hol dir, was dir zusteht.';
        return;
      }
      anzeige.textContent = rest > 0 ? restUhr(rest) : 'Die Zeit ist um.';
      anzeige.classList.toggle('ist-lang', rest >= 86400);
      wann.textContent = rest > 0 ? 'Offen ' + util.zeitpunkt(ziel.zeit) + '.' : 'Hol dir, was dir zusteht.';
    }
    takt();
    zustand.freigabeUhr = setInterval(takt, 1000);
    return karte;
  }

  /* Keine Pruefung dran: Entweder kommt die naechste erst noch (Takt), oder
   * alle sind abgelegt und es wartet nur noch die Zeit. */
  function netzWarten(karte, lage) {
    var tresor = zustand.tresor;
    var alleAbgelegt = !lage.offen;
    var ziel = alleAbgelegt ? T.tresorLogik.freigabeZiel(tresor).zeit : lage.naechsteAb;
    if (alleAbgelegt && tresor.freigabe.z) return;                     // nichts mehr zu tun
    util.leeren(karte);
    karte.appendChild(el('div', { class: 'aufgaben-kopf' }, [
      el('span', { class: 'flaut', text: alleAbgelegt ? 'Alle Prüfungen abgelegt'
        : imDunkeln() ? 'Prüfung' : 'Prüfung ' + (lage.gesamt - lage.offen + 1) + ' von ' + lage.gesamt }),
      el('span', { class: 'flaut', text: '' })
    ]));
    var buehne = el('div', { class: 'aufgaben-buehne' });
    karte.appendChild(buehne);
    buehne.appendChild(el('p', { class: 'aufgabe-titel', text: alleAbgelegt ? 'Jetzt hält ihn nur noch die Zeit' : 'Die nächste Prüfung kommt' }));
    var anzeige = el('div', { class: 'countdown', text: '–' });
    buehne.appendChild(anzeige);
    buehne.appendChild(el('p', { class: 'aufgabe-hinweis', text: alleAbgelegt
      ? 'Ist die Zeit um, geht er hier auf - mit Internet. Du kannst die App schließen.'
      : 'Ab ' + util.zeitpunkt(ziel) + '. Wer sie gleich löst, bekommt die volle Gutschrift. Du kannst die App schließen.' }));
    var tick = function () {
      var z = alleAbgelegt ? T.tresorLogik.freigabeZiel(tresor).zeit : ziel;
      var rest = (z - Date.now()) / 1000;
      if (rest <= 0) { clearInterval(uhr); zeichneTresor(); return; }
      /* Wann die naechste Pruefung kommt, muss man wissen - sonst kann man
       * nicht puenktlich sein. Wann der Tresor aufgeht, unter Willkuer nicht. */
      anzeige.textContent = alleAbgelegt && imDunkeln() ? '· · ·' : restUhr(rest);
      anzeige.classList.toggle('ist-lang', rest >= 86400 && !(alleAbgelegt && imDunkeln()));
    };
    var uhr = setInterval(tick, 1000);
    tick();
    zustand.aufraeumen = function () { clearInterval(uhr); };
  }

  /* Die Freigabe ist erreicht: Zeitschluessel beim Netz holen und jedes
   * Fragment oeffnen, dessen Pruefungen erledigt sind. Ohne Netz darf man
   * mit offenen Pruefungen weitermachen - die Zeit laeuft ja nicht weg. */
  function netzAbholen(karte, lage) {
    var tresor = zustand.tresor;
    util.leeren(karte);
    var buehne = el('div', { class: 'aufgaben-buehne' });
    karte.appendChild(buehne);
    buehne.appendChild(el('p', { class: 'aufgabe-titel', text: 'Freigabe' }));
    buehne.appendChild(el('p', { class: 'aufgabe-hinweis', text: tresor.freigabe.z
      ? 'Das Netz hat längst freigegeben.' : 'Die Zeit ist um. ' + lage.bereit.length
        + (lage.bereit.length === 1 ? ' Fragment wartet.' : ' Fragmente warten.') }));
    var knopf = el('button', { class: 'knopf gross haupt', type: 'button', text: 'Beim Netz abholen' });
    var meldung = el('p', { class: 'aufgabe-meldung', role: 'status', text: '' });
    buehne.appendChild(knopf);
    buehne.appendChild(meldung);
    var weiter = null;
    if (lage.aufgabe) {
      weiter = el('button', { class: 'knopf versteckt', type: 'button', text: 'Erst weiter prüfen',
        onclick: function () { zustand.netzSpaeter = true; zeichneTresor(); } });
      buehne.appendChild(weiter);
    }
    function holen() {
      knopf.disabled = true;
      meldung.textContent = tresor.freigabe.z ? '' : 'Frage das Netz ...';
      T.tresorLogik.freigabeHolen(tresor).then(async function (z) {
        sichern(true);
        for (var i = 0; i < lage.bereit.length; i++) {
          await T.tresorLogik.fragmentOeffnen(tresor, lage.bereit[i], z, zustand.passMaterial);
        }
        zustand.netzSpaeter = false;
        sichern(true);
        zeichneTresor();
      }).catch(function (fehler) {
        knopf.disabled = false;
        meldung.textContent = netzFehlerText(fehler);
        if (weiter) weiter.classList.remove('versteckt');
      });
    }
    knopf.addEventListener('click', holen);
    holen();
  }

  /* Notausgang ueber das Netz: kein Rechnen, nur Zeit. */
  function notausgangNetzKarte(tresor, karte) {
    var exit = tresor.notausgang;
    var geheim = exit.modus === 'geheim';
    var bereit = Date.now() >= exit.frei;
    var uhrtext = el('strong', { class: 'fristzeit', text: '' });
    if (!imDunkeln()) {
      karte.appendChild(el('p', {}, [geheim ? 'verstrichen: ' : 'noch: ', uhrtext]));
      if (!geheim && !bereit) {
        karte.appendChild(el('p', { class: 'flaut klein', text: 'Offen ab ' + util.zeitpunkt(exit.frei) + '.' }));
      }
    }
    var oeffnen = el('button', { class: 'knopf gross' + (bereit ? ' haupt' : ''), type: 'button', text: 'Geheimnis freigeben' });
    var meldung = el('p', { class: 'flaut klein', text: bereit ? 'Offen. Das Netz muss es noch bestätigen.'
      : imDunkeln() ? 'Zu. Frag nicht, wie lange noch.'
      : 'Noch zu. Die Zeit läuft auch bei geschlossener App.' });
    oeffnen.disabled = !bereit;
    oeffnen.addEventListener('click', function () {
      if (oeffnen.disabled) return;
      oeffnen.disabled = true;
      meldung.textContent = 'Frage das Netz ...';
      T.tresorLogik.notausgangUeberNetz(tresor, zustand.passMaterial).then(function () {
        sichern(true);
        zeichneTresor();
      }).catch(function (fehler) {
        oeffnen.disabled = false;
        meldung.textContent = netzFehlerText(fehler);
      });
    });
    karte.appendChild(oeffnen);
    karte.appendChild(meldung);
    function tick() {
      uhrtext.textContent = geheim
        ? util.dauer((Date.now() - tresor.erstellt) / 1000)
        : restUhr((exit.frei - Date.now()) / 1000);
      if (!bereit && Date.now() >= exit.frei) { zeichneTresor(); }
    }
    tick();
    if (!bereit) zustand.exitUhr = setInterval(tick, 1000);
    return karte;
  }

  /* Kapitulieren: unter jeder Pruefung, zurueckhaltend. Erst ein Klick, dann
   * die Erklaerung und der Wurf - wer wuerfelt, gibt auf. Bis dahin laesst
   * sich alles zuruecknehmen. */
  function kapitulationsLeiste(karte, fragment, aufgabe, modul, beenden) {
    var tresor = zustand.tresor;
    var moeglich = T.tresorLogik.kapitulationMoeglich(fragment, aufgabe);
    var leiste = el('div', { class: 'kapitulation' });
    karte.appendChild(leiste);
    if (!moeglich.ok) {
      leiste.appendChild(el('p', { class: 'flaut klein', text:
        'Aufgeben geht hier nicht: Die Lösung dieser Prüfung ist ein Stück des Schlüssels, '
        + 'und ohne Zeitschloss gibt es kein Pfand dafür. Bleibt der Notausgang.' }));
      return;
    }
    var knopf = el('button', { class: 'knopf flach', type: 'button', text: 'Kapitulieren' });
    leiste.appendChild(knopf);
    knopf.addEventListener('click', function () {
      util.leeren(leiste);
      var netz = tresor.freigabe && !tresor.freigabe.z;
      var K = T.tresorLogik.KAPITULATION;
      var tabelle = (tresor.konfig || {}).blind ? K.augenWillkuer : K.augen;
      var normal = netz ? tresor.freigabe.tresorzeit * K.netzAnteil
        : Math.max(K.wartenMin, K.wartenFaktor * modul.schaetzung(aufgabe.params));
      leiste.appendChild(el('p', { class: 'wachterwort', text: 'Zu schwer? Dann würfle, was es kostet.' }));
      leiste.appendChild(el('p', { class: 'flaut klein', text: 'Wer würfelt, gibt auf. '
        + (imDunkeln() ? 'Was es kostet, entscheidet der Wurf.'
          : (netz ? 'Die Freigabe rückt nach hinten' : 'Du wartest') + ', um ' + util.dauer(normal)
            + ' mal ' + tabelle.map(function (x) { return String(x).replace('.', ','); }).join(' · ') + ' - je nach Augen, von 1 bis 6.')
        + (moeglich.pfand ? ' Die Lösung bekommst du erst mit dem Zeitschloss zurück.' : '') }));
      var zurueck = el('button', { class: 'knopf flach', type: 'button', text: 'Doch weiter versuchen' });
      T.herausforderungen.werkzeug.wuerfel(leiste, function (gewonnen, streckung, augen) {
        beenden();
        var erg = T.tresorLogik.kapitulieren(tresor, fragment, aufgabe, augen, modul.schaetzung(aufgabe.params));
        sichern(true);
        leiste.appendChild(el('p', { class: 'aufgabe-meldung', text: erg.art === 'freigabe'
          ? '+' + util.dauer(erg.sekunden) + ' auf die Freigabe.' : util.dauer(erg.sekunden) + ' Wartezeit.' }));
        setTimeout(zeichneTresor, 1800);
      }, {
        regel: 'Ein Wurf, keine Wiederholung.',
        ergebnis: function (augen) { return 'Eine ' + augen + '. ' + T.stimme.sag('kapitulation'); }
      });
      leiste.appendChild(zurueck);
      // Rollt der Wuerfel, gibt es kein Zurueck mehr
      leiste.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('.wuerfelbox button')) zurueck.remove();
      });
      zurueck.addEventListener('click', function () {
        util.leeren(leiste);
        leiste.appendChild(knopf);
      });
    });
  }

  /* Gesperrte Aufgabe: Strafzeit absitzen. */
  function strafBuehne(buehne, aufgabe) {
    var modul = T.herausforderungen.hole(aufgabe.id);
    var aufgegeben = !!aufgabe.zustand.kapituliert;
    util.leeren(buehne);
    buehne.appendChild(el('p', { class: 'aufgabe-titel', text: aufgegeben ? 'Kapituliert' : T.stimme.WORT.strafe }));
    buehne.appendChild(el('p', { class: 'wachterwort', text: T.stimme.sag(aufgegeben ? 'kapitulation' : 'strafe') }));
    buehne.appendChild(el('p', { class: 'aufgabe-hinweis', text: aufgegeben
      ? 'Gewürfelt: ' + aufgabe.zustand.kapitulationAugen + '. Danach gilt die Prüfung als abgelegt - ohne dass du sie lösen musst.'
      : (aufgabe.zustand.strafGrund ? aufgabe.zustand.strafGrund + ' ' : '')
        + 'Fehlversuch ' + aufgabe.zustand.fehlversuche + '.' }));
    var anzeige = el('div', { class: 'countdown', text: '--:--' });
    buehne.appendChild(anzeige);

    /* Auch eine Strafe darf verwürfelt werden - einmal. Eine Kapitulation
     * nicht: Die war schon ein Wurf. */
    if ((zustand.tresor.konfig || {}).gluecksspiel && !aufgegeben && !aufgabe.zustand.gewuerfelt
        && aufgabe.zustand.strafeBis - Date.now() > 5000) {
      T.herausforderungen.werkzeug.wuerfel(buehne, function (gewonnen, streckung) {
        aufgabe.zustand.gewuerfelt = true;
        aufgabe.zustand.strafeBis = gewonnen
          ? Date.now()
          : Date.now() + (aufgabe.zustand.strafeBis - Date.now()) * streckung;
        sichern(true);
      });
    }

    var uhr = setInterval(function () {
      var rest = (aufgabe.zustand.strafeBis - Date.now()) / 1000;
      anzeige.textContent = imDunkeln() ? '· · ·' : util.uhrwerk(rest);
      if (rest > 0) return;
      clearInterval(uhr);
      aufgabe.zustand.strafeBis = 0;
      sichern(true);
      zeichneTresor();
    }, 250);
    zustand.aufraeumen = function () { clearInterval(uhr); };
  }

  function zeitschlossBuehne(buehne, fragment) {
    var schritteGesamt = fragment.schloss.t;
    util.leeren(buehne);
    buehne.appendChild(el('p', { class: 'aufgabe-titel', text: T.stimme.WORT.bannLang }));
    buehne.appendChild(el('p', { class: 'wachterwort', text: T.stimme.sag('bann') }));
    buehne.appendChild(el('p', { class: 'aufgabe-hinweis', text: imDunkeln()
      ? 'Wie lange, erfährst du nicht. Der Tab darf zu.'
      : 'Das Gerät arbeitet. Der Tab darf zu.' }));
    buehne.appendChild(technikZeile('Sequentielles Quadrieren modulo eines 1024-Bit-Produkts zweier Primzahlen: '
      + schritteGesamt.toLocaleString('de-DE') + ' Schritte, die nur nacheinander gehen. Mehr Kerne verkürzen das nicht.'));

    var anzeige = el('div', { class: 'countdown', text: '--:--' });
    var fuellung = el('i');
    var text = el('span', { class: 'balken-text', text: '' });
    var knopf = el('button', { class: 'knopf gross haupt', type: 'button', text: 'Bann brechen' });
    buehne.appendChild(anzeige);
    var mahlwerk = null;
    if (imDunkeln()) {
      mahlwerk = el('div', { class: 'mahlwerk ist-still' });
      buehne.appendChild(mahlwerk);
    } else {
      buehne.appendChild(el('div', { class: 'balken' }, [fuellung]));
      buehne.appendChild(text);
    }
    buehne.appendChild(knopf);
    var schalter = wachSchalter();
    if (schalter) buehne.appendChild(schalter);

    var laeuft = false, startZeit = 0, startSchritte = fragment.stand.erledigt;

    function zeichneStand(erledigt) {
      var anteil = erledigt / schritteGesamt;
      if (imDunkeln()) {
        anzeige.textContent = laeuft ? '· · ·' : 'angehalten';
        if (mahlwerk) mahlwerkSchlag(mahlwerk, laeuft);
        return;
      }
      fuellung.style.width = (anteil * 100).toFixed(2) + '%';
      var rate = laeuft && Date.now() > startZeit
        ? (erledigt - startSchritte) / ((Date.now() - startZeit) / 1000)
        : zustand.tresor.rate;
      var rest = rate > 0 ? (schritteGesamt - erledigt) / rate : 0;
      anzeige.textContent = laeuft ? util.uhrwerk(rest) : util.uhrwerk(rest) + ' (pausiert)';
      text.textContent = (anteil * 100).toFixed(1) + ' % gebrochen';
    }

    zeichneStand(fragment.stand.erledigt);

    function starten() {
      if (laeuft) { anhalten(); return; }
      laeuft = true;
      startZeit = Date.now();
      startSchritte = fragment.stand.erledigt;
      knopf.textContent = 'Pause';
      zeichneStand(fragment.stand.erledigt);
      if (wachWunschLaden()) bildschirmWachHalten(true);
      zustand.loeser = new T.zeitschloss.Loeser(fragment.schloss, fragment.stand, function (stand) {
        fragment.stand.erledigt = stand.erledigt;
        fragment.stand.x = stand.x;
        zeichneStand(stand.erledigt);
        sichern(false);
      });
      zustand.loeser.starten().then(function (b) {
        if (!b) { laeuft = false; knopf.textContent = 'Weiter brechen'; zeichneStand(fragment.stand.erledigt); sichern(true); return; }
        zustand.loeser = null;
        return T.tresorLogik.fragmentOeffnen(zustand.tresor, fragment, b, zustand.passMaterial).then(function () {
          zustand.wachterwort = T.stimme.sag('freigabe');
          sichern(true);
          zeichneTresor();
        });
      }).catch(function (fehler) {
        laeuft = false;
        buehne.appendChild(el('p', { class: 'warnung', text: 'Der Bann ist gestolpert: ' + fehler.message }));
      });
    }

    function anhalten() {
      if (!zustand.loeser) return;
      laeuft = false;
      knopf.textContent = 'Weiter brechen';
      bildschirmWachHalten(false);
      zustand.loeser.anhalten();
    }

    knopf.addEventListener('click', starten);
    zustand.aufraeumen = function () { if (zustand.loeser) zustand.loeser.anhalten(); };
    starten();
  }

  /* ---------------- Start ---------------- */

  function start() {
    if (!T.krypto.verfuegbar()) {
      $('#buehne').appendChild(el('p', { class: 'warnung', text:
        'Dieser Browser bietet keine Web Crypto API (oder die Seite läuft ohne HTTPS). Der Tresor braucht sie.' }));
      return;
    }
    zustand.konfig = T.tresorLogik.standardKonfiguration();
    var gespeichert = T.speicher.laden();
    if (gespeichert && gespeichert.fragmente) {
      zustand.tresor = gespeichert;
      zustand.laenge = gespeichert.laenge;
      zeichneTresor();
      // Lief der Notausgang beim letzten Mal, nimmt er den Faden wieder auf
      var exit = gespeichert.notausgang;
      if (exit && exit.mitlaufen && !exit.benutzt && exit.art !== 'wartezeit') notausgangStarten();
    } else {
      zeichneEinrichten();
    }

    document.addEventListener('visibilitychange', function () { if (document.hidden) sichern(true); });

    // Erinnerungen laufen unabhängig von der gerade sichtbaren Ansicht
    setInterval(function () {
      T.erinnerung.pruefen(zustand.tresor, function () { sichern(true); });
    }, 15000);
    T.erinnerung.pruefen(zustand.tresor, function () { sichern(true); });
    global.addEventListener('pagehide', function () { sichern(true); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(typeof window !== 'undefined' ? window : globalThis);
