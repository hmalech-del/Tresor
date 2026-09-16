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
    letzteSicherung: 0,
    fotoErgebnis: null
  };

  /* ---------------- Bildschirm wachhalten ----------------
   * Rechnet der Tresor, ist der Tab im Vordergrund am schnellsten - und auf
   * dem Handy schlaeft der Bildschirm sonst mitten in der Rechnung ein.
   * Kostet zusaetzlich Strom, deshalb als Schalter und nicht automatisch. */

  var wachhalter = { sperre: null, gewuenscht: false };

  function wachWunschLaden() {
    try { return global.localStorage.getItem('tresor.wachhalten') === '1'; }
    catch (fehler) { return false; }
  }

  function wachWunschSichern(an) {
    try { global.localStorage.setItem('tresor.wachhalten', an ? '1' : '0'); } catch (fehler) {}
  }

  async function bildschirmWachHalten(an) {
    wachhalter.gewuenscht = an;
    try {
      if (an) {
        if (wachhalter.sperre || !global.navigator.wakeLock || document.hidden) return;
        wachhalter.sperre = await global.navigator.wakeLock.request('screen');
        wachhalter.sperre.addEventListener('release', function () { wachhalter.sperre = null; });
      } else if (wachhalter.sperre) {
        var sperre = wachhalter.sperre;
        wachhalter.sperre = null;
        await sperre.release();
      }
    } catch (fehler) { wachhalter.sperre = null; }
  }

  /* Schalter fuer die beiden Rechenansichten. */
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
    // Der Notausgang rechnet weiter - nur seine Anzeige verschwindet
    zustand.exitAnzeige = null;
    if (wachhalter.sperre) bildschirmWachHalten(false);
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
    var dimensionen = aktiveDimensionen();
    knopf.disabled = !(vollstaendig && dimensionen.length);
    $('#bereit-hinweis').textContent = !vollstaendig
      ? (zustand.art === 'foto' ? 'Es fehlt noch ein Bild.' : 'Es fehlen noch Ziffern.')
      : !dimensionen.length ? 'Wähle mindestens eine Dimension.' : '';
  }

  function aktiveDimensionen() {
    return util.$$('.dimension-karte input[type=checkbox]:checked').map(function (feld) { return feld.value; });
  }

  function konfigurationLesen() {
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
      strafe: Number($('#strafzeit').value),
      geheimeFrist: {
        aktiv: $('#frist-aktiv').checked,
        bezug: $('#frist-bezug').value,
        minSekunden: Number($('#frist-min-zeit').value),
        maxSekunden: Number($('#frist-max-zeit').value),
        minFaktor: minFaktor,
        maxFaktor: maxFaktor,
        folge: $('#frist-folge').value
      },
      notausgang: {
        minSekunden: Number($('#notausgang-min').value),
        maxSekunden: Number($('#notausgang-min').value) ? Number($('#notausgang-max').value) : 0
      }
    };
  }

  function aufwandAktualisieren() {
    if (!$('#rechenzeit-aufwand')) return;
    var ohneRechenzeit = $('#sicherheit').value !== 'rechenzeit';

    if (ohneRechenzeit) {
      $('#rechenzeit-aufwand').textContent = '';
    } else {
      var proSchloss = T.tresorLogik.RECHENZEIT_STUFEN[Number($('#rechenzeit').value) - 1];
      $('#rechenzeit-aufwand').textContent = rechenaufwand(proSchloss * zustand.laenge)
        + ' (' + zustand.laenge + ' × ' + util.dauer(proSchloss) + ', in Etappen verteilbar)';
    }

    // Den Notausgang gibt es in beiden Modi - nur zahlt er einmal in
    // Rechenzeit und einmal schlicht in Wartezeit.
    var exitMin = Number($('#notausgang-min').value);
    var exitMax = exitMin ? Math.max(exitMin, Number($('#notausgang-max').value)) : 0;
    var exitArt = ohneRechenzeit ? 'Wartezeit' : 'Rechenzeit';
    $('#notausgang-max-feld').classList.toggle('versteckt', !exitMin);
    $('#notausgang-spanne').textContent = !exitMin ? ''
      : exitMin === exitMax
        ? 'Feste Dauer: der Notausgang springt nach ' + util.dauer(exitMin) + ' ' + exitArt + ' auf.'
        : 'Die tatsächliche Dauer wird beim Verriegeln zufällig zwischen ' + util.dauer(exitMin)
          + ' und ' + util.dauer(exitMax) + ' gezogen. '
          + (ohneRechenzeit
              ? 'Angezeigt wird sie nicht – im Browser-Speicher steht sie allerdings, wie alles in diesem Modus.'
              : 'Gespeichert wird sie nicht – du erfährst sie erst, wenn er aufspringt.');
    $('#notausgang-aufwand').textContent = exitMax && !ohneRechenzeit ? rechenaufwand(exitMax) : '';
  }

  function schaetzungAktualisieren() {
    var anzeige = $('#schaetzung');
    if (!anzeige) return;
    var dimensionen = aktiveDimensionen();
    if (!dimensionen.length) { anzeige.textContent = '-'; return; }
    var konfig = konfigurationLesen();
    var ohneRechenzeit = !T.tresorLogik.rechenzeitModus(konfig);
    var schaetzung = T.tresorLogik.geschaetzteDauer(konfig, zustand.laenge);
    var rechen = ohneRechenzeit ? 0 : T.tresorLogik.RECHENZEIT_STUFEN[util.grenze(konfig.rechenzeit, 1, 5) - 1];
    anzeige.textContent = 'ungefähr ' + util.dauer(schaetzung.sekunden);
    $('#rechenzeit-feld').classList.toggle('versteckt', ohneRechenzeit);
    $('#reihenfolge-feld').classList.toggle('versteckt', zustand.art === 'foto');
    util.$$('#notausgang-min option, #notausgang-max option').forEach(function (option) {
      if (!option.dataset.sekunden) return;
      option.textContent = util.dauer(Number(option.dataset.sekunden))
        + (ohneRechenzeit ? ' Wartezeit' : ' Rechenzeit');
    });
    $('#sicherheit-hinweis').textContent = ohneRechenzeit
      ? 'Weniger sicher: Die Schlüssel liegen offen im Browser-Speicher, die Aufgaben sind Oberflächenhürden. Wer den Speicher liest, kommt sofort an das Geheimnis. Dafür kostet nichts Strom, und der Notausgang ist hier eine Wartezeit statt Rechenzeit. Antwortgebundene Rätsel wirken auch in diesem Modus, weil ihre Lösung in den Schlüssel eingeht.'
      : 'Sicher: Jedes Fragment kostet echte, nicht abkürzbare Rechenzeit - auch für jemanden mit Entwicklerwerkzeug.';
    var exitMinS = Math.min(konfig.notausgang.minSekunden, konfig.notausgang.maxSekunden);
    var exitMaxS = Math.max(konfig.notausgang.minSekunden, konfig.notausgang.maxSekunden);
    aufwandAktualisieren();
    $('#abschluss-warnung').textContent = ohneRechenzeit
      ? 'Der weniger sichere Modus hält niemanden auf, der den Browser-Speicher liest - er hält dich auf.'
        + (exitMaxS ? ' Der Notausgang öffnet nach ' + (exitMinS === exitMaxS ? util.dauer(exitMaxS)
            : util.dauer(exitMinS) + ' bis ' + util.dauer(exitMaxS)) + ' Wartezeit.' : '')
        + ' Löschen des Tresors löscht das Geheimnis.'
      : exitMaxS
      ? 'Ab hier führen nur noch die Aufgaben zur Zahl - oder der Notausgang, der '
        + (exitMinS === exitMaxS ? util.dauer(exitMaxS) : util.dauer(exitMinS) + ' bis ' + util.dauer(exitMaxS))
        + ' Rechenzeit kostet. Löschen des Tresors löscht die Zahl.'
      : 'Danach gibt es keinen Notausgang: Nur die Aufgaben und die Rechenzeit führen zur Zahl zurück. Löschen des Tresors löscht die Zahl.';
    $('#schaetzung-detail').textContent =
      zustand.laenge + ' Fragmente · ' + konfig.aufgabenProFragment
      + (konfig.aufgabenProFragment === 1 ? ' Aufgabe' : ' Aufgaben') + ' je Fragment · '
      + (rechen ? util.dauer(rechen) + ' reine Rechenzeit pro Zeitschloss' : 'ohne Zeitschloss')
      + (schaetzung.gebundeneAufgaben ? ' · ' + schaetzung.gebundeneAufgaben + ' Aufgaben gehen in die Schlüssel ein' : '')
      + (schaetzung.mitZeitfenster ? ' · enthält ein Zeitfenster, das an eine Tageszeit gebunden ist' : '')
      + (konfig.strafe ? ' · Strafzeiten aktiv' : '')
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
        el('p', { class: 'flaut', text: 'Die Zahl wird sofort in Fragmente zerlegt und verschlüsselt - eine Ziffer je Fragment. Im Klartext existiert sie danach nirgends mehr, auch nicht für diese App.' }),
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
          el('p', { class: 'flaut', text: 'Foto oder Screenshot mit der Zahl - gut ausgeleuchtet, Ziffern möglichst gerade. Der Vorschlag lässt sich danach korrigieren.' }),
          el('input', { type: 'file', accept: 'image/*', capture: 'environment', id: 'fotodatei' }),
          el('div', { id: 'foto-ergebnis' })
        ])
      ]),

      el('div', { id: 'art-bereich-foto', class: zustand.art === 'foto' ? '' : 'versteckt' }, [
        el('p', { class: 'flaut', text: 'Das Bild selbst ist das Geheimnis. Es wird in Schärfestufen zerlegt: Stufe 1 ist ein grober Farbfleck, die letzte das ganze Bild. Jede Stufe ist ein eigenes Fragment und wird für sich verschlüsselt.' }),
        el('input', { type: 'file', accept: 'image/*', id: 'bilddatei' }),
        el('div', { class: 'feld' }, [
          el('label', { for: 'bild-stufen', text: 'Schärfestufen' }),
          el('select', { id: 'bild-stufen' }, [3, 4, 5, 6, 7, 8].map(function (n) {
            return el('option', { value: String(n), selected: n === 5 ? 'selected' : null }, String(n) + ' Stufen');
          }))
        ]),
        el('div', { id: 'bild-ergebnis' })
      ])
    ]);

    var dimensionTeil = el('section', { class: 'karte' }, [
      el('h2', { text: '2 · Womit soll der Tresor dich aufhalten?' }),
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
      el('div', { class: 'feld' }, [
        el('label', { for: 'strafzeit', text: 'Strafzeit bei Fehlversuch' }),
        el('select', { id: 'strafzeit' }, [
          el('option', { value: '0' }, 'aus'),
          el('option', { value: '1' }, 'mild – ab 20 s, steigend'),
          el('option', { value: '2' }, 'hart – ab 60 s, steigend')
        ])
      ]),
      el('p', { class: 'flaut klein', text: 'Jeder weitere Fehlversuch derselben Aufgabe kostet das 1,7-Fache, höchstens 30 Minuten. Die Aufgabe ist währenddessen gesperrt.' }),
      el('label', { class: 'schalterzeile' }, [
        el('input', { type: 'checkbox', id: 'frist-aktiv' }),
        el('span', { text: 'Geheime Höchstzeit' })
      ]),
      el('p', { class: 'flaut klein', text: 'Beim Verriegeln wird eine Höchstzeit zufällig aus deiner Spanne gezogen. Angezeigt werden nur die Spanne und die verstrichene Zeit – der gezogene Wert nicht.' }),
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
        el('label', { for: 'notausgang-min', text: 'Notausgang – öffnet frühestens nach' }),
        el('select', { id: 'notausgang-min' }, [el('option', { value: '0' }, 'kein Notausgang')]
          .concat(T.tresorLogik.NOTAUSGANG_WERTE.map(function (sekunden) {
            var option = el('option', { value: String(sekunden) }, util.dauer(sekunden) + ' Rechenzeit');
            option.dataset.sekunden = String(sekunden);
            return option;
          })))
      ]),
      el('div', { class: 'feld', id: 'notausgang-max-feld' }, [
        el('label', { for: 'notausgang-max', text: '… und spätestens nach' }),
        el('select', { id: 'notausgang-max' }, T.tresorLogik.NOTAUSGANG_WERTE.map(function (sekunden) {
          var option = el('option', { value: String(sekunden), selected: sekunden === 7200 ? 'selected' : null },
            util.dauer(sekunden) + ' Rechenzeit');
          option.dataset.sekunden = String(sekunden);
          return option;
        }))
      ]),
      el('p', { class: 'flaut klein', id: 'notausgang-spanne', text: '' }),
      el('p', { class: 'flaut klein', text: 'Der Notausgang ist der zweite Weg zum ganzen Geheimnis, falls du an einer Aufgabe hängen bleibst: keine Aufgaben, nur Zeit. Wie lange genau, wird beim Verriegeln aus deiner Spanne gezogen.' }),
      el('p', { class: 'flaut klein aufwandzeile', id: 'notausgang-aufwand', text: '' })
    ]);

    var feinTeil = el('section', { class: 'karte' }, [
      el('h2', { text: '4 · Feineinstellung' }),
      el('div', { class: 'feld' }, [
        el('label', { for: 'aufgaben-pro-fragment', text: 'Aufgaben pro Fragment' }),
        el('input', { type: 'range', min: '1', max: '4', value: '2', id: 'aufgaben-pro-fragment' }),
        el('output', { id: 'aufgaben-anzeige', text: '2' })
      ]),
      el('div', { class: 'feld' }, [
        el('label', { for: 'sicherheit', text: 'Wie fest soll das Schloss sein?' }),
        el('select', { id: 'sicherheit' }, [
          el('option', { value: 'rechenzeit' }, 'sicher – Zeitschloss aus echter Rechenzeit'),
          el('option', { value: 'ohne-rechenzeit' }, 'weniger sicher – ohne Rechenzeit, nur Uhr und Aufgaben')
        ])
      ]),
      el('p', { class: 'flaut klein', id: 'sicherheit-hinweis', text: '' }),
      el('div', { class: 'feld', id: 'rechenzeit-feld' }, [
        el('label', { for: 'rechenzeit', text: 'Zeitschloss (echte Rechenzeit je Fragment)' }),
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
        el('span', { class: 'flaut', text: 'Voraussichtlicher Gesamtaufwand' }),
        el('strong', { id: 'schaetzung', text: '-' }),
        el('span', { class: 'flaut klein', id: 'schaetzung-detail', text: '' })
      ])
    ]);

    var abschluss = el('section', { class: 'karte' }, [
      el('p', { class: 'warnung', id: 'abschluss-warnung', text: '' }),
      el('button', { id: 'verriegeln', class: 'knopf gross haupt', type: 'button', disabled: 'disabled', text: 'Tresor verriegeln' }),
      el('p', { class: 'flaut', id: 'bereit-hinweis', text: '' })
    ]);

    wurzel.appendChild(geheimTeil);
    wurzel.appendChild(dimensionTeil);
    wurzel.appendChild(zeitTeil);
    wurzel.appendChild(feinTeil);
    wurzel.appendChild(abschluss);

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
    $('#bild-stufen').addEventListener('change', function () {
      if (zustand.bild && zustand.bild.datei) bildVerarbeiten({ target: { files: [zustand.bild.datei] } });
      schaetzungAktualisieren();
    });
    $('#reiter-tippen').addEventListener('click', function () { reiterWechsel('tippen'); });
    $('#reiter-foto').addEventListener('click', function () { reiterWechsel('foto'); });
    $('#fotodatei').addEventListener('change', fotoVerarbeiten);

    util.$$('.dimension-karte input[type=checkbox]').forEach(function (feld) {
      feld.addEventListener('change', function () { schaetzungAktualisieren(); pruefeBereit(); });
    });
    T.herausforderungen.dimensionen.forEach(function (dimension) {
      var regler = $('#stufe-' + dimension.id);
      if (!regler) return;
      regler.addEventListener('input', function () {
        $('#stufe-anzeige-' + dimension.id).textContent = regler.value;
        schaetzungAktualisieren();
      });
    });
    $('#strafzeit').addEventListener('change', schaetzungAktualisieren);
    $('#notausgang-min').addEventListener('change', schaetzungAktualisieren);
    $('#notausgang-max').addEventListener('change', schaetzungAktualisieren);
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
    $('#verriegeln').addEventListener('click', verriegeln);

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

  /* Bild einlesen und in Schärfestufen zerlegen. Gezeigt wird die gröbste
   * Stufe - so sieht man vorher, wie wenig das erste Fragment verrät. */
  async function bildVerarbeiten(ereignis) {
    var datei = ereignis.target.files && ereignis.target.files[0];
    if (!datei) return;
    var ziel = util.leeren($('#bild-ergebnis'));
    ziel.appendChild(el('p', { class: 'flaut', text: 'Bild wird zerlegt ...' }));
    try {
      var stufen = Number($('#bild-stufen').value);
      var ergebnis = await T.foto.stufenBilder(datei, stufen, 1280);
      ergebnis.datei = datei;
      zustand.bild = ergebnis;
      zustand.laenge = stufen;
      util.leeren(ziel);
      ziel.appendChild(el('div', { class: 'stufenreihe' }, ergebnis.stufen.map(function (stufe, i) {
        return el('figure', { class: 'stufenbild' }, [
          el('img', { src: stufe.bild, alt: 'Stufe ' + (i + 1) }),
          el('figcaption', { text: (i + 1) + ' · ' + stufe.breite + ' px' })
        ]);
      })));
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
    try {
      var tresor = await T.tresorLogik.erstellen({
        art: art,
        teile: teile,
        konfig: konfig,
        beiFortschritt: function (m) {
          $('#schmiede-text').textContent = m.text;
          if (typeof m.anteil === 'number') $('#schmiede-balken').style.width = (m.anteil * 100) + '%';
        }
      });
      zustand.geheimnis = '';
      zustand.bild = null;
      teile = null;
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
      var status = fragment.offen ? 'frei'
        : fragment === aktuell ? (offeneAufgaben ? offeneAufgaben + ' Aufgaben offen' : 'Zeitschloss läuft')
          : 'verriegelt';
      return el('li', {
        class: 'fragment' + (fragment.offen ? ' ist-offen' : fragment === aktuell ? ' ist-aktuell' : '')
      }, [
        el('div', { class: 'fragment-kopf' }, [
          el('strong', { text: 'Fragment ' + (fragment.index + 1) }),
          el('span', { class: 'status', text: status })
        ]),
        el('ul', { class: 'aufgabenliste' }, fragment.aufgaben.map(function (aufgabe) {
          var modul = T.herausforderungen.hole(aufgabe.id);
          return el('li', { class: aufgabe.erledigt ? 'ist-erledigt' : '' }, [
            el('span', { class: 'marke marke-' + aufgabe.dimension, text: dimensionName(aufgabe.dimension) }),
            modul.name + ': ' + modul.beschreibe(aufgabe.params),
            modul.antwortGebunden ? el('span', { class: 'schluesselmarke', title: 'Antwort geht in den Schlüssel ein', text: ' 🔑' }) : null,
            aufgabe.frist ? el('span', { class: 'schluesselmarke', title: 'Geheime Frist', text: ' ⏳' }) : null
          ]);
        }).concat(fragment.schloss ? [
          el('li', { class: fragment.offen ? 'ist-erledigt' : '' }, [
            el('span', { class: 'marke marke-zeit', text: 'Zeit' }),
            'Zeitschloss: ' + util.dauer(zustand.tresor.sekundenProSchloss) + ' Rechenzeit'
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
      zustand.fristMeldung = 'Die geheime Höchstzeit ist abgelaufen. '
        + bericht.fragmente + (bericht.fragmente === 1 ? ' verschlossenes Fragment fällt' : ' verschlossene Fragmente fallen')
        + ' auf Anfang zurück'
        + (bericht.aufgaben ? ' (' + bericht.aufgaben + ' erledigte Aufgaben)' : '')
        + (bericht.rechenzeitVerfallen && bericht.schritte
            ? ', dazu verfallen ' + bericht.schritte.toLocaleString('de-DE') + ' Rechenschritte' : '')
        + '. Eine neue Höchstzeit läuft ab jetzt.';
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
      el('p', { class: 'flaut mittig-text', text: fertig
        ? 'Vollständig freigegeben.'
        : (tresor.fragmente.filter(function (f) { return f.offen; }).length) + ' von ' + tresor.laenge + ' Fragmenten frei' })
    ]));

    if (fertig) {
      // Ergebnis in den Verlauf legen, bevor irgendetwas es überschreiben kann
      if (!tresor.archiviert) {
        tresor.archiviert = T.speicher.archivErgaenzen(T.tresorLogik.archivEintrag(tresor));
        sichern(true);
      }
      var bild = tresor.art === 'foto' ? (T.tresorLogik.besteStufe(tresor) || {}).bild : null;
      wurzel.appendChild(el('section', { class: 'karte mittig' }, [
        el('h2', { text: 'Dein Geheimnis' }),
        bild
          ? el('img', { class: 'ergebnisbild', src: bild, alt: 'Das freigegebene Bild' })
          : el('p', { class: 'grossezahl', text: T.tresorLogik.sichtbaresGeheimnis(tresor).join('') }),
        bild ? el('a', { class: 'knopf', href: bild, download: 'tresor-bild.jpg' }, 'Bild sichern') : null,
        el('p', { class: 'flaut', text: 'Erstellt ' + util.zeitpunkt(tresor.erstellt) + '. Das Ergebnis liegt jetzt auch im Verlauf.' }),
        el('button', { class: 'knopf gross', type: 'button', text: 'Neuen Tresor anlegen', onclick: neuAnlegen })
      ]));
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

    if (!fertig && tresor.notausgang && !tresor.notausgang.benutzt) {
      wurzel.appendChild(notausgangKarte(tresor));
      exitAnzeigeAktualisieren();          // erst jetzt hängt die Karte im Dokument
    }

    wurzel.appendChild(el('section', { class: 'karte' }, [
      el('h2', { text: 'Fahrplan' }),
      fragmentUebersicht()
    ]));

    wurzel.appendChild(el('section', { class: 'karte flaut klein' }, [
      el('p', { text: tresor.fragmente[0].schloss
        ? 'Zeitschlösser dieses Tresors: ' + tresor.fragmente[0].schloss.t.toLocaleString('de-DE')
          + ' sequentielle Quadrierungen modulo einer 1024-Bit-Zahl, gemessen mit '
          + (tresor.rate || 0).toLocaleString('de-DE') + ' Quadrierungen/s auf diesem Gerät.'
        : 'Weniger sicherer Modus: kein Zeitschloss. Die Schlüsselanteile liegen offen im Browser-Speicher, '
          + 'die Aufgaben sind Oberflächenhürden.' }),
      el('p', { text: gebundeneAufgaben(tresor)
        ? gebundeneAufgaben(tresor) + ' Aufgaben sind an den Schlüssel gebunden: ihre Lösung ist nicht gespeichert, nur ein Prüfwert mit '
          + (tresor.fragmente[0].iterationen || 0).toLocaleString('de-DE') + ' PBKDF2-Runden. Jeder Rateversuch kostet diese Rechnung.'
        : tresor.fragmente[0].schloss
          ? 'Keine antwortgebundenen Aufgaben – die Aufgaben sind reine Oberflächenhürden, kryptografisch bindend ist nur die Rechenzeit.'
          : 'Keine antwortgebundenen Aufgaben und kein Zeitschloss – dieser Tresor ist reine Selbstbindung.' }),
      el('button', { class: 'knopf gefahr', type: 'button', text: 'Tresor löschen', onclick: tresorLoeschen })
    ]));

    var verlauf = verlaufKarte();
    if (verlauf) wurzel.appendChild(verlauf);
  }

  /* Wie lange der Notausgang dauert - bei blinden Schlössern ist das
   * absichtlich eine Spanne und keine Zahl. */
  function notausgangSpanne(exit) {
    var rahmen = exit.rahmen || [0, 0];
    if (exit.art === 'wartezeit') {
      if (rahmen[0] === rahmen[1]) return 'Er öffnet ' + util.dauer(rahmen[1]) + ' nach dem Verriegeln.';
      return 'Wann, steht nicht fest: irgendwann zwischen ' + util.dauer(rahmen[0]) + ' und '
        + util.dauer(rahmen[1]) + ' nach dem Verriegeln, beim Verriegeln zufällig gezogen. '
        + 'Angezeigt wird der Termin nicht – im Browser-Speicher steht er, wie alles in diesem Modus.';
    }
    if (!exit.blind) return 'Rund ' + util.dauer(exit.sekunden) + ', damit bleibst du höchstens so lange ausgesperrt.';
    if (rahmen[0] === rahmen[1]) return 'Rund ' + util.dauer(rahmen[1]) + ' Rechenzeit.';
    return 'Wie lange, steht nicht fest: irgendwo zwischen ' + util.dauer(rahmen[0]) + ' und '
      + util.dauer(rahmen[1]) + ' Rechenzeit, beim Verriegeln zufällig gezogen und nirgends gespeichert.';
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
    if (!exit || exit.benutzt || exit.art === 'wartezeit' || zustand.exitLoeser) return;
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
      return T.tresorLogik.notausgangOeffnen(tresor, b).then(function () {
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
    if (wachhalter.sperre) bildschirmWachHalten(false);
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
    var exit = tresor.notausgang;
    var erledigt = exit.stand.erledigt;
    var obergrenze = exit.schloss.obergrenze || exit.schloss.t || 1;
    var untergrenze = exit.schloss.untergrenze || 0;
    teile.fuellung.style.width = (Math.min(1, erledigt / obergrenze) * 100).toFixed(2) + '%';
    teile.anzeige.textContent = util.dauer(erledigt / (tresor.rate || 1));
    teile.text.textContent = erledigt.toLocaleString('de-DE') + ' Schritte · '
      + (untergrenze && erledigt < untergrenze
          ? 'frühestens ab ' + util.dauer(untergrenze / (tresor.rate || 1)) + ' kann es aufspringen'
          : 'kann jederzeit aufspringen');
    teile.knopf.textContent = notausgangLaeuft() ? 'Anhalten' : 'Rechnen starten';
    teile.zustandstext.textContent = notausgangLaeuft()
      ? 'Rechnet im Hintergrund – auch während du an den Aufgaben arbeitest, solange diese Seite offen bleibt.'
      : 'Angehalten. Der Zwischenstand bleibt erhalten.';
  }

  /* Die Karte auf dem Tresor-Bildschirm. Sie steuert den Notausgang, hält ihn
   * aber nicht am Leben - das tut der Löser selbst. */
  function notausgangKarte(tresor) {
    var exit = tresor.notausgang;
    if (T.tresorLogik.notausgangUhrPruefen(tresor)) sichern(true);
    var karte = el('section', { class: 'karte notausgang-karte' }, [
      el('h2', { text: 'Notausgang' }),
      el('p', { class: 'flaut', text: 'Der zweite Weg zum ganzen Geheimnis, falls du hängen bleibst. '
        + notausgangSpanne(exit) })
    ]);

    if (exit.art === 'wartezeit') {
      var bereit = T.tresorLogik.notausgangBereit(tresor);
      var verstrichen = el('strong', { class: 'fristzeit',
        text: util.dauer((Date.now() - tresor.erstellt) / 1000) });
      karte.appendChild(el('p', {}, ['verstrichen: ', verstrichen]));
      var oeffnen = el('button', { class: 'knopf gross haupt', type: 'button', text: 'Geheimnis freigeben' });
      oeffnen.disabled = !bereit;
      oeffnen.addEventListener('click', function () {
        if (oeffnen.disabled) return;
        oeffnen.disabled = true;
        T.tresorLogik.notausgangOeffnen(tresor, null).then(function () {
          sichern(true);
          zeichneTresor();
        }).catch(function (fehler) {
          karte.appendChild(el('p', { class: 'warnung', text: 'Entschlüsseln fehlgeschlagen: ' + fehler.message }));
        });
      });
      karte.appendChild(oeffnen);
      karte.appendChild(el('p', { class: 'flaut klein', text: bereit
        ? 'Der Notausgang ist offen.'
        : 'Noch zu. Die Uhr läuft weiter, auch wenn die App geschlossen ist.' }));
      if (!bereit) {
        zustand.exitUhr = setInterval(function () {
          if (T.tresorLogik.notausgangBereit(tresor)) { zeichneTresor(); return; }
          verstrichen.textContent = util.dauer((Date.now() - tresor.erstellt) / 1000);
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
    var knopf = el('button', { class: 'knopf', type: 'button', text: 'Rechnen starten' });
    var zustandstext = el('p', { class: 'flaut klein', text: '' });
    knopf.addEventListener('click', function () {
      if (notausgangLaeuft()) notausgangAnhalten(); else notausgangStarten();
    });

    karte.appendChild(el('p', { class: 'flaut klein', text: 'bisher gerechnet' }));
    karte.appendChild(anzeige);
    karte.appendChild(balken);
    karte.appendChild(text);
    karte.appendChild(knopf);
    var schalter = wachSchalter();
    if (schalter) karte.appendChild(schalter);
    karte.appendChild(zustandstext);

    zustand.exitAnzeige = { wurzel: karte, anzeige: anzeige, fuellung: fuellung, text: text,
      knopf: knopf, zustandstext: zustandstext };
    return karte;
  }


  /* ---------------- Verlauf ---------------- */

  function verlaufKarte() {
    var liste = T.speicher.archivLaden();
    if (!liste.length) return null;
    return el('section', { class: 'karte' }, [
      el('h2', { text: 'Verlauf' }),
      el('p', { class: 'flaut klein', text: 'Geöffnete Tresore liegen hier, bis du sie löschst – ein geschlossener Tab oder ein neuer Tresor nimmt das Ergebnis nicht mit. Unverschlüsselt, denn der Tresor war ja offen.' }),
      el('ul', { class: 'verlaufliste' }, liste.map(function (eintrag) {
        return el('li', { class: 'verlaufzeile' }, [
          eintrag.art === 'foto'
            ? el('img', { class: 'verlaufbild', src: eintrag.ergebnis, alt: 'Ergebnisbild' })
            : el('span', { class: 'verlaufzahl', text: eintrag.ergebnis }),
          el('div', { class: 'verlaufinfo' }, [
            el('strong', { text: eintrag.art === 'foto' ? 'Bild, ' + eintrag.stufen + ' Stufen' : eintrag.ergebnis.length + '-stellige Zahl' }),
            el('span', { class: 'flaut klein', text: 'geöffnet ' + util.zeitpunkt(eintrag.geoeffnet)
              + ' · ' + (eintrag.sicherheit === 'rechenzeit' ? 'mit Zeitschloss' : 'ohne Rechenzeit')
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
    var fragment = T.tresorLogik.aktuellesFragment(tresor);
    if (!fragment) return;
    var aufgabe = T.tresorLogik.offeneAufgabe(fragment);

    var kopf = el('div', { class: 'aufgaben-kopf' }, [
      el('span', { class: 'flaut', text: 'Fragment ' + (fragment.index + 1) + ' von ' + tresor.laenge }),
      el('span', { class: 'flaut', text: aufgabe
        ? 'Aufgabe ' + (fragment.aufgaben.indexOf(aufgabe) + 1) + ' von ' + fragment.aufgaben.length
        : 'Zeitschloss' })
    ]);
    util.leeren(karte).appendChild(kopf);
    var buehne = el('div', { class: 'aufgaben-buehne' });
    karte.appendChild(buehne);

    if (aufgabe) {
      var modul = T.herausforderungen.hole(aufgabe.id);
      if (aufgabe.zustand.strafeBis && Date.now() < aufgabe.zustand.strafeBis) {
        strafBuehne(buehne, aufgabe);
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
        speichern: function () { sichern(false); },
        fertig: function () {
          if (beendet) return;
          beendet = true;
          aufgabe.erledigt = true;
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
          aufgabe.zustand.fehlversuche = (aufgabe.zustand.fehlversuche || 0) + 1;
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

      var aufraeumenAufgabe = modul.starte(kontext);
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
      T.tresorLogik.fragmentOeffnen(zustand.tresor, fragment, null).then(function () {
        sichern(true);
        zeichneTresor();
      }).catch(function (fehler) {
        buehne.appendChild(el('p', { class: 'warnung', text: 'Entschlüsseln fehlgeschlagen: ' + fehler.message }));
      });
    });
  }

  /* Gesperrte Aufgabe: Strafzeit absitzen. */
  function strafBuehne(buehne, aufgabe) {
    var modul = T.herausforderungen.hole(aufgabe.id);
    util.leeren(buehne);
    buehne.appendChild(el('p', { class: 'aufgabe-titel', text: 'Strafzeit' }));
    buehne.appendChild(el('p', { class: 'aufgabe-hinweis', text:
      (aufgabe.zustand.strafGrund ? aufgabe.zustand.strafGrund + ' ' : '')
      + 'Die Aufgabe „' + modul.name + '“ ist gesperrt. Fehlversuch Nummer ' + aufgabe.zustand.fehlversuche + '.' }));
    var anzeige = el('div', { class: 'countdown', text: '--:--' });
    buehne.appendChild(anzeige);
    var uhr = setInterval(function () {
      var rest = (aufgabe.zustand.strafeBis - Date.now()) / 1000;
      anzeige.textContent = util.uhrwerk(rest);
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
    buehne.appendChild(el('p', { class: 'aufgabe-titel', text: 'Zeitschloss' }));
    buehne.appendChild(el('p', { class: 'aufgabe-hinweis', text:
      'Jetzt arbeitet der Rechner: ' + schritteGesamt.toLocaleString('de-DE') + ' Quadrierungen, die nur nacheinander gehen. '
      + 'Mehr Kerne helfen nicht, nur verstrichene Zeit. Ausgelastet ist genau ein Kern, das Gerät bleibt benutzbar. '
      + 'Der Fortschritt wird gespeichert - du darfst die Seite schließen.' }));

    var anzeige = el('div', { class: 'countdown', text: '--:--' });
    var fuellung = el('i');
    var text = el('span', { class: 'balken-text', text: '' });
    var knopf = el('button', { class: 'knopf gross haupt', type: 'button', text: 'Rechnen starten' });
    buehne.appendChild(anzeige);
    buehne.appendChild(el('div', { class: 'balken' }, [fuellung]));
    buehne.appendChild(text);
    buehne.appendChild(knopf);
    var schalter = wachSchalter();
    if (schalter) buehne.appendChild(schalter);

    var laeuft = false, startZeit = 0, startSchritte = fragment.stand.erledigt;

    function zeichneStand(erledigt) {
      var anteil = erledigt / schritteGesamt;
      fuellung.style.width = (anteil * 100).toFixed(2) + '%';
      var rate = laeuft && Date.now() > startZeit
        ? (erledigt - startSchritte) / ((Date.now() - startZeit) / 1000)
        : zustand.tresor.rate;
      var rest = rate > 0 ? (schritteGesamt - erledigt) / rate : 0;
      anzeige.textContent = laeuft ? util.uhrwerk(rest) : util.uhrwerk(rest) + ' (pausiert)';
      text.textContent = erledigt.toLocaleString('de-DE') + ' von ' + schritteGesamt.toLocaleString('de-DE')
        + ' Schritten · ' + (anteil * 100).toFixed(1) + ' %';
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
        if (!b) { laeuft = false; knopf.textContent = 'Weiterrechnen'; zeichneStand(fragment.stand.erledigt); sichern(true); return; }
        zustand.loeser = null;
        return T.tresorLogik.fragmentOeffnen(zustand.tresor, fragment, b).then(function () {
          sichern(true);
          zeichneTresor();
        });
      }).catch(function (fehler) {
        laeuft = false;
        buehne.appendChild(el('p', { class: 'warnung', text: 'Rechenfehler: ' + fehler.message }));
      });
    }

    function anhalten() {
      if (!zustand.loeser) return;
      laeuft = false;
      knopf.textContent = 'Weiterrechnen';
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

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { sichern(true); return; }
      if (wachhalter.gewuenscht && !wachhalter.sperre) bildschirmWachHalten(true);
    });
    global.addEventListener('pagehide', function () { sichern(true); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(typeof window !== 'undefined' ? window : globalThis);
