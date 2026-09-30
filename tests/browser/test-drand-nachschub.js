// Nachschub am Netz: Ist die feste Reihe durch und laeuft die Zeit noch,
// kommen weitere Pruefungen - eine nach der anderen, nur aufs Zeitkonto.
// Dazu Willkuer mit sichtbarer Uhr.
const { chromium } = require('./playwright.js');
const AUSGABE = require('path').join(__dirname, 'schuesse');
const schein = require('./scheinkette.js').neu({ period: 1, genesisSek: Math.floor(Date.now() / 1000) - 5000 });
let f = 0;
const pruefe = (n, ok, t) => { console.log(`  [${ok ? 'ok  ' : 'FEHL'}] ${n.padEnd(56)} ${t}`); if (!ok) f++; };
const warte = ms => new Promise(r => setTimeout(r, ms));

async function neu(browser, fehler) {
  const seite = await (await browser.newContext({ viewport: { width: 390, height: 1000 } })).newPage();
  seite.on('pageerror', e => fehler.push(e.message));
  await seite.exposeFunction('scheinBeacon', r => schein.beacon(r));
  await seite.goto('http://127.0.0.1:8099/index.html');
  await seite.waitForSelector('#ziffernfelder .zifferfeld');
  await seite.evaluate(info => {
    Tresor.drand.testKette(info, r => window.scheinBeacon(r));
    const H = Tresor.herausforderungen, L = Tresor.tresorLogik;
    H.registrieren({ id: 'probe-knopf', dimension: 'geduld', name: 'Probeknopf', kurz: 'Test',
      erzeuge: () => ({}), schaetzung: () => 10, beschreibe: () => 'Knopf',
      starte: k => { const b = document.createElement('button'); b.id = 't-bestehen'; b.textContent = 'bestehen';
        b.onclick = () => k.fertig(); k.wurzel.append(b);
        const c = document.createElement('button'); c.id = 't-scheitern'; c.textContent = 'scheitern';
        c.onclick = () => k.fehlschlag('Probe verhauen.'); k.wurzel.append(c); } });
    H.registrieren({ id: 'probe-raetsel', dimension: 'raetsel', name: 'Proberaetsel', kurz: 'Test', antwortGebunden: true,
      normalisiere: x => String(x || '').trim().toLowerCase(),
      erzeuge: () => ({ loesung: 'xqzvwk' }), schaetzung: () => 10, beschreibe: () => 'Raetsel',
      starte: k => { const b = document.createElement('button'); b.id = 't-loesen'; b.textContent = 'loesen';
        b.onclick = () => k.pruefeAntwort('xqzvwk'); k.wurzel.append(b); } });
    H.nachDimension = d => d === 'raetsel' ? [H.hole('probe-raetsel')] : [H.hole('probe-knopf')];
    L.TAKT.ab = 1e9; L.NACHSCHUB.abstandMin = 2;
    L.AUSSCHLAG.normal.stufen = [[1, 1, 1]]; L.AUSSCHLAG.normal.angebot = 0;
  }, schein.info);
  return seite;
}

(async () => {
  const browser = await chromium.launch();
  const fehler = [];

  console.log('Logik');
  const s0 = await neu(browser, fehler);
  const r = await s0.evaluate(async () => {
    const L = Tresor.tresorLogik;
    const k = L.standardKonfiguration();
    Object.assign(k, { dimensionen: ['geduld'], stufen: { geduld: 1 }, aufgabenProFragment: 1, sicherheit: 'drand',
      tresorzeit: { minSekunden: 20, maxSekunden: 200 }, strafe: 1, notausgang: { modus: 'aus' } });
    const t = await L.erstellen({ art: 'zahl', teile: ['1', '2', '3', '4', '5'], konfig: k });
    const e = { vorher: L.nachschubFaellig(t) };
    t.fragmente.forEach(fr => fr.aufgaben.forEach(a => { a.erledigt = true; }));
    e.faellig = L.nachschubFaellig(t);
    const n1 = await L.nachschubAnlegen(t);
    e.n1 = { extra: n1.extra, abstand: Math.round((n1.frei - t.freigabe.start) / 1000) };
    e.nurEine = !L.nachschubFaellig(t) && (await L.nachschubAnlegen(t)) === null;
    const lage = L.netzLage(t, n1.frei + 10);
    e.lage = { extra: lage.extra, nr: lage.nr, istN1: lage.aufgabe === n1, fragment: lage.fragment.index };
    const vor = t.freigabe.konto.zielSek;
    n1.erledigt = true;
    const g = L.gutschriftBuchen(t, lage.fragment, n1, n1.frei + 10);
    e.gut = { gebucht: g && g.gewuenscht, konto: vor - t.freigabe.konto.zielSek };
    e.doppelt = L.gutschriftBuchen(t, lage.fragment, n1, n1.frei + 20);
    const n2 = await L.nachschubAnlegen(t, n1.frei + 10);
    e.n2abstand = Math.round((n2.frei - n1.frei) / 1000);
    // am Boden: nichts mehr
    n2.erledigt = true;
    t.freigabe.konto.zielSek = t.freigabe.leiter[0];
    e.amBoden = L.nachschubFaellig(t);
    // Raetsel als Nachschub: eigener Pruefwert, keine Loesung gespeichert, aufgebbar
    t.freigabe.konto.zielSek = 200;
    t.konfig.dimensionen = ['raetsel']; t.konfig.stufen = { raetsel: 1 };
    const n3 = await L.nachschubAnlegen(t);
    e.raetsel = { pruefung: !!(n3.pruefung && n3.pruefung.hash), klartext: /xqzvwk/.test(JSON.stringify(t)),
      aufgebbar: L.kapitulationMoeglich(L.netzLage(t, n3.frei + 10).fragment, n3).ok };
    // nach der Freigabe: keiner mehr
    n3.erledigt = true; t.freigabe.z = 'ab';
    e.nachFreigabe = L.nachschubFaellig(t);
    return e;
  });
  pruefe('solange die Reihe laeuft: kein Nachschub', r.vorher === false, '');
  pruefe('Reihe durch, Zeit laeuft: Nachschub faellig', r.faellig, '');
  pruefe('Nachschub im Abstand unten/Anzahl (4 s)', r.n1.extra && r.n1.abstand === 4, r.n1.abstand + ' s');
  pruefe('nie mehr als einer bereit', r.nurEine, '');
  pruefe('netzLage bringt ihn als Nachschub 1', r.lage.extra && r.lage.nr === 1 && r.lage.istN1 && r.lage.fragment === 'x', JSON.stringify(r.lage));
  pruefe('Gutschrift wie jede Pruefung (180/5 = 36 s)', r.gut.gebucht === -36 && r.gut.konto === 36, JSON.stringify(r.gut));
  pruefe('keine zweite Gutschrift', r.doppelt === null, '');
  pruefe('naechster Nachschub wieder 4 s spaeter', r.n2abstand === 4, r.n2abstand + ' s');
  pruefe('am Boden des Rahmens: keiner mehr', r.amBoden === false, '');
  pruefe('Raetsel: eigener Pruefwert, Loesung nirgends', r.raetsel.pruefung && !r.raetsel.klartext, '');
  pruefe('Raetsel im Nachschub laesst sich aufgeben', r.raetsel.aufgebbar, '');
  pruefe('nach der Freigabe: keiner mehr', r.nachFreigabe === false, '');
  await s0.context().close();

  console.log('\nOberflaeche');
  const s1 = await neu(browser, fehler);
  const felder = await s1.$$('#ziffernfelder .zifferfeld');
  for (let i = 0; i < felder.length; i++) { await felder[i].click(); await felder[i].type('48271'[i]); }
  await s1.$$eval('.dimension-karte input[type=checkbox]', els => els.forEach(e => {
    if (!e.disabled) { e.checked = e.value === 'geduld'; e.dispatchEvent(new Event('change', { bubbles: true })); } }));
  await s1.$eval('#aufgaben-pro-fragment', e => { e.value = '1'; e.dispatchEvent(new Event('input')); });
  await s1.selectOption('#sicherheit', 'drand');
  await s1.selectOption('#strafzeit', '1');
  await s1.evaluate(() => { [['#tresorzeit-min', 30], ['#tresorzeit-max', 600]].forEach(([id, v]) => { const s = document.querySelector(id);
    const o = document.createElement('option'); o.value = String(v); s.appendChild(o); s.value = String(v); s.dispatchEvent(new Event('change')); }); });
  await s1.click('#verriegeln');
  await s1.waitForSelector('#t-scheitern', { timeout: 60000 });
  // zweimal scheitern, dann alle fuenf bestehen
  for (let i = 0; i < 2; i++) {
    await s1.click('#t-scheitern');
    await s1.waitForSelector('.strafkasten');
    await s1.click('.strafkasten > button.knopf');
  }
  for (let i = 0; i < 5; i++) {
    await s1.waitForSelector('#t-bestehen');
    await s1.click('#t-bestehen');
    await s1.waitForSelector('.gutkasten');
    await s1.click('.gutkasten > button.knopf');
  }
  await s1.waitForSelector('text=Nachschub', { timeout: 15000 });
  await s1.waitForSelector('#t-bestehen', { timeout: 20000 });
  const kopf = (await s1.textContent('.aufgaben-kopf')).replace(/\s+/g, ' ');
  pruefe('nach der Reihe: "Nachschub 1" mit Gutschrift', /Nachschub 1/.test(kopf) && /holt ~/.test(kopf), kopf);
  const vorher = await s1.evaluate(() => JSON.parse(localStorage.getItem('tresor.v1')).freigabe.konto.zielSek);
  await s1.click('#t-bestehen');
  await s1.waitForSelector('.gutkasten');
  const nachher = await s1.evaluate(() => JSON.parse(localStorage.getItem('tresor.v1')).freigabe.konto.zielSek);
  pruefe('Nachschub holt Zeit zurueck', nachher < vorher, `${vorher} -> ${nachher} s`);
  await s1.screenshot({ path: AUSGABE + '/schuss-nachschub.png', fullPage: true });
  await s1.context().close();

  console.log('\nWillkuer mit Uhr');
  const s2 = await neu(browser, fehler);
  const f2 = await s2.$$('#ziffernfelder .zifferfeld');
  for (let i = 0; i < f2.length; i++) { await f2[i].click(); await f2[i].type('48271'[i]); }
  await s2.check('#blindgang');
  pruefe('Schalter "Die Uhr zeigen" am Netz sichtbar', await s2.isVisible('#blind-uhr'), '');
  await s2.selectOption('#blind-zeitschloss', 'rechenzeit');
  pruefe('... und ohne Netz nicht', !(await s2.isVisible('#blind-uhr')), '');
  await s2.selectOption('#blind-zeitschloss', 'drand');
  await s2.check('#blind-uhr');
  await s2.evaluate(() => { const s = document.querySelector('#notausgang-dauer'); const o = document.createElement('option');
    o.value = '600'; o.dataset.sekunden = '600'; s.appendChild(o); s.value = '600'; s.dispatchEvent(new Event('change')); });
  await s2.click('#verriegeln');
  await s2.waitForSelector('.freigabe-karte', { timeout: 60000 });
  await warte(1200);
  const karte = (await s2.textContent('.freigabe-karte')).replace(/\s+/g, ' ');
  const t2 = await s2.evaluate(() => JSON.parse(localStorage.getItem('tresor.v1')).konfig);
  pruefe('konfig: blind und blindUhr', t2.blind && t2.blindUhr, '');
  pruefe('Uhr laeuft sichtbar', /\d\d:\d\d/.test(karte) && !/· · ·/.test(karte), karte.slice(0, 60));
  pruefe('mit Spott: "wenn nichts dazwischenkommt"', /wenn nichts dazwischenkommt/.test(karte), '');
  pruefe('Rahmen bleibt verborgen', !/Bestenfalls/.test(karte), '');
  await s2.screenshot({ path: AUSGABE + '/schuss-willkuer-uhr.png' });
  await s2.context().close();

  pruefe('keine Seitenfehler', !fehler.length, fehler.join(' | ') || '-');
  console.log(f ? `\nFEHLGESCHLAGEN: ${f}` : '\nAlles gruen.');
  await browser.close(); process.exit(f ? 1 : 0);
})();
