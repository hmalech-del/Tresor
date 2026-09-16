/* Kleine Helfer, die überall gebraucht werden. */
(function (global) {
  'use strict';
  var T = global.Tresor || (global.Tresor = {});

  function $(auswahl, wurzel) { return (wurzel || document).querySelector(auswahl); }
  function $$(auswahl, wurzel) { return Array.prototype.slice.call((wurzel || document).querySelectorAll(auswahl)); }

  function el(tag, attribute, kinder) {
    var knoten = document.createElement(tag);
    if (attribute) Object.keys(attribute).forEach(function (schluessel) {
      var wert = attribute[schluessel];
      if (schluessel === 'class') knoten.className = wert;
      else if (schluessel === 'text') knoten.textContent = wert;
      else if (schluessel === 'html') knoten.innerHTML = wert;
      else if (schluessel.slice(0, 2) === 'on') knoten.addEventListener(schluessel.slice(2), wert);
      else if (wert !== null && wert !== undefined && wert !== false) knoten.setAttribute(schluessel, wert);
    });
    if (kinder) (Array.isArray(kinder) ? kinder : [kinder]).forEach(function (kind) {
      if (kind === null || kind === undefined) return;
      knoten.appendChild(typeof kind === 'string' ? document.createTextNode(kind) : kind);
    });
    return knoten;
  }

  function leeren(knoten) { while (knoten.firstChild) knoten.removeChild(knoten.firstChild); return knoten; }

  /* Sekunden menschenlesbar: "45 s", "3 min 20 s", "2 h 5 min", "1 Tag 4 h" */
  function dauer(sekunden) {
    sekunden = Math.max(0, Math.round(sekunden));
    if (sekunden < 60) return sekunden + ' s';
    var min = Math.floor(sekunden / 60), s = sekunden % 60;
    if (min < 60) return s ? min + ' min ' + s + ' s' : min + ' min';
    var std = Math.floor(min / 60); min = min % 60;
    if (std < 24) return min ? std + ' h ' + min + ' min' : std + ' h';
    var tage = Math.floor(std / 24); std = std % 24;
    return (tage === 1 ? '1 Tag' : tage + ' Tage') + (std ? ' ' + std + ' h' : '');
  }

  /* Kompakte Restzeit für laufende Uhren: "02:41" bzw. "1:04:09" */
  function uhrwerk(sekunden) {
    sekunden = Math.max(0, Math.ceil(sekunden));
    var std = Math.floor(sekunden / 3600), min = Math.floor((sekunden % 3600) / 60), s = sekunden % 60;
    var zwei = function (n) { return String(n).padStart(2, '0'); };
    return std ? std + ':' + zwei(min) + ':' + zwei(s) : zwei(min) + ':' + zwei(s);
  }

  function zeitpunkt(ms) {
    var d = new Date(ms), heute = new Date();
    var gleicherTag = d.toDateString() === heute.toDateString();
    var uhr = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    if (gleicherTag) return 'heute ' + uhr + ' Uhr';
    var morgen = new Date(heute.getTime() + 86400000);
    if (d.toDateString() === morgen.toDateString()) return 'morgen ' + uhr + ' Uhr';
    return d.getDate() + '.' + (d.getMonth() + 1) + '. ' + uhr + ' Uhr';
  }

  function minutenAlsUhr(minuten) {
    return String(Math.floor(minuten / 60)).padStart(2, '0') + ':' + String(minuten % 60).padStart(2, '0');
  }

  function grenze(wert, min, max) { return Math.min(max, Math.max(min, wert)); }

  function bytesZuHex(bytes) {
    return Array.prototype.map.call(bytes, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  function hexZuBytes(hex) {
    if (hex.length % 2) hex = '0' + hex;
    var bytes = new Uint8Array(hex.length / 2);
    for (var i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    return bytes;
  }

  T.util = {
    $: $, $$: $$, el: el, leeren: leeren, dauer: dauer, uhrwerk: uhrwerk,
    zeitpunkt: zeitpunkt, minutenAlsUhr: minutenAlsUhr, grenze: grenze,
    bytesZuHex: bytesZuHex, hexZuBytes: hexZuBytes
  };
})(typeof window !== 'undefined' ? window : globalThis);
