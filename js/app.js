/* Oberfläche und Ablauf. */
(function (global) {
  'use strict';
  var T = global.Tresor;
  var util = T.util, el = util.el, $ = util.$;

  var zustand = {
    tresor: null,
    konfig: null,
    geheimnis: '',
    laenge: 5,
    aufraeumen: null,
    loeser: null,
    letzteSicherung: 0,
    fotoErgebnis: null
  };

  /* ---------------- Speichern ---------------- */

  function sichern(erzwingen) {
    if (!zustand.tresor) return;
    var jetzt = Date.now();
    if (!erzwingen && jetzt - zustand.letzteSicherung < 1500) return;
    zustand.letzteSicherung = jetzt;
    T.speicher.sichern(zustand.tresor);
  }

  function aufraeumen() {
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

  function pruefeBereit() {
    var knopf = $('#verriegeln');
    if (!knopf) return;
    var vollstaendig = /^\d+$/.test(zustand.geheimnis) && zustand.geheimnis.length === zustand.laenge;
    var dimensionen = aktiveDimensionen();
    knopf.disabled = !(vollstaendig && dimensionen.length);
    $('#bereit-hinweis').textContent = !vollstaendig
      ? 'Es fehlen noch Ziffern.'
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
    return {
      dimensionen: aktiveDimensionen(),
      stufen: stufen,
      aufgabenProFragment: Number($('#aufgaben-pro-fragment').value),
      rechenzeit: Number($('#rechenzeit').value),
      reihenfolge: $('#reihenfolge').value
    };
  }

  function schaetzungAktualisieren() {
    var anzeige = $('#schaetzung');
    if (!anzeige) return;
    var dimensionen = aktiveDimensionen();
    if (!dimensionen.length) { anzeige.textContent = '-'; return; }
    var konfig = konfigurationLesen();
    var schaetzung = T.tresorLogik.geschaetzteDauer(konfig, zustand.laenge);
    var rechen = T.tresorLogik.RECHENZEIT_STUFEN[util.grenze(konfig.rechenzeit, 1, 5) - 1];
    anzeige.textContent = 'ungefähr ' + util.dauer(schaetzung.sekunden);
    $('#schaetzung-detail').textContent =
      zustand.laenge + ' Fragmente · ' + konfig.aufgabenProFragment
      + (konfig.aufgabenProFragment === 1 ? ' Aufgabe' : ' Aufgaben') + ' je Fragment · '
      + util.dauer(rechen) + ' reine Rechenzeit pro Zeitschloss'
      + (schaetzung.mitZeitfenster ? ' · enthält ein Zeitfenster, das an eine Tageszeit gebunden ist' : '');
  }

  function zeichneEinrichten() {
    aufraeumen();
    var wurzel = util.leeren($('#buehne'));
    var dimensionen = T.herausforderungen.dimensionen;

    var geheimTeil = el('section', { class: 'karte' }, [
      el('h2', { text: '1 · Das Geheimnis' }),
      el('p', { class: 'flaut', text: 'Die Zahl wird sofort in Fragmente zerlegt und verschlüsselt. Im Klartext existiert sie danach nirgends mehr - auch nicht für diese App.' }),
      el('div', { class: 'reiter' }, [
        el('button', { class: 'reiter-knopf ist-aktiv', type: 'button', id: 'reiter-tippen', text: 'Tippen' }),
        el('button', { class: 'reiter-knopf', type: 'button', id: 'reiter-foto', text: 'Foto' })
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
    ]);

    var dimensionTeil = el('section', { class: 'karte' }, [
      el('h2', { text: '2 · Womit soll der Tresor dich aufhalten?' }),
      el('div', { class: 'dimension-gitter' }, dimensionen.map(function (dimension) {
        var module = T.herausforderungen.nachDimension(dimension.id);
        var kasten = el('label', { class: 'dimension-karte' + (dimension.fertig ? '' : ' ist-geplant') }, [
          el('div', { class: 'dimension-kopf' }, [
            el('input', {
              type: 'checkbox', value: dimension.id,
              checked: dimension.fertig ? 'checked' : null,
              disabled: dimension.fertig ? null : 'disabled'
            }),
            el('strong', { text: dimension.name }),
            dimension.fertig ? el('span', { class: 'zaehler', text: module.length + ' Typen' })
              : el('span', { class: 'zaehler', text: 'geplant' })
          ]),
          el('p', { class: 'flaut', text: dimension.beschreibung })
        ]);
        if (dimension.fertig) {
          kasten.appendChild(el('div', { class: 'stufenzeile' }, [
            el('span', { class: 'flaut', text: 'Intensität' }),
            el('input', { type: 'range', min: '1', max: '5', value: '3', id: 'stufe-' + dimension.id }),
            el('output', { id: 'stufe-anzeige-' + dimension.id, text: '3' })
          ]));
          kasten.appendChild(el('ul', { class: 'typenliste' }, module.map(function (m) {
            return el('li', { text: m.name + ' - ' + m.kurz });
          })));
        }
        return kasten;
      }))
    ]);

    var feinTeil = el('section', { class: 'karte' }, [
      el('h2', { text: '3 · Feineinstellung' }),
      el('div', { class: 'feld' }, [
        el('label', { for: 'aufgaben-pro-fragment', text: 'Aufgaben pro Fragment' }),
        el('input', { type: 'range', min: '1', max: '4', value: '2', id: 'aufgaben-pro-fragment' }),
        el('output', { id: 'aufgaben-anzeige', text: '2' })
      ]),
      el('div', { class: 'feld' }, [
        el('label', { for: 'rechenzeit', text: 'Zeitschloss (echte Rechenzeit je Fragment)' }),
        el('input', { type: 'range', min: '1', max: '5', value: '2', id: 'rechenzeit' }),
        el('output', { id: 'rechenzeit-anzeige', text: '45 s' })
      ]),
      el('div', { class: 'feld' }, [
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
      el('p', { class: 'warnung', text: 'Danach gibt es keinen Notausgang: Nur die Aufgaben und die Rechenzeit führen zur Zahl zurück. Löschen des Tresors löscht die Zahl.' }),
      el('button', { id: 'verriegeln', class: 'knopf gross haupt', type: 'button', disabled: 'disabled', text: 'Tresor verriegeln' }),
      el('p', { class: 'flaut', id: 'bereit-hinweis', text: '' })
    ]);

    wurzel.appendChild(geheimTeil);
    wurzel.appendChild(dimensionTeil);
    wurzel.appendChild(feinTeil);
    wurzel.appendChild(abschluss);

    ziffernFelder($('#ziffernfelder'));

    $('#laenge').addEventListener('change', function () {
      zustand.laenge = Number(this.value);
      zustand.geheimnis = zustand.geheimnis.slice(0, zustand.laenge);
      ziffernFelder($('#ziffernfelder'));
      schaetzungAktualisieren(); pruefeBereit();
    });

    $('#reiter-tippen').addEventListener('click', function () { reiterWechsel('tippen'); });
    $('#reiter-foto').addEventListener('click', function () { reiterWechsel('foto'); });
    $('#fotodatei').addEventListener('change', fotoVerarbeiten);

    util.$$('.dimension-karte input[type=checkbox]').forEach(function (feld) {
      feld.addEventListener('change', function () { schaetzungAktualisieren(); pruefeBereit(); });
    });
    ['geduld', 'zeit'].forEach(function (dimension) {
      var regler = $('#stufe-' + dimension);
      if (!regler) return;
      regler.addEventListener('input', function () {
        $('#stufe-anzeige-' + dimension).textContent = regler.value;
        schaetzungAktualisieren();
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
    $('#reihenfolge').addEventListener('change', schaetzungAktualisieren);
    $('#verriegeln').addEventListener('click', verriegeln);

    schaetzungAktualisieren();
    pruefeBereit();
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
    var wurzel = util.leeren($('#buehne'));
    var kasten = el('section', { class: 'karte mittig' }, [
      el('h2', { text: 'Wird verriegelt' }),
      el('p', { class: 'flaut', id: 'schmiede-text', text: 'Einen Moment ...' }),
      el('div', { class: 'balken' }, [el('i', { id: 'schmiede-balken' })])
    ]);
    wurzel.appendChild(kasten);
    try {
      var tresor = await T.tresorLogik.erstellen({
        geheimnis: zustand.geheimnis,
        konfig: konfig,
        beiFortschritt: function (m) {
          $('#schmiede-text').textContent = m.text;
          if (typeof m.anteil === 'number') $('#schmiede-balken').style.width = (m.anteil * 100) + '%';
        }
      });
      zustand.geheimnis = '';
      zustand.tresor = tresor;
      T.speicher.sichern(tresor);
      zeichneTresor();
    } catch (fehler) {
      util.leeren(kasten).appendChild(el('p', { class: 'warnung', text: 'Verriegeln fehlgeschlagen: ' + fehler.message }));
    }
  }

  /* ---------------- Tresoransicht ---------------- */

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
            el('span', { class: 'marke marke-' + aufgabe.dimension, text: modul.dimension }),
            modul.name + ': ' + modul.beschreibe(aufgabe.params)
          ]);
        }).concat([
          el('li', { class: fragment.offen ? 'ist-erledigt' : '' }, [
            el('span', { class: 'marke marke-zeit', text: 'zeit' }),
            'Zeitschloss: ' + util.dauer(zustand.tresor.sekundenProSchloss) + ' Rechenzeit'
          ])
        ]))
      ]);
    }));
  }

  function zeichneTresor() {
    aufraeumen();
    var tresor = zustand.tresor;
    var wurzel = util.leeren($('#buehne'));
    var fertig = T.tresorLogik.alleOffen(tresor);

    wurzel.appendChild(el('section', { class: 'karte band-karte' }, [
      zeichneZiffernband(),
      el('p', { class: 'flaut mittig-text', text: fertig
        ? 'Vollständig freigegeben.'
        : (tresor.fragmente.filter(function (f) { return f.offen; }).length) + ' von ' + tresor.laenge + ' Fragmenten frei' })
    ]));

    if (fertig) {
      wurzel.appendChild(el('section', { class: 'karte mittig' }, [
        el('h2', { text: 'Dein Geheimnis' }),
        el('p', { class: 'grossezahl', text: T.tresorLogik.sichtbaresGeheimnis(tresor).join('') }),
        el('p', { class: 'flaut', text: 'Erstellt ' + util.zeitpunkt(tresor.erstellt) + '.' }),
        el('button', { class: 'knopf gross', type: 'button', text: 'Neuen Tresor anlegen', onclick: neuAnlegen })
      ]));
    } else {
      var aufgabenKarte = el('section', { class: 'karte aufgabenkarte', id: 'aufgabenkarte' });
      wurzel.appendChild(aufgabenKarte);
      starteAktuelles(aufgabenKarte);
    }

    wurzel.appendChild(el('section', { class: 'karte' }, [
      el('h2', { text: 'Fahrplan' }),
      fragmentUebersicht()
    ]));

    wurzel.appendChild(el('section', { class: 'karte flaut klein' }, [
      el('p', { text: 'Zeitschlösser dieses Tresors: ' + tresor.fragmente[0].schloss.t.toLocaleString('de-DE')
        + ' sequentielle Quadrierungen modulo einer 1024-Bit-Zahl, gemessen mit '
        + tresor.rate.toLocaleString('de-DE') + ' Quadrierungen/s auf diesem Gerät.' }),
      el('button', { class: 'knopf gefahr', type: 'button', text: 'Tresor löschen', onclick: tresorLoeschen })
    ]));
  }

  function neuAnlegen() {
    if (!global.confirm('Neuen Tresor anlegen? Der bestehende wird gelöscht.')) return;
    T.speicher.loeschen();
    zustand.tresor = null;
    zustand.geheimnis = '';
    zeichneEinrichten();
  }

  function tresorLoeschen() {
    if (!global.confirm('Tresor endgültig löschen? Die Zahl ist danach nicht mehr rekonstruierbar.')) return;
    aufraeumen();
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
      if (!aufgabe.zustand.__begonnen) {
        if (modul.aktiviere) modul.aktiviere(aufgabe.params, aufgabe.zustand);
        aufgabe.zustand.__begonnen = Date.now();
        sichern(true);
      }
      zustand.aufraeumen = modul.starte({
        wurzel: buehne,
        params: aufgabe.params,
        zustand: aufgabe.zustand,
        speichern: function () { sichern(false); },
        fertig: function () {
          aufgabe.erledigt = true;
          sichern(true);
          zeichneTresor();
        }
      });
    } else {
      zeitschlossBuehne(buehne, fragment);
    }
  }

  function zeitschlossBuehne(buehne, fragment) {
    var schritteGesamt = fragment.schloss.t;
    util.leeren(buehne);
    buehne.appendChild(el('p', { class: 'aufgabe-titel', text: 'Zeitschloss' }));
    buehne.appendChild(el('p', { class: 'aufgabe-hinweis', text:
      'Jetzt arbeitet der Rechner: ' + schritteGesamt.toLocaleString('de-DE') + ' Quadrierungen, die nur nacheinander gehen. '
      + 'Mehr Kerne helfen nicht, nur verstrichene Zeit. Der Fortschritt wird gespeichert - du darfst die Seite schließen.' }));

    var anzeige = el('div', { class: 'countdown', text: '--:--' });
    var fuellung = el('i');
    var text = el('span', { class: 'balken-text', text: '' });
    var knopf = el('button', { class: 'knopf gross haupt', type: 'button', text: 'Rechnen starten' });
    buehne.appendChild(anzeige);
    buehne.appendChild(el('div', { class: 'balken' }, [fuellung]));
    buehne.appendChild(text);
    buehne.appendChild(knopf);

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
    } else {
      zeichneEinrichten();
    }

    document.addEventListener('visibilitychange', function () { if (document.hidden) sichern(true); });
    global.addEventListener('pagehide', function () { sichern(true); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(typeof window !== 'undefined' ? window : globalThis);
