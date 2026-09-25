// Gutschrift und Takt am Netz - mit gestauchter Zeit (TAKT.ab = 10 s).
const { chromium } = require('./playwright.js');
const schein = require('./scheinkette.js').neu({ period: 1, genesisSek: Math.floor(Date.now() / 1000) - 5000 });
let f = 0;
const pruefe = (n, ok, t) => { console.log(`  [${ok ? 'ok  ' : 'FEHL'}] ${n.padEnd(52)} ${t}`); if (!ok) f++; };
(async () => {
  const browser = await chromium.launch();
  const seite = await (await browser.newContext()).newPage();
  const fehler = []; seite.on('pageerror', e => fehler.push(e.message));
  await seite.exposeFunction('scheinBeacon', r => schein.beacon(r));
  await seite.goto('http://127.0.0.1:8099/index.html');
  await seite.waitForFunction(() => window.Tresor && Tresor.tresorLogik);
  const r = await seite.evaluate(async info => {
    Tresor.drand.testKette(info, r => window.scheinBeacon(r));
    const L = Tresor.tresorLogik;
    // Verteilung pruefen, bevor sie fuer die exakten Rechnungen festgesetzt wird
    const ziehe = (k, n) => { const z = []; for (let i = 0; i < n; i++) z.push(L.ausschlagZiehen(k)); return z; };
    const nz = ziehe({}, 40000), wz = ziehe({ blind: true }, 40000);
    const anteil = (z, g) => z.filter(x => x >= g).length / z.length;
    const mittel = z => z.reduce((a, b) => a + b, 0) / z.length;
    const verteilung = { nMittel: mittel(nz), nTreffer: anteil(nz, 2.5), nMin: Math.min(...nz), nMax: Math.max(...nz),
      wMin: Math.min(...wz), wMax: Math.max(...wz), wTreffer: anteil(wz, 2.5) };
    const sicher = JSON.parse(JSON.stringify(L.AUSSCHLAG.normal));
    L.AUSSCHLAG.normal.stufen = [[1, 1, 1]]; L.AUSSCHLAG.normal.angebot = 0;
    const bauen = async (tz, takt) => {
      L.TAKT.ab = takt ? 10 : 1e9; L.TAKT.fensterMin = 2;
      const k = L.standardKonfiguration();
      Object.assign(k, { dimensionen: ['geduld'], stufen: { geduld: 1 }, aufgabenProFragment: 1, sicherheit: 'drand',
        tresorzeit: { minSekunden: tz[0], maxSekunden: tz[1] }, strafe: 1, notausgang: { modus: 'fest', sekunden: 200 } });
      return L.erstellen({ art: 'zahl', teile: ['1', '2', '3', '4', '5'], konfig: k });
    };
    const erg = {};

    // --- mit Takt: Rahmen 20..60 s, 5 Pruefungen -> alle 4 s eine, Wert 8 s
    const t = await bauen([20, 60], true);
    const fr = t.freigabe, auf = t.fragmente.map(x => x.aufgaben[0]);
    erg.start = { ziel: fr.konto.zielSek, boden: fr.leiter[0], takt: fr.takt, wert: fr.gutschrift, fenster: fr.fenster };
    erg.abstaende = auf.slice(1).map((a, i) => Math.round((a.frei - auf[i].frei) / 1000));
    erg.fensterMs = auf.map(a => a.puenktlichBis - a.frei);
    const l0 = L.netzLage(t, fr.start + 100);
    erg.lage0 = { nr: l0.nr, gesamt: l0.gesamt, fragment: l0.fragment && l0.fragment.index };
    auf[0].erledigt = true;
    erg.g1 = L.gutschriftBuchen(t, t.fragmente[0], auf[0], fr.start + 1000);
    const l1 = L.netzLage(t, fr.start + 1500);
    erg.lage1 = { dran: !!l1.aufgabe, naechsteIn: Math.round((l1.naechsteAb - fr.start) / 1000) };
    const l2 = L.netzLage(t, fr.start + 4100);
    erg.lage2 = { nr: l2.nr, fragment: l2.fragment && l2.fragment.index };
    erg.doppelt = L.gutschriftBuchen(t, t.fragmente[0], auf[0], fr.start + 1000);
    // spaet: Pruefung 2 erst 30 s nach ihrer Freischaltung
    auf[1].erledigt = true;
    erg.g2 = L.gutschriftBuchen(t, t.fragmente[1], auf[1], auf[1].frei + 30000);
    // Rest puenktlich
    for (let i = 2; i < 5; i++) { auf[i].erledigt = true; L.gutschriftBuchen(t, t.fragmente[i], auf[i], auf[i].frei + 500); }
    erg.ende = fr.konto.zielSek;
    erg.bereit = L.netzLage(t).bereit.length;

    // alle puenktlich -> genau am Boden, nicht darunter
    const u = await bauen([20, 60], true);
    u.fragmente.forEach(x => x.aufgaben.forEach(a => { a.erledigt = true; L.gutschriftBuchen(u, x, a, a.frei + 100); }));
    erg.bodenGenau = u.freigabe.konto.zielSek;
    erg.wirkung = L.freigabeZiel(u).sekunden;

    // --- ohne Takt: alles sofort, ueber Fragmente hinweg
    const v = await bauen([20, 60], false);
    const lv = v.fragmente.map(x => x.aufgaben[0].frei - v.freigabe.start);
    erg.ohneTakt = { alleSofort: lv.every(x => x === 0), takt: v.freigabe.takt };
    v.fragmente[0].aufgaben[0].erledigt = true;
    const lv2 = L.netzLage(v);
    erg.ohneTakt.naechstesFragment = lv2.fragment && lv2.fragment.index;

    // --- Rahmen ohne Spielraum
    const w = await bauen([30, 30], false);
    erg.keinSpielraum = w.freigabe.gutschrift;
    L.TAKT.ab = 6 * 3600; L.TAKT.fensterMin = 12 * 3600;
    Object.assign(L.AUSSCHLAG.normal, sicher);
    erg.verteilung = verteilung;
    return erg;
  }, schein.info);

  console.log('Rahmen');
  pruefe('Uhr startet oben (ohne eine Pruefung)', r.start.ziel === 60, r.start.ziel + ' s');
  pruefe('Boden der Leiter ist die untere Grenze', r.start.boden === 20, r.start.boden + ' s');
  pruefe('Wert je Pruefung = Spanne / Anzahl', r.start.wert === 8, r.start.wert + ' s');
  console.log('\nTakt');
  pruefe('Pruefungen kommen im Takt', r.start.takt === 4 && r.abstaende.every(x => x === 4), r.abstaende.join(', ') + ' s');
  pruefe('Puenktlich = mindestens das Mindestfenster', r.fensterMs.every(x => x === 4000), r.fensterMs[0] + ' ms');
  pruefe('am Anfang ist Pruefung 1 dran', r.lage0.nr === 1 && r.lage0.gesamt === 5, `${r.lage0.nr} von ${r.lage0.gesamt}`);
  pruefe('danach: warten auf die naechste', !r.lage1.dran && r.lage1.naechsteIn === 4, `naechste nach ${r.lage1.naechsteIn} s`);
  pruefe('nach dem Takt: Pruefung 2 aus Fragment 2', r.lage2.nr === 2 && r.lage2.fragment === 1, `Pruefung ${r.lage2.nr}, Fragment ${r.lage2.fragment + 1}`);
  console.log('\nGutschrift');
  pruefe('puenktlich: volle Gutschrift', r.g1.gewuenscht === -8 && r.g1.puenktlich && r.g1.wirksam < 0, 'gebucht ' + r.g1.gewuenscht + ' s, Leiter ' + r.g1.wirksam + ' s');
  pruefe('keine zweite Gutschrift fuer dieselbe Pruefung', r.doppelt === null, String(r.doppelt));
  pruefe('verspaetet: halbe Gutschrift', r.g2.gewuenscht === -4 && !r.g2.puenktlich, 'gebucht ' + r.g2.gewuenscht + ' s');
  pruefe('Endstand: 60 - 4x8 - 4 = 24 s', r.ende === 24, r.ende + ' s');
  pruefe('alle Fragmente bereit fuer die Freigabe', r.bereit === 5, r.bereit + ' bereit');
  pruefe('alles puenktlich: genau am Boden', r.bodenGenau === 20 && r.wirkung === 20, `Wunsch ${r.bodenGenau} s, Sprosse ${r.wirkung} s`);
  console.log('\nAusschlag (40 000 Zuege)');
  const v = r.verteilung;
  pruefe('normal: Mittel knapp ueber dem Normalwert', v.nMittel > 1.05 && v.nMittel < 1.2, v.nMittel.toFixed(2));
  pruefe('normal: Treffer (ab 2,5x) um 2 %', v.nTreffer > 0.01 && v.nTreffer < 0.03, (v.nTreffer * 100).toFixed(1) + ' %');
  pruefe('normal: nie unter 0,6x, nie ueber 4x', v.nMin >= 0.6 && v.nMax <= 4, v.nMin.toFixed(2) + ' .. ' + v.nMax.toFixed(2));
  pruefe('Willkuer: breiter - unter 0,2x bis ueber 5x', v.wMin < 0.2 && v.wMax > 5, v.wMin.toFixed(2) + ' .. ' + v.wMax.toFixed(2));
  pruefe('Willkuer: Treffer viel haeufiger', v.wTreffer > 0.12, (v.wTreffer * 100).toFixed(1) + ' %');

  console.log('\nOhne Takt (kurzer Tresor)');
  pruefe('alle Pruefungen sofort frei', r.ohneTakt.alleSofort && r.ohneTakt.takt === 0, '');
  pruefe('naechste Pruefung kommt aus Fragment 2, ohne Warten', r.ohneTakt.naechstesFragment === 1, 'Fragment ' + (r.ohneTakt.naechstesFragment + 1));
  pruefe('Rahmen ohne Spielraum: keine Gutschrift', r.keinSpielraum === 0, String(r.keinSpielraum));
  pruefe('keine Seitenfehler', !fehler.length, fehler.join(' | ') || '-');
  console.log(f ? `\nFEHLGESCHLAGEN: ${f}` : '\nAlles gruen.');
  await browser.close(); process.exit(f ? 1 : 0);
})();
