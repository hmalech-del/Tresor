// Faire Strafen: Teilversuche kosten nichts, eine verlorene Runde kostet -
// je Pruefung aber hoechstens einmal je Anlauf (Schonfrist).
const { chromium } = require('./playwright.js');
const schein = require('./scheinkette.js').neu({ period: 1, genesisSek: Math.floor(Date.now() / 1000) - 5000 });
let f = 0;
const pruefe = (n, ok, t) => { console.log(`  [${ok ? 'ok  ' : 'FEHL'}] ${n.padEnd(56)} ${t}`); if (!ok) f++; };
const warte = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const seite = await (await browser.newContext({ viewport: { width: 390, height: 1000 } })).newPage();
  const fehler = []; seite.on('pageerror', e => fehler.push(e.message));
  await seite.exposeFunction('scheinBeacon', r => schein.beacon(r));
  await seite.goto('http://127.0.0.1:8099/index.html');
  await seite.waitForSelector('#ziffernfelder .zifferfeld');
  await seite.evaluate(info => {
    Tresor.drand.testKette(info, r => window.scheinBeacon(r));
    const H = Tresor.herausforderungen, L = Tresor.tresorLogik;
    H.registrieren({ id: 'probe-fair', dimension: 'geduld', name: 'Probe', kurz: 'Test',
      erzeuge: () => ({}), schaetzung: () => 10, beschreibe: () => 'Probe',
      starte: k => {
        const mk = (id, f) => { const b = document.createElement('button'); b.id = id; b.textContent = id; b.onclick = f; k.wurzel.append(b); };
        mk('t-teil', () => { window.__antwort = k.fehlschlag('Wurf daneben.', 'teil'); });
        mk('t-runde', () => { window.__antwort = k.fehlschlag('Runde verloren.'); });
      } });
    H.nachDimension = () => [H.hole('probe-fair')];
    L.AUSSCHLAG.normal.stufen = [[1, 1, 1]]; L.AUSSCHLAG.normal.angebot = 0;
    L.STRAFE_SCHONFRIST = 4;            // im Test 4 s statt 15 min
  }, schein.info);
  const felder = await seite.$$('#ziffernfelder .zifferfeld');
  for (let i = 0; i < felder.length; i++) { await felder[i].click(); await felder[i].type('48271'[i]); }
  await seite.$$eval('.dimension-karte input[type=checkbox]', els => els.forEach(e => {
    if (!e.disabled) { e.checked = e.value === 'geduld'; e.dispatchEvent(new Event('change', { bubbles: true })); } }));
  await seite.$eval('#aufgaben-pro-fragment', e => { e.value = '1'; e.dispatchEvent(new Event('input')); });
  await seite.selectOption('#sicherheit', 'drand');
  await seite.selectOption('#strafzeit', '1');
  await seite.evaluate(() => { [['#tresorzeit-min', 60], ['#tresorzeit-max', 900]].forEach(([id, v]) => { const s = document.querySelector(id);
    const o = document.createElement('option'); o.value = String(v); s.appendChild(o); s.value = String(v); s.dispatchEvent(new Event('change')); }); });
  await seite.click('#verriegeln');
  await seite.waitForSelector('#t-teil', { timeout: 60000 });
  const konto = () => seite.evaluate(() => JSON.parse(localStorage.getItem('tresor.v1')).freigabe.konto.zielSek);

  const k0 = await konto();
  for (let i = 0; i < 5; i++) await seite.click('#t-teil');
  pruefe('fuenf Teilversuche: keine Zeit', (await konto()) === k0 && !(await seite.$('.strafkasten')), `${k0} -> ${await konto()} s`);

  await seite.click('#t-runde');
  await seite.waitForSelector('.strafkasten');
  const k1 = await konto();
  pruefe('verlorene Runde: Strafe', k1 > k0, `+${k1 - k0} s`);
  await seite.click('.strafkasten > button.knopf');
  await seite.waitForSelector('#t-runde');
  await seite.click('#t-runde');
  await warte(300);
  const k2 = await konto();
  pruefe('zweite verlorene Runde in der Schonfrist: keine Strafe', k2 === k1 && !(await seite.$('.strafkasten')), `${k1} -> ${k2} s`);
  pruefe('... die Aufgabe laeuft weiter', await seite.evaluate(() => window.__antwort === false), '');

  await warte(4300);
  await seite.click('#t-runde');
  await seite.waitForSelector('.strafkasten');
  const k3 = await konto();
  pruefe('nach der Schonfrist: neuer Anlauf, neue Strafe', k3 > k2, `+${k3 - k2} s`);

  pruefe('keine Seitenfehler', !fehler.length, fehler.join(' | ') || '-');
  console.log(f ? `\nFEHLGESCHLAGEN: ${f}` : '\nAlles gruen.');
  await browser.close(); process.exit(f ? 1 : 0);
})();
