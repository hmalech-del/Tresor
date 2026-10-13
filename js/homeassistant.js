/* Home Assistant: Zeit von aussen.
 *
 * Der Tresor hoert auf eine Zahl in Home Assistant - einen Helfer
 * input_number, standardmaessig input_number.tresor_minuten. Steigt sie,
 * kommt Zeit dazu; faellt sie, geht Zeit weg, je Einheit eine Minute. Was in
 * Home Assistant die Zahl bewegt, ist dort geregelt: ein Webhook, eine
 * NFC-Marke, ein Bluetooth-Beacon, eine Tuer, ein Zeitplan. Die App kennt nur
 * die Zahl. Daneben, wenn es ihn gibt, ein input_text mit dem Grund.
 *
 * Eine Zahl statt einzelner Ereignisse, weil die App nicht immer offen ist:
 * Was waehrend ihrer Abwesenheit geschah, steckt im Unterschied zum letzten
 * gesehenen Stand und wird beim naechsten Verbinden nachgeholt. Ereignisse
 * waeren dann verloren.
 *
 * Verbunden wird ueber die WebSocket-API mit einem langlebigen Zugangstoken.
 * Die Seite laeuft ueber https, also muss Home Assistant ueber wss erreichbar
 * sein (Nabu Casa oder ein eigenes Zertifikat) - ein http-Home-Assistant im
 * Heimnetz blockiert der Browser als gemischten Inhalt.
 *
 * Home Assistant bewegt nur die Uhr, innerhalb der Leiter. Oeffnen kann es den
 * Tresor nicht: Den Zeitschluessel gibt allein das Netz frei.
 *
 * Die Zugangsdaten liegen getrennt vom Tresor im Browser-Speicher
 * (tresor.ha) - nicht im Tresor, nicht in einer Sicherung. Das Token ist ein
 * Schluessel zum ganzen Haus. */
(function (global) {
  'use strict';
  var T = global.Tresor || (global.Tresor = {});
  var SCHLUESSEL = 'tresor.ha';
  var STANDARD = { url: '', token: '', zahl: 'input_number.tresor_minuten', grund: 'input_text.tresor_grund', rueck: '' };

  function einstellungen() {
    try {
      var roh = JSON.parse(global.localStorage.getItem(SCHLUESSEL) || 'null');
      return Object.assign({}, STANDARD, roh || {});
    } catch (fehler) { return Object.assign({}, STANDARD); }
  }

  function einstellungenSichern(e) {
    try { global.localStorage.setItem(SCHLUESSEL, JSON.stringify(e)); return true; } catch (fehler) { return false; }
  }

  /* "https://haus.example" -> "wss://haus.example/api/websocket". */
  function wsAdresse(url) {
    var u = String(url || '').trim().replace(/\/+$/, '');
    if (!u) return '';
    if (!/^[a-z]+:\/\//i.test(u)) u = 'https://' + u;
    u = u.replace(/^http(s?):\/\//i, 'ws$1://');
    if (!/\/api\/websocket$/.test(u)) u += '/api/websocket';
    return u;
  }

  /* Wuerde der Browser die Verbindung als gemischten Inhalt sperren? */
  function gemischt(url) {
    return global.location && global.location.protocol === 'https:' && /^ws:\/\//i.test(wsAdresse(url));
  }

  /* Eine Verbindung, die sich selbst wieder aufbaut.
   *
   *   beiStand(zahl, grund, zeit)  - jeder Stand der Zahl, auch der erste
   *   beiStatus(status, text)      - 'verbinde' | 'verbunden' | 'getrennt' | 'fehler'
   *
   * Ein abgewiesenes Token versucht es nicht endlos weiter. */
  function Verbindung(e, beiStand, beiStatus) {
    this.e = e;
    this.beiStand = beiStand;
    this.beiStatus = beiStatus || function () {};
    this.ws = null;
    this.warten = 5000;
    this.uhr = null;
    this.aus = false;
    this.grund = '';
    this.status = 'getrennt';
    this.oeffnen();
  }

  Verbindung.prototype.melde = function (status, text) {
    this.status = status;
    this.statusText = text || '';
    this.beiStatus(status, text || '');
  };

  Verbindung.prototype.oeffnen = function () {
    var self = this;
    if (self.aus) return;
    var adresse = wsAdresse(self.e.url);
    if (!adresse || !self.e.token) { self.melde('fehler', 'Adresse oder Token fehlt.'); return; }
    if (gemischt(self.e.url)) {
      self.melde('fehler', 'Diese Seite läuft über https - Home Assistant muss dann auch über https erreichbar sein.');
      return;
    }
    self.melde('verbinde', 'Verbinde ...');
    var ws;
    try { ws = new global.WebSocket(adresse); } catch (fehler) { self.melde('fehler', fehler.message); return; }
    self.ws = ws;
    var abgewiesen = false;
    ws.onmessage = function (nachricht) {
      var m;
      try { m = JSON.parse(nachricht.data); } catch (fehler) { return; }
      if (m.type === 'auth_required') {
        ws.send(JSON.stringify({ type: 'auth', access_token: self.e.token }));
      } else if (m.type === 'auth_invalid') {
        abgewiesen = true;
        self.melde('fehler', 'Home Assistant hat das Token abgewiesen.');
        ws.close();
      } else if (m.type === 'auth_ok') {
        self.warten = 5000;
        var ids = [self.e.zahl];
        if (self.e.grund) ids.push(self.e.grund);
        ws.send(JSON.stringify({ id: 1, type: 'subscribe_entities', entity_ids: ids }));
      } else if (m.type === 'result' && m.id === 1 && !m.success) {
        self.melde('fehler', 'Abo abgelehnt: ' + ((m.error && m.error.message) || 'unbekannt'));
      } else if (m.type === 'event' && m.id === 1 && m.event) {
        self.ereignis(m.event);
      }
    };
    ws.onclose = function () {
      if (self.ws !== ws) return;
      self.ws = null;
      if (self.aus || abgewiesen) return;
      self.melde('getrennt', 'Getrennt - neuer Versuch in ' + Math.round(self.warten / 1000) + ' s.');
      self.uhr = setTimeout(function () { self.oeffnen(); }, self.warten);
      self.warten = Math.min(300000, self.warten * 2);
    };
    ws.onerror = function () {};
  };

  /* subscribe_entities schickt erst alles ("a"), dann Aenderungen ("c" mit
   * "+"). Der Grund wird vor der Zahl gelesen, damit eine Aenderung beider in
   * einer Nachricht den neuen Grund traegt. */
  Verbindung.prototype.ereignis = function (ev) {
    var self = this, e = self.e;
    function stand(eintrag) {
      if (!eintrag) return null;
      var neu = eintrag['+'] || eintrag;
      return neu.s === undefined ? null : { s: neu.s, lc: neu.lc };
    }
    var quelle = ev.a || ev.c || {};
    var g = stand(quelle[e.grund]);
    if (g) self.grund = g.s;
    var z = stand(quelle[e.zahl]);
    if (ev.a && !ev.a[e.zahl]) {
      self.melde('fehler', e.zahl + ' gibt es in Home Assistant nicht.');
      return;
    }
    if (ev.a) self.melde('verbunden', 'Verbunden.');
    if (!z) return;
    var wert = parseFloat(z.s);
    if (!isFinite(wert)) return;
    self.beiStand(wert, self.grund && self.grund !== 'unknown' ? self.grund : '', z.lc ? Math.round(z.lc * 1000) : Date.now());
  };

  /* Sofort neu verbinden, etwa wenn die Seite wieder sichtbar wird. */
  Verbindung.prototype.anstossen = function () {
    if (this.aus || this.ws || (this.status === 'fehler' && !this.uhr)) return;
    clearTimeout(this.uhr);
    this.uhr = null;
    this.oeffnen();
  };

  Verbindung.prototype.schliessen = function () {
    this.aus = true;
    clearTimeout(this.uhr);
    if (this.ws) { var ws = this.ws; this.ws = null; try { ws.close(); } catch (fehler) {} }
  };

  /* Einmal verbinden, Stand lesen, trennen - fuer den Knopf "Verbindung prüfen". */
  function pruefen(e) {
    return new Promise(function (fertig) {
      var v = new Verbindung(e, function (wert, grund) {
        v.schliessen();
        fertig({ ok: true, wert: wert, grund: grund });
      }, function (status, text) {
        if (status === 'fehler' || status === 'getrennt') { v.schliessen(); fertig({ ok: false, text: text }); }
      });
      setTimeout(function () { v.schliessen(); fertig({ ok: false, text: 'Keine Antwort binnen 10 s.' }); }, 10000);
    });
  }

  /* ---------- Rueckkanal: die App meldet an Home Assistant ----------
   *
   * Ueber einen Webhook, nicht ueber die WebSocket-Verbindung: Ein Ereignis
   * feuern darf dort nur ein Administrator, und das Token soll keiner sein.
   * Ein Webhook braucht gar kein Token - nur seine geheime ID.
   *
   * Gesendet wird als Formular (application/x-www-form-urlencoded) mit
   * mode 'no-cors': Das ist eine "einfache" Anfrage, der Browser fragt nicht
   * vorher per CORS nach, und Home Assistant legt die Felder in
   * trigger.data ab. Die Antwort bleibt unlesbar - geklappt hat es, wenn das
   * Netz sie zugestellt hat (fetch loest auf statt zu werfen). */
  function rueckAdresse(e) {
    var basis = String(e.url || '').trim().replace(/\/+$/, '');
    if (!basis || !e.rueck) return '';
    if (!/^[a-z]+:\/\//i.test(basis)) basis = 'https://' + basis;
    return basis + '/api/webhook/' + encodeURIComponent(String(e.rueck).trim());
  }

  function rueckSenden(e, daten) {
    var adresse = rueckAdresse(e);
    if (!adresse) return Promise.reject(new Error('Kein Webhook eingetragen.'));
    if (global.location && global.location.protocol === 'https:' && /^http:/i.test(adresse)) {
      return Promise.reject(new Error('Diese Seite läuft über https - der Webhook muss es auch.'));
    }
    var formular = new global.URLSearchParams();
    Object.keys(daten).forEach(function (k) {
      if (daten[k] !== undefined && daten[k] !== null) formular.append(k, String(daten[k]));
    });
    return global.fetch(adresse, { method: 'POST', mode: 'no-cors', body: formular, keepalive: true });
  }

  T.homeassistant = {
    rueckAdresse: rueckAdresse,
    rueckSenden: rueckSenden,
    STANDARD: STANDARD,
    einstellungen: einstellungen,
    einstellungenSichern: einstellungenSichern,
    wsAdresse: wsAdresse,
    gemischt: gemischt,
    Verbindung: Verbindung,
    pruefen: pruefen
  };
})(typeof window !== 'undefined' ? window : globalThis);
