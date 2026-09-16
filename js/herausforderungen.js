/* Katalog der Herausforderungen.
 *
 * Jede Herausforderung ist ein kleines Modul mit drei Aufgaben:
 *   erzeuge(zufall, stufe) -> Parameter (jedes Mal andere Zahlen)
 *   schaetzung(params)     -> grobe Dauer in Sekunden, für die Vorschau
 *   starte(kontext)        -> baut die Oberfläche, meldet Erfolg/Fehlschlag
 *
 * Neue Dimensionen (Logik, Rätsel, Konzentration) hängen sich mit
 * genau derselben Signatur ein - der Tresor kennt nur die Registry. */
(function (global) {
  'use strict';
  var T = global.Tresor || (global.Tresor = {});
  var util = T.util;
  var el = util.el;

  var katalog = {};
  var reihenfolge = [];

  function registrieren(modul) {
    katalog[modul.id] = modul;
    reihenfolge.push(modul.id);
  }

  function nachDimension(dimension) {
    return reihenfolge.map(function (id) { return katalog[id]; })
      .filter(function (m) { return m.dimension === dimension; });
  }

  /* ---------- gemeinsame Bausteine der Oberfläche ---------- */

  function buehne(kontext, titel, hinweis) {
    var wurzel = util.leeren(kontext.wurzel);
    wurzel.appendChild(el('p', { class: 'aufgabe-titel', text: titel }));
    if (hinweis) wurzel.appendChild(el('p', { class: 'aufgabe-hinweis', text: hinweis }));
    var koerper = el('div', { class: 'aufgabe-koerper' });
    wurzel.appendChild(koerper);
    var meldung = el('p', { class: 'aufgabe-meldung', role: 'status' });
    wurzel.appendChild(meldung);
    return {
      koerper: koerper,
      sag: function (text, art) {
        meldung.textContent = text || '';
        meldung.className = 'aufgabe-meldung' + (art ? ' ist-' + art : '');
      }
    };
  }

  function balken(koerper, beschriftung) {
    var fuellung = el('i');
    var text = el('span', { class: 'balken-text', text: beschriftung || '' });
    koerper.appendChild(el('div', { class: 'balken' }, [fuellung]));
    koerper.appendChild(text);
    return {
      setze: function (anteil) { fuellung.style.width = util.grenze(anteil, 0, 1) * 100 + '%'; },
      text: function (t) { text.textContent = t; }
    };
  }

  function takt(rueckruf) {
    var laeuft = true, letzte = performance.now();
    function schritt(jetzt) {
      if (!laeuft) return;
      var delta = (jetzt - letzte) / 1000;
      letzte = jetzt;
      rueckruf(delta, jetzt);
      if (laeuft) requestAnimationFrame(schritt);
    }
    requestAnimationFrame(schritt);
    return function () { laeuft = false; };
  }

  function ton(frequenz, dauer) {
    try {
      var Kontext = global.AudioContext || global.webkitAudioContext;
      if (!Kontext) return;
      ton.ctx = ton.ctx || new Kontext();
      var o = ton.ctx.createOscillator(), g = ton.ctx.createGain();
      o.frequency.value = frequenz; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, ton.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.18, ton.ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ton.ctx.currentTime + dauer);
      o.connect(g); g.connect(ton.ctx.destination);
      o.start(); o.stop(ton.ctx.currentTime + dauer + 0.05);
    } catch (fehler) { /* Ton ist Beiwerk */ }
  }

  function jitter(zufall, wert, anteil) {
    return Math.round(wert * zufall.bereich(1 - anteil, 1 + anteil));
  }

  function proStufe(stufe, werte) { return werte[util.grenze(stufe, 1, werte.length) - 1]; }

  /* =====================  DIMENSION: GEDULD  ===================== */

  registrieren({
    id: 'halten',
    dimension: 'geduld',
    name: 'Stillhalten',
    kurz: 'Knopf gedrückt halten, ohne loszulassen',
    erzeuge: function (zufall, stufe) {
      return { sekunden: jitter(zufall, proStufe(stufe, [15, 25, 40, 70, 110]), 0.2) };
    },
    schaetzung: function (p) { return p.sekunden + 10; },
    beschreibe: function (p) { return 'Knopf ' + util.dauer(p.sekunden) + ' halten'; },
    starte: function (kontext) {
      var p = kontext.params;
      var b = buehne(kontext, 'Halte durch', 'Finger auf den Knopf und ' + util.dauer(p.sekunden) + ' nicht loslassen. Loslassen setzt zurück.');
      var knopf = el('button', { class: 'halteknopf', type: 'button' }, [el('span', { class: 'halteknopf-text', text: 'HALTEN' })]);
      b.koerper.appendChild(knopf);
      var fortschritt = balken(b.koerper, '');
      var haelt = false, verstrichen = 0, stopp;

      function loslassen(grund) {
        if (!haelt) return;
        haelt = false;
        knopf.classList.remove('ist-aktiv');
        b.sag(grund + ' Bei ' + Math.round((verstrichen / p.sekunden) * 100) + ' %. Noch mal.', 'fehler');
        verstrichen = 0;
        fortschritt.setze(0);
        fortschritt.text('');
      }

      knopf.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (knopf.setPointerCapture) { try { knopf.setPointerCapture(e.pointerId); } catch (f) {} }
        haelt = true; b.sag(''); knopf.classList.add('ist-aktiv');
      });
      ['pointerup', 'pointercancel'].forEach(function (typ) {
        knopf.addEventListener(typ, function () { loslassen('Losgelassen.'); });
      });
      var beiSichtwechsel = function () { if (document.hidden) loslassen('App verlassen.'); };
      document.addEventListener('visibilitychange', beiSichtwechsel);

      stopp = takt(function (delta) {
        if (!haelt) return;
        verstrichen += delta;
        fortschritt.setze(verstrichen / p.sekunden);
        fortschritt.text(util.uhrwerk(Math.max(0, p.sekunden - verstrichen)) + ' übrig');
        if (verstrichen >= p.sekunden) { haelt = false; stopp(); ton(660, 0.3); kontext.fertig(); }
      });

      return function () { stopp(); document.removeEventListener('visibilitychange', beiSichtwechsel); };
    }
  });

  registrieren({
    id: 'ruhe',
    dimension: 'geduld',
    name: 'Nichts tun',
    kurz: 'Bildschirm offen lassen, nichts beruehren',
    erzeuge: function (zufall, stufe) {
      return { sekunden: jitter(zufall, proStufe(stufe, [30, 75, 150, 300, 600]), 0.15) };
    },
    schaetzung: function (p) { return p.sekunden + 15; },
    beschreibe: function (p) { return util.dauer(p.sekunden) + ' nichts tun'; },
    starte: function (kontext) {
      var p = kontext.params;
      var b = buehne(kontext, 'Nichts tun', util.dauer(p.sekunden) + ' lang nicht tippen, nicht scrollen, den Tab nicht wechseln.');
      var starten = el('button', { class: 'knopf gross', type: 'button', text: 'Ruhe beginnen' });
      b.koerper.appendChild(starten);
      var fortschritt = balken(b.koerper, '');
      var laeuft = false, verstrichen = 0, schonzeit = 0, stopp;

      function stoeren(grund) {
        if (!laeuft || schonzeit > 0) return;
        laeuft = false;
        starten.disabled = false;
        starten.textContent = 'Noch einmal';
        b.sag(grund + ' Bei ' + util.dauer(verstrichen) + '. Von vorn.', 'fehler');
        verstrichen = 0; fortschritt.setze(0); fortschritt.text('');
      }

      starten.addEventListener('click', function () {
        laeuft = true; schonzeit = 0.7; starten.disabled = true; b.sag('Ruhig bleiben.', 'laeuft');
      });
      var beiStoerung = function () { stoeren('Berührt.'); };
      var beiSicht = function () { if (document.hidden) stoeren('App verlassen.'); };
      document.addEventListener('pointerdown', beiStoerung);
      document.addEventListener('keydown', beiStoerung);
      document.addEventListener('wheel', beiStoerung, { passive: true });
      document.addEventListener('visibilitychange', beiSicht);

      stopp = takt(function (delta) {
        if (!laeuft) return;
        if (schonzeit > 0) { schonzeit -= delta; return; }
        verstrichen += delta;
        fortschritt.setze(verstrichen / p.sekunden);
        fortschritt.text(util.uhrwerk(Math.max(0, p.sekunden - verstrichen)) + ' übrig');
        if (verstrichen >= p.sekunden) { laeuft = false; stopp(); ton(660, 0.3); kontext.fertig(); }
      });

      return function () {
        stopp();
        document.removeEventListener('pointerdown', beiStoerung);
        document.removeEventListener('keydown', beiStoerung);
        document.removeEventListener('wheel', beiStoerung);
        document.removeEventListener('visibilitychange', beiSicht);
      };
    }
  });

  registrieren({
    id: 'atem',
    dimension: 'geduld',
    name: 'Atemtakt',
    kurz: 'Dem Atemrhythmus folgen und an den Wendepunkten tippen',
    erzeuge: function (zufall, stufe) {
      return {
        zyklen: proStufe(stufe, [3, 4, 6, 8, 11]),
        ein: zufall.stufe(3, 6, 1),
        halten: zufall.stufe(0, 4, 1),
        aus: zufall.stufe(4, 8, 1),
        toleranz: [1.0, 0.9, 0.8, 0.7, 0.6][util.grenze(stufe, 1, 5) - 1]
      };
    },
    schaetzung: function (p) { return p.zyklen * (p.ein + p.halten + p.aus) + 15; },
    beschreibe: function (p) {
      var takt = p.halten ? p.ein + '-' + p.halten + '-' + p.aus : p.ein + '-' + p.aus;
      return p.zyklen + ' Atemzüge im Takt ' + takt;
    },
    starte: function (kontext) {
      var p = kontext.params;
      var b = buehne(kontext, 'Atemtakt',
        p.zyklen + ' Zyklen: ' + p.ein + ' s ein, ' + (p.halten ? p.halten + ' s halten, ' : '') + p.aus + ' s aus. Tippe jedes Mal, wenn der Kreis umkehrt.');
      var kreis = el('div', { class: 'atemkreis' }, [el('span', { class: 'atemkreis-text', text: 'Start' })]);
      var text = kreis.firstChild;
      b.koerper.appendChild(kreis);
      var fortschritt = balken(b.koerper, '');
      var zyklus = 0, phase = 'bereit', zeitInPhase = 0, wendeOffen = false, wendeZeit = 0, stopp;
      var phasen = { ein: p.ein, halten: p.halten, aus: p.aus };

      function naechstePhase() {
        if (phase === 'bereit') phase = 'ein';
        else if (phase === 'ein') phase = p.halten > 0 ? 'halten' : 'aus';
        else if (phase === 'halten') phase = 'aus';
        else if (phase === 'aus') { zyklus++; phase = 'ein'; }
        zeitInPhase = 0;
        if (phase === 'ein' || phase === 'aus') { wendeOffen = true; wendeZeit = 0; }
      }

      function fehlschlag(grund) {
        b.sag(grund + ' Zurück auf Anfang.', 'fehler');
        zyklus = 0; phase = 'bereit'; zeitInPhase = 0; wendeOffen = false;
        text.textContent = 'Start';
        kreis.style.transform = 'scale(0.55)';
        fortschritt.setze(0);
      }

      kreis.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (phase === 'bereit') { naechstePhase(); wendeOffen = false; b.sag('Einatmen.', 'laeuft'); return; }
        if (!wendeOffen) { fehlschlag('Zu früh getippt.'); return; }
        if (wendeZeit > p.toleranz) { fehlschlag('Zu spät getippt.'); return; }
        wendeOffen = false;
        ton(phase === 'ein' ? 520 : 400, 0.12);
        b.sag('Im Takt.', 'gut');
      });

      stopp = takt(function (delta) {
        if (phase === 'bereit') return;
        zeitInPhase += delta;
        if (wendeOffen) {
          wendeZeit += delta;
          if (wendeZeit > p.toleranz + 0.35) { fehlschlag('Wendepunkt verpasst.'); return; }
        }
        var dauerPhase = phasen[phase];
        var anteil = util.grenze(zeitInPhase / dauerPhase, 0, 1);
        var groesse = phase === 'ein' ? 0.55 + 0.45 * anteil : phase === 'aus' ? 1 - 0.45 * anteil : 1;
        kreis.style.transform = 'scale(' + groesse.toFixed(3) + ')';
        text.textContent = phase === 'ein' ? 'einatmen' : phase === 'aus' ? 'ausatmen' : 'halten';
        fortschritt.setze(zyklus / p.zyklen);
        fortschritt.text('Zyklus ' + Math.min(zyklus + 1, p.zyklen) + ' von ' + p.zyklen);
        if (zeitInPhase >= dauerPhase) {
          if (zyklus >= p.zyklen) { stopp(); ton(660, 0.3); kontext.fertig(); return; }
          naechstePhase();
        }
      });

      return function () { stopp(); };
    }
  });

  registrieren({
    id: 'tropfen',
    dimension: 'geduld',
    name: 'Wachbleiben',
    kurz: 'Auf unregelmäßige Signale reagieren',
    erzeuge: function (zufall, stufe) {
      var minAbstand = proStufe(stufe, [4, 6, 8, 10, 12]);
      return {
        anzahl: proStufe(stufe, [3, 5, 7, 10, 14]),
        minAbstand: minAbstand,
        maxAbstand: minAbstand + proStufe(stufe, [10, 18, 30, 45, 70]),
        fenster: [4, 3.5, 3, 2.5, 2][util.grenze(stufe, 1, 5) - 1],
        saat: zufall.ganz(1, 2000000000)
      };
    },
    schaetzung: function (p) { return Math.round(p.anzahl * (p.minAbstand + p.maxAbstand) / 2) + 10; },
    beschreibe: function (p) { return p.anzahl + ' Signale abwarten'; },
    starte: function (kontext) {
      var p = kontext.params;
      var zufall = new T.Zufall(p.saat);
      var b = buehne(kontext, 'Wachbleiben',
        'Irgendwann leuchtet das Feld auf. Dann hast du ' + p.fenster + ' s zum Tippen. ' + p.anzahl + ' Treffer nötig, Fehlgriffe kosten.');
      var feld = el('button', { class: 'signalfeld', type: 'button', text: 'warten ...' });
      b.koerper.appendChild(feld);
      var fortschritt = balken(b.koerper, '0 von ' + p.anzahl);
      var treffer = 0, bisSignal = zufall.bereich(p.minAbstand, p.maxAbstand), offen = 0, noetig = p.anzahl;

      feld.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (offen > 0) {
          treffer++; offen = 0; feld.classList.remove('ist-an'); feld.textContent = 'warten ...';
          ton(700, 0.1);
          bisSignal = zufall.bereich(p.minAbstand, p.maxAbstand);
          fortschritt.setze(treffer / noetig);
          fortschritt.text(treffer + ' von ' + noetig);
          b.sag('Treffer.', 'gut');
          if (treffer >= noetig) { stopp(); ton(660, 0.3); kontext.fertig(); }
        } else {
          noetig++;
          bisSignal = zufall.bereich(p.minAbstand, p.maxAbstand);
          fortschritt.setze(treffer / noetig);
          fortschritt.text(treffer + ' von ' + noetig);
          b.sag('Zu früh getippt - ein Signal mehr.', 'fehler');
        }
      });

      var stopp = takt(function (delta) {
        if (offen > 0) {
          offen -= delta;
          feld.textContent = 'JETZT (' + offen.toFixed(1) + ')';
          if (offen <= 0) {
            offen = 0; feld.classList.remove('ist-an'); feld.textContent = 'warten ...';
            noetig++;
            fortschritt.setze(treffer / noetig);
            fortschritt.text(treffer + ' von ' + noetig);
            b.sag('Signal verpasst - ein Signal mehr.', 'fehler');
            bisSignal = zufall.bereich(p.minAbstand, p.maxAbstand);
          }
          return;
        }
        bisSignal -= delta;
        if (bisSignal <= 0) {
          offen = p.fenster;
          feld.classList.add('ist-an');
          ton(880, 0.08);
        }
      });

      return function () { stopp(); };
    }
  });

  registrieren({
    id: 'langsam',
    dimension: 'geduld',
    name: 'Gleichmaß',
    kurz: 'Regler in vorgegebener Zeit gleichmäßig bewegen',
    erzeuge: function (zufall, stufe) {
      return {
        sekunden: jitter(zufall, proStufe(stufe, [20, 35, 60, 100, 160]), 0.2),
        toleranz: [0.16, 0.13, 0.11, 0.09, 0.07][util.grenze(stufe, 1, 5) - 1]
      };
    },
    schaetzung: function (p) { return p.sekunden + 15; },
    beschreibe: function (p) { return 'Regler in ' + util.dauer(p.sekunden) + ' gleichmäßig schieben'; },
    starte: function (kontext) {
      var p = kontext.params;
      var b = buehne(kontext, 'Gleichmaß',
        'Schiebe den Regler von links nach rechts - genau ' + util.dauer(p.sekunden) + ' lang, ohne zu hetzen und ohne stehen zu bleiben.');
      var regler = el('input', { type: 'range', min: '0', max: '1000', value: '0', class: 'gleichmass' });
      b.koerper.appendChild(regler);
      var spur = el('div', { class: 'sollspur' }, [el('i')]);
      b.koerper.appendChild(spur);
      var fortschritt = balken(b.koerper, 'noch nicht gestartet');
      var laeuft = false, verstrichen = 0;

      function zurueck(grund) {
        laeuft = false; verstrichen = 0; regler.value = '0';
        spur.firstChild.style.left = '0%';
        b.sag(grund + ' Von vorn.', 'fehler');
        fortschritt.setze(0); fortschritt.text('noch nicht gestartet');
      }

      regler.addEventListener('input', function () {
        if (!laeuft && Number(regler.value) > 0) { laeuft = true; b.sag('Ruhig weiter.', 'laeuft'); }
      });

      var stopp = takt(function (delta) {
        var ist = Number(regler.value) / 1000;
        if (!laeuft) return;
        verstrichen += delta;
        var soll = verstrichen / p.sekunden;
        spur.firstChild.style.left = util.grenze(soll, 0, 1) * 100 + '%';
        fortschritt.setze(ist);
        fortschritt.text('Abweichung ' + Math.round(Math.abs(ist - soll) * 100) + ' %');
        if (soll > 1.0 + p.toleranz) { zurueck('Zu langsam.'); return; }
        if (ist - soll > p.toleranz) { zurueck('Zu schnell.'); return; }
        if (soll - ist > p.toleranz && verstrichen > 1.5) { zurueck('Zu langsam.'); return; }
        if (ist >= 1 && Math.abs(soll - 1) <= p.toleranz) { stopp(); ton(660, 0.3); kontext.fertig(); }
      });

      return function () { stopp(); };
    }
  });

  registrieren({
    id: 'schaetzen',
    dimension: 'geduld',
    name: 'Zeitgefühl',
    kurz: 'Eine Dauer ohne Uhr abschätzen',
    erzeuge: function (zufall, stufe) {
      return {
        sekunden: jitter(zufall, proStufe(stufe, [20, 35, 50, 75, 110]), 0.25),
        toleranz: [0.14, 0.11, 0.09, 0.07, 0.055][util.grenze(stufe, 1, 5) - 1]
      };
    },
    schaetzung: function (p) { return Math.round(p.sekunden * 2.2); },
    beschreibe: function (p) { return util.dauer(p.sekunden) + ' ohne Uhr schätzen'; },
    starte: function (kontext) {
      var p = kontext.params;
      var b = buehne(kontext, 'Zeitgefühl',
        'Starte und stoppe nach genau ' + p.sekunden + ' Sekunden. Keine Uhr, kein Countdown - nur dein Gefühl. Erlaubte Abweichung: ' + Math.round(p.toleranz * 100) + ' %.');
      var knopf = el('button', { class: 'knopf gross', type: 'button', text: 'Start' });
      b.koerper.appendChild(knopf);
      b.koerper.appendChild(el('div', { class: 'blindfeld', text: '· · ·' }));
      var start = 0, laeuft = false;

      knopf.addEventListener('click', function () {
        if (!laeuft) {
          laeuft = true; start = performance.now();
          knopf.textContent = 'Stopp';
          b.sag('Läuft. Zähl nicht laut mit.', 'laeuft');
          return;
        }
        laeuft = false;
        var gemessen = (performance.now() - start) / 1000;
        var abweichung = (gemessen - p.sekunden) / p.sekunden;
        knopf.textContent = 'Noch einmal';
        if (Math.abs(abweichung) <= p.toleranz) { ton(660, 0.3); kontext.fertig(); return; }
        var richtung = abweichung < 0 ? 'zu früh' : 'zu spät';
        var staerke = Math.abs(abweichung) > 0.35 ? 'deutlich ' : Math.abs(abweichung) > 0.18 ? '' : 'knapp ';
        b.sag(staerke + richtung + '. Noch einmal.', 'fehler');
      });

      return function () {};
    }
  });

  /* =====================  DIMENSION: ZEIT  ===================== */

  registrieren({
    id: 'wartezeit',
    dimension: 'zeit',
    name: 'Sperrfrist',
    kurz: 'Eine feste Zeitspanne verstreichen lassen',
    erzeuge: function (zufall, stufe) {
      return { sekunden: jitter(zufall, proStufe(stufe, [90, 600, 3600, 14400, 43200]), 0.25) };
    },
    schaetzung: function (p) { return p.sekunden; },
    beschreibe: function (p) { return util.dauer(p.sekunden) + ' Sperrfrist'; },
    aktiviere: function (params, zustand) {
      zustand.bis = Date.now() + params.sekunden * 1000;
      zustand.gesehen = Date.now();
    },
    starte: function (kontext) {
      var p = kontext.params, z = kontext.zustand;
      if (!z.bis) { z.bis = Date.now() + p.sekunden * 1000; z.gesehen = Date.now(); kontext.speichern(); }
      var b = buehne(kontext, 'Sperrfrist',
        'Dieses Fragment öffnet sich erst ' + util.zeitpunkt(z.bis) + '. Die App darf zu sein - die Uhr laeuft weiter.');
      var anzeige = el('div', { class: 'countdown', text: '--:--' });
      b.koerper.appendChild(anzeige);
      var fortschritt = balken(b.koerper, '');

      var stopp = takt(function () {
        var jetzt = Date.now();
        if (jetzt < z.gesehen - 120000) {
          // Uhr wurde zurückgedreht: Restzeit bleibt erhalten statt zu schrumpfen
          z.bis += (z.gesehen - jetzt);
          b.sag('Systemuhr zurückgestellt - die Sperrfrist wurde entsprechend verschoben.', 'fehler');
        }
        z.gesehen = Math.max(z.gesehen || 0, jetzt);
        var rest = (z.bis - jetzt) / 1000;
        anzeige.textContent = util.uhrwerk(rest);
        fortschritt.setze(1 - rest / p.sekunden);
        fortschritt.text('frei ' + util.zeitpunkt(z.bis));
        if (rest <= 0) { stopp(); kontext.speichern(); ton(660, 0.3); kontext.fertig(); }
      });

      var sichern = setInterval(kontext.speichern, 15000);
      return function () { stopp(); clearInterval(sichern); kontext.speichern(); };
    }
  });

  registrieren({
    id: 'zeitfenster',
    dimension: 'zeit',
    mindestStufe: 3,
    name: 'Zeitfenster',
    kurz: 'Nur zu einer bestimmten Tageszeit zu öffnen',
    erzeuge: function (zufall, stufe) {
      var breite = proStufe(stufe, [180, 120, 75, 45, 25]);
      var von = zufall.stufe(0, 1439 - breite, 5);
      return { von: von, bis: von + breite };
    },
    schaetzung: function (p) { return 12 * 3600 - (p.bis - p.von) * 30; },
    beschreibe: function (p) { return 'nur ' + util.minutenAlsUhr(p.von) + '-' + util.minutenAlsUhr(p.bis) + ' Uhr'; },
    starte: function (kontext) {
      var p = kontext.params;
      var b = buehne(kontext, 'Zeitfenster',
        'Dieses Fragment lässt sich nur zwischen ' + util.minutenAlsUhr(p.von) + ' und ' + util.minutenAlsUhr(p.bis) + ' Uhr öffnen.');
      var anzeige = el('div', { class: 'countdown', text: '--:--' });
      var knopf = el('button', { class: 'knopf gross', type: 'button', text: 'Jetzt öffnen', disabled: 'disabled' });
      b.koerper.appendChild(anzeige);
      b.koerper.appendChild(knopf);

      knopf.addEventListener('click', function () {
        if (knopf.disabled) return;
        stopp(); ton(660, 0.3); kontext.fertig();
      });

      var stopp = takt(function () {
        var jetzt = new Date();
        var minuten = jetzt.getHours() * 60 + jetzt.getMinutes() + jetzt.getSeconds() / 60;
        var drin = minuten >= p.von && minuten < p.bis;
        knopf.disabled = !drin;
        if (drin) {
          anzeige.textContent = util.uhrwerk((p.bis - minuten) * 60);
          b.sag('Das Fenster ist offen - noch ' + util.dauer((p.bis - minuten) * 60) + '.', 'gut');
        } else {
          var bisOeffnung = (p.von - minuten + 1440) % 1440;
          anzeige.textContent = util.uhrwerk(bisOeffnung * 60);
          b.sag('Geschlossen. Oeffnet in ' + util.dauer(bisOeffnung * 60) + '.', '');
        }
      });

      return function () { stopp(); };
    }
  });

  registrieren({
    id: 'intervall',
    dimension: 'zeit',
    name: 'Rückmeldungen',
    kurz: 'Mehrmals mit Mindestabstand vorbeischauen',
    erzeuge: function (zufall, stufe) {
      return {
        anzahl: proStufe(stufe, [2, 3, 3, 4, 5]),
        abstand: jitter(zufall, proStufe(stufe, [120, 900, 3600, 10800, 21600]), 0.2)
      };
    },
    schaetzung: function (p) { return (p.anzahl - 1) * p.abstand; },
    beschreibe: function (p) { return p.anzahl + ' Check-ins im Abstand von ' + util.dauer(p.abstand); },
    starte: function (kontext) {
      var p = kontext.params, z = kontext.zustand;
      if (!z.checkins) { z.checkins = []; kontext.speichern(); }
      var b = buehne(kontext, 'Rückmeldungen',
        p.anzahl + ' Mal vorbeischauen, jeweils mindestens ' + util.dauer(p.abstand) + ' auseinander.');
      var anzeige = el('div', { class: 'countdown', text: '--:--' });
      var knopf = el('button', { class: 'knopf gross', type: 'button', text: 'Check-in' });
      var liste = el('ul', { class: 'checkliste' });
      b.koerper.appendChild(anzeige);
      b.koerper.appendChild(knopf);
      b.koerper.appendChild(liste);

      function zeichneListe() {
        util.leeren(liste);
        z.checkins.forEach(function (ts, i) {
          liste.appendChild(el('li', { text: (i + 1) + '. ' + util.zeitpunkt(ts) }));
        });
      }

      knopf.addEventListener('click', function () {
        if (knopf.disabled) return;
        z.checkins.push(Date.now());
        kontext.speichern();
        zeichneListe();
        ton(620, 0.12);
        if (z.checkins.length >= p.anzahl) { stopp(); kontext.fertig(); }
      });

      zeichneListe();
      var stopp = takt(function () {
        var letzter = z.checkins.length ? z.checkins[z.checkins.length - 1] : 0;
        var frei = letzter + p.abstand * 1000;
        var rest = (frei - Date.now()) / 1000;
        if (rest > 0) {
          knopf.disabled = true;
          anzeige.textContent = util.uhrwerk(rest);
          b.sag('Nächstes Check-in ' + util.zeitpunkt(frei) + '.', '');
        } else {
          knopf.disabled = false;
          anzeige.textContent = 'bereit';
          b.sag('Check-in ' + (z.checkins.length + 1) + ' von ' + p.anzahl + ' möglich.', 'gut');
        }
      });

      return function () { stopp(); kontext.speichern(); };
    }
  });

  T.herausforderungen = {
    katalog: katalog,
    liste: function () { return reihenfolge.map(function (id) { return katalog[id]; }); },
    nachDimension: nachDimension,
    hole: function (id) { return katalog[id]; },
    dimensionen: [
      { id: 'geduld', name: 'Geduld', beschreibung: 'Aushalten, stillhalten, warten können.', fertig: true },
      { id: 'zeit', name: 'Zeit', beschreibung: 'Sperrfristen, Tageszeiten, echte Rechenzeit.', fertig: true },
      { id: 'logik', name: 'Logik', beschreibung: 'Mastermind, Zahlenfolgen, Lügner und Wahrheitssager.', fertig: false },
      { id: 'raetsel', name: 'Rätsel', beschreibung: 'Chiffren, Anagramme, Morse.', fertig: false },
      { id: 'konzentration', name: 'Konzentration', beschreibung: 'Simon, N-Back, Stroop.', fertig: false }
    ]
  };
})(typeof window !== 'undefined' ? window : globalThis);
