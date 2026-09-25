// Am Netz entscheidet die Zeit: Ist sie um, geht der Tresor auf - auch mit
// offenen Pruefungen und ungeloesten Raetseln (ueber das Pfand). Nur ein
// Raetsel ohne Pfand (alter Tresor) haelt sein Fragment zu.
const { chromium } = require('./playwright.js');
const AUSGABE = require('path').join(__dirname, 'schuesse');
const schein = require('./scheinkette.js').neu({ period: 1, genesisSek: Math.floor(Date.now() / 1000) - 5000 });
let f = 0;
const pruefe = (n, ok, t) => { console.log(`  [${ok ? 'ok  ' : 'FEHL'}] ${n.padEnd(56)} ${t}`); if (!ok) f++; };

async function neu(browser, fehler) {
  const seite = await (await browser.newContext({ viewport: { width: 390, height: 1000 } })).newPage();
  seite.on('pageerror', e => fehler.push(e.message));
  await seite.exposeFunction('scheinBeacon', r => schein.beacon(r));
  await seite.goto('http://127.0.0.1:8099/index.html');
  await seite.waitForSelector('#ziffernfelder .zifferfeld');
  await seite.evaluate(info => {
    Tresor.drand.testKette(info, r => window.scheinBeacon(r));
    const H = Tresor.herausforderungen;
    H.registrieren({ id: 'probe-raetsel', dimension: 'raetsel', name: 'Proberaetsel', kurz: 'Test', antwortGebunden: true,
      normalisiere: x => String(x || '').trim().toLowerCase(),
      erzeuge: () => ({ loesung: 'xqzvwk' }), schaetzung: () => 10, beschreibe: () => 'Raetsel',
      starte: k => { const b = document.createElement('button'); b.id = 't-loesen'; b.textContent = 'loesen';
        b.onclick = () => k.pruefeAntwort('xqzvwk'); k.wurzel.append(b); } });
    H.nachDimension = () => [H.hole('probe-raetsel')];
  }, schein.info);
  return seite;
}

(async () => {
  const browser = await chromium.launch();
  const fehler = [];

  console.log('Nichts tun: Die Zeit laeuft ab, der Tresor geht auf');
  const s1 = await neu(browser, fehler);
  const felder = await s1.$$('#ziffernfelder .zifferfeld');
  for (let i = 0; i < felder.length; i++) { await felder[i].click(); await felder[i].type('48271'[i]); }
  await s1.$$eval('.dimension-karte input[type=checkbox]', els => els.forEach(e => {
    if (!e.disabled) { e.checked = e.value === 'raetsel'; e.dispatchEvent(new Event('change', { bubbles: true })); } }));
  await s1.$eval('#aufgaben-pro-fragment', e => { e.value = '1'; e.dispatchEvent(new Event('input')); });
  await s1.selectOption('#sicherheit', 'drand');
  await s1.evaluate(() => { for (const id of ['#tresorzeit-min', '#tresorzeit-max']) { const s = document.querySelector(id);
    const o = document.createElement('option'); o.value = '15'; s.appendChild(o); s.value = '15'; s.dispatchEvent(new Event('change')); } });
  await s1.click('#verriegeln');
  await s1.waitForSelector('#t-loesen', { timeout: 60000 });
  // eine Pruefung loesen, vier liegen lassen
  await s1.click('#t-loesen');
  await s1.waitForSelector('.grossezahl', { timeout: 40000 });
  pruefe('nach Ablauf: ganze Zahl frei, ohne weitere Pruefung', (await s1.textContent('.grossezahl')) === '48271', await s1.textContent('.grossezahl'));
  const t1 = await s1.evaluate(() => JSON.parse(localStorage.getItem('tresor.v1')));
  const verfallen = t1.fragmente.filter(fr => fr.aufgaben[0].verfallen).length;
  pruefe('vier offene Pruefungen verfallen, die geloeste nicht', verfallen === 4 && !t1.fragmente[0].aufgaben[0].verfallen, verfallen + ' verfallen');
  pruefe('keine Loesung im Klartext gespeichert', !/xqzvwk/.test(JSON.stringify(t1)), '');
  await s1.screenshot({ path: AUSGABE + '/schuss-drand-freigabe.png', fullPage: true });
  await s1.context().close();

  console.log('\nAlter Tresor ohne Pfand: nur dieses Fragment bleibt zu');
  const s2 = await neu(browser, fehler);
  const r = await s2.evaluate(async () => {
    const L = Tresor.tresorLogik;
    const k = L.standardKonfiguration();
    Object.assign(k, { dimensionen: ['raetsel'], stufen: { raetsel: 1 }, aufgabenProFragment: 1, sicherheit: 'drand',
      tresorzeit: { minSekunden: 10, maxSekunden: 10 }, notausgang: { modus: 'aus' } });
    const t = await L.erstellen({ art: 'zahl', teile: ['4', '8', '2', '7', '1'], konfig: k });
    delete t.fragmente[2].aufgaben[0].pfand;                       // wie vor dem Pfand angelegt
    const e = { oeffenbar: t.fragmente.map(L.freigabeOeffenbar) };
    await new Promise(res => setTimeout(res, Math.max(0, L.freigabeZiel(t).zeit - Date.now()) + 1500));
    const z = await L.freigabeHolen(t);
    e.erg = await L.freigabeAlleOeffnen(t, z);
    e.offen = t.fragmente.map(fr => fr.offen);
    e.inhalt = t.fragmente.map(fr => fr.inhalt || '_').join('');
    // Das Raetsel geloest: jetzt geht auch das letzte auf
    const a = t.fragmente[2].aufgaben[0];
    a.zustand.antwort = 'xqzvwk'; a.erledigt = true;
    e.danach = L.freigabeOeffenbar(t.fragmente[2]);
    await L.freigabeAlleOeffnen(t, z);
    e.ende = t.fragmente.map(fr => fr.inhalt).join('');
    return e;
  });
  pruefe('ohne Pfand nicht oeffenbar, alle anderen schon', r.oeffenbar.join() === 'true,true,false,true,true', r.oeffenbar.join());
  pruefe('Freigabe oeffnet vier, laesst eins zu', r.erg.geoeffnet === 4 && r.inhalt === '48_71', r.inhalt);
  pruefe('mit geloestem Raetsel geht das letzte auf', r.danach && r.ende === '48271', r.ende);
  await s2.context().close();

  pruefe('keine Seitenfehler', !fehler.length, fehler.join(' | ') || '-');
  console.log(f ? `\nFEHLGESCHLAGEN: ${f}` : '\nAlles gruen.');
  await browser.close(); process.exit(f ? 1 : 0);
})();
