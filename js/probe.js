/* Probelauf: eine einzelne Aufgabe ausprobieren, ohne Folgen.
 *
 * Der Grund dafuer steht in der Entwicklungsgeschichte dieser App: Ob eine
 * Uebung ueberhaupt zu schaffen ist, zeigt sich erst beim Spielen - und im
 * Ernstfall sitzt man dann vor einem verriegelten Tresor mit einer Aufgabe,
 * die nicht loesbar ist. Die ruhige Hand war zu streng, die Schritte hatten
 * zu wenig Zeit; beides waere hier in zwei Minuten aufgefallen.
 *
 * Nichts davon beruehrt einen Tresor: kein Speichern, keine Strafen, keine
 * Fristen. Was hier passiert, bleibt hier. */
(function (global) {
  'use strict';
  var T = global.Tresor || (global.Tresor = {});
  var util = T.util;
  var el = util.el;
  var $ = util.$;

  /* Wartezeiten im Probelauf werden hart gestaucht - niemand testet eine
   * zwoelfstuendige Sperrfrist in Echtzeit. Dafuer gibt es das Budget, das
   * der Aufgabenplan ohnehin kennt. */
  var PROBE_BUDGET = 45;

  var laeuft = null;          // Aufraeumer der laufenden Aufgabe

  function aufraeumen() {
    if (!laeuft) return;
    try { laeuft(); } catch (fehler) {}
    laeuft = null;
  }

  /* Der vorgetaeuschte Vorrat darf den Probelauf nicht ueberleben - sonst
   * baute der naechste Tresor Stationen auf Marken, die es nicht gibt. */
  function vorratAufraeumen() {
    if (T.ortAufgaben) T.ortAufgaben.vorratLeeren();
  }

  function dimensionName(id) {
    var d = T.herausforderungen.dimensionen.filter(function (x) { return x.id === id; })[0];
    return d ? d.name : id;
  }

  function zeige(zurueck) {
    aufraeumen();
    var wurzel = util.leeren($('#buehne'));

    wurzel.appendChild(el('section', { class: 'karte' }, [
      el('h2', { text: 'Probelauf' }),
      el('p', { class: 'flaut', text:
        'Jede Prüfung einzeln, in jeder Intensität, ohne Folgen. Kein Tresor wird angefasst, '
        + 'nichts gespeichert, keine Strafe droht.' }),
      el('p', { class: 'flaut klein', text:
        'Wartezeiten sind hier auf ' + PROBE_BUDGET + ' Sekunden gestaucht - sonst müsstest du '
        + 'eine zwölfstündige Sperrfrist wirklich absitzen.' }),
      el('button', { class: 'knopf', type: 'button', text: '‹ Zurück zur Einrichtung',
        onclick: function () { aufraeumen(); vorratAufraeumen(); zurueck(); } })
    ]));

    var buehne = el('section', { class: 'karte aufgabenkarte versteckt', id: 'probe-buehne' });
    var bericht = el('p', { class: 'wachterwort versteckt', id: 'probe-bericht' });

    /* Nach Dimensionen gruppiert und zugeklappt: Dreissig Aufgaben
     * untereinander sind eine Scrollstrecke, keine Uebersicht. */
    T.herausforderungen.dimensionen.forEach(function (dimension) {
      var module = T.herausforderungen.nachDimension(dimension.id);
      if (!module.length) return;
      var lade = el('details', { class: 'karte probe-gruppe' });
      lade.appendChild(el('summary', {}, [
        el('strong', { text: dimension.name }),
        el('span', { class: 'zaehler', text: module.length + (module.length === 1 ? ' Prüfung' : ' Prüfungen') })
      ]));
      module.forEach(function (modul) {
        lade.appendChild(zeile(modul, buehne, bericht));
      });
      wurzel.appendChild(lade);
    });

    wurzel.appendChild(bericht);
    wurzel.appendChild(buehne);
  }

  function zeile(modul, buehne, bericht) {
    var stufe = el('input', { type: 'range', min: '1', max: '5', value: '3',
      class: 'probe-stufe', id: 'probe-stufe-' + modul.id });
    var anzeige = el('output', { class: 'probe-stufenzahl', text: '3' });
    var vorschau = el('p', { class: 'flaut klein probe-vorschau', text: '' });
    var knopf = el('button', { class: 'knopf', type: 'button', text: 'Probe' });

    function vorschauen() {
      anzeige.textContent = stufe.value;
      var gebaut = baue(modul, Number(stufe.value));
      vorschau.textContent = gebaut
        ? modul.beschreibe(gebaut.params) + ' · geschätzt ' + util.dauer(modul.schaetzung(gebaut.params))
        : 'lässt sich hier nicht bauen';
    }
    stufe.addEventListener('input', vorschauen);
    knopf.addEventListener('click', function () { starte(modul, Number(stufe.value), buehne, bericht); });
    vorschauen();

    return el('div', { class: 'probe-zeile' }, [
      el('div', { class: 'probe-kopf' }, [
        el('strong', { text: modul.name }),
        modul.antwortGebunden ? el('span', { class: 'schluesselmarke', title: 'Antwort geht in den Schlüssel ein', text: '🔑' }) : null,
        modul.sensor ? el('span', { class: 'probe-marke', text: 'Sensor' }) : null,
        modul.nfc ? el('span', { class: 'probe-marke', text: 'NFC' }) : null
      ]),
      el('p', { class: 'flaut klein', text: modul.kurz }),
      el('div', { class: 'probe-regler' }, [el('span', { class: 'flaut klein', text: 'Intensität' }), stufe, anzeige]),
      vorschau,
      knopf
    ]);
  }

  /* Parameter ziehen. Manche Generatoren liefern nur bei passender Lage
   * etwas - dann eben ein paar Anlaeufe. */
  function baue(modul, stufe) {
    /* Stationen brauchen beschriebene Marken. Im Probelauf gibt es die nicht,
     * also wird ein Vorrat vorgetaeuscht - sonst liesse sich ausgerechnet die
     * Aufgabe nicht ansehen, bei der am meisten schiefgehen kann. */
    if (modul.nfc && T.ortAufgaben && !T.ortAufgaben.vorratGroesse()) {
      T.ortAufgaben.vorratSetzen(['probe-1', 'probe-2', 'probe-3']);
    }
    for (var versuch = 0; versuch < 20; versuch++) {
      var zufall = new T.Zufall(T.neueSaat());
      var params = modul.erzeuge(zufall, stufe, PROBE_BUDGET);
      if (!params) continue;
      var loesung = null;
      if (modul.antwortGebunden) {
        loesung = modul.normalisiere(params.loesung);
        if (!loesung) continue;
      }
      delete params.loesung;
      return { params: params, loesung: loesung };
    }
    return null;
  }

  function starte(modul, stufe, buehne, bericht) {
    aufraeumen();
    var gebaut = baue(modul, stufe);
    bericht.classList.add('versteckt');
    buehne.classList.remove('versteckt');
    var ziel = util.leeren(buehne);

    if (!gebaut) {
      ziel.appendChild(el('p', { class: 'warnung', text:
        'Diese Prüfung liefert auf Intensität ' + stufe + ' keine Aufgabe. Bei den Generatoren, die '
        + 'nur eindeutige Rätsel ausgeben, ist das normal - der Aufgabenplan zieht dann neu.' }));
      return;
    }

    var begonnen = Date.now();
    var geschaetzt = modul.schaetzung(gebaut.params);
    var fehlversuche = 0;
    var beendet = false;

    function melde(text, art) {
      var gebraucht = Math.round((Date.now() - begonnen) / 1000);
      bericht.textContent = text + ' Gebraucht: ' + util.dauer(gebraucht)
        + ', geschätzt war ' + util.dauer(geschaetzt) + '.'
        + (fehlversuche ? ' Fehlversuche: ' + fehlversuche + '.' : '');
      bericht.classList.remove('versteckt');
      bericht.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    var kontext = {
      wurzel: ziel,
      params: gebaut.params,
      zustand: {},
      konfig: { sicherheit: 'rechenzeit', gluecksspiel: false, blind: false },
      rate: 200000,
      probe: true,                       // der Ersatzweg haelt sich im Probelauf heraus
      speichern: function () {},
      fertig: function () {
        if (beendet) return;
        beendet = true;
        aufraeumen();
        buehne.classList.add('versteckt');
        melde('Geschafft.');
      },
      pruefeAntwort: function (text) {
        var normalisiert = modul.normalisiere ? modul.normalisiere(text) : String(text).trim();
        /* Bei einer Station zaehlt im Probelauf jede lesbare Marke. Die Frage
         * hier ist nicht "ist es die richtige" - es gibt noch keine richtige -,
         * sondern ob dieses Geraet ueberhaupt NFC liest und die Oberflaeche
         * taugt. */
        var richtig = modul.nfc ? !!normalisiert : (!!normalisiert && normalisiert === gebaut.loesung);
        if (richtig) kontext.fertig();
        return Promise.resolve(richtig);
      },
      /* Im Probelauf kostet ein Fehlschlag nichts - gezaehlt wird er
       * trotzdem, denn genau das ist die Frage: Wie oft geht es daneben? */
      fehlschlag: function () {
        fehlversuche++;
        return false;
      }
    };

    laeuft = modul.starte(kontext) || null;

    /* Werkzeug neben der Aufgabe: abbrechen, und bei gebundenen Raetseln die
     * Loesung sehen - hier geht es um Spielbarkeit, nicht ums Bestehen. */
    if (modul.nfc) {
      ziel.appendChild(el('p', { class: 'flaut klein', text:
        'Im Probelauf zählt jede Marke, die sich lesen lässt - es geht hier nur darum, ob dein Gerät sie überhaupt findet.' }));
    }
    var werkzeuge = [el('button', { class: 'knopf', type: 'button', text: 'Abbrechen',
      onclick: function () {
        if (beendet) return;
        beendet = true;
        aufraeumen();
        buehne.classList.add('versteckt');
        melde('Abgebrochen.');
      } })];
    if (gebaut.loesung) {
      werkzeuge.push(el('button', { class: 'knopf', type: 'button', text: 'Lösung zeigen',
        onclick: function (e) { e.target.textContent = gebaut.loesung; e.target.disabled = true; } }));
    }
    ziel.appendChild(el('div', { class: 'knopfzeile', style: 'margin-top:18px' }, werkzeuge));
    buehne.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  T.probe = { zeige: zeige, PROBE_BUDGET: PROBE_BUDGET };
})(typeof window !== 'undefined' ? window : globalThis);
