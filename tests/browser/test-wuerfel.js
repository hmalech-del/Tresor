const { chromium } = require('./playwright.js');
const AUSGABE = require('path').join(__dirname, 'schuesse');

(async () => {
  const browser = await chromium.launch();
  const k = await browser.newContext({ viewport: { width: 420, height: 950 } });
  const s = await k.newPage();
  const fehler = [];
  s.on('pageerror', e => fehler.push('pageerror: ' + e.message));
  await s.goto('http://127.0.0.1:8099/index.html');
  await s.waitForSelector('#blindgang');

  // Verteilung und Erwartungswert der Streckung
  const stat = await s.evaluate(() => {
    const W = Tresor.herausforderungen.werkzeug;
    const zaehler = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const N = 60000;
    for (let i = 0; i < N; i++) zaehler[W.wurf()]++;
    const gewinne = zaehler[5] + zaehler[6];
    const rest = 600;
    return {
      verteilung: Object.keys(zaehler).map(k => (zaehler[k] / N).toFixed(4)).join(' '),
      gewinnquote: +(gewinne / N).toFixed(4),
      mittlereRestzeit: +(((N - gewinne) / N) * rest * W.WURF_STRECKUNG).toFixed(1),
      ausgangsrest: rest
    };
  });
  console.log('Würfel:', JSON.stringify(stat));
  console.log('  erwartet: Gewinnquote ~0.333, mittlere Restzeit ~600 (erwartungswertneutral)');

  // Würfel auf dem Strafbildschirm
  await s.evaluate(() => { Tresor.tresorLogik.RECHENZEIT_STUFEN[0] = 2; });
  const f = await s.$$('#ziffernfelder .zifferfeld');
  for (let i = 0; i < f.length; i++) { await f[i].click(); await f[i].type('4'); }
  await s.$$eval('.dimension-karte input[type=checkbox]', els => els.forEach(e => {
    if (!e.disabled) { e.checked = (e.value === 'raetsel'); e.dispatchEvent(new Event('change', { bubbles: true })); }
  }));
  await s.$eval('#aufgaben-pro-fragment', e => { e.value = '1'; e.dispatchEvent(new Event('input')); });
  await s.$eval('#rechenzeit', e => { e.value = '1'; e.dispatchEvent(new Event('input')); });
  await s.selectOption('#strafzeit', '2');
  await s.selectOption('#notausgang-modus', 'aus');
  await s.check('#gluecksspiel');
  await s.waitForTimeout(300);
  await s.click('#verriegeln');
  await s.waitForSelector('#aufgabenkarte', { timeout: 60000 });
  // falsche Antwort -> Strafe
  await s.fill('.aufgabenkarte .antwortfeld', 'garantiertfalsch');
  await s.click('.aufgabenkarte .antwortzeile button');
  await s.waitForSelector('.wuerfel', { timeout: 15000 });
  const vorher = await s.evaluate(() => {
    const t = JSON.parse(localStorage.getItem('tresor.v1'));
    return t.fragmente[0].aufgaben[0].zustand.strafeBis - Date.now();
  });
  await s.click('.wuerfelbox button');
  await s.waitForTimeout(1600);
  const nachher = await s.evaluate(() => {
    const t = JSON.parse(localStorage.getItem('tresor.v1'));
    const z = t.fragmente[0].aufgaben[0].zustand;
    return { rest: Math.round((z.strafeBis - Date.now()) / 1000), gewuerfelt: z.gewuerfelt,
             auge: (document.querySelector('.wuerfel') || { textContent: 'weg (gewonnen, neu gezeichnet)' }).textContent,
             meldung: (document.querySelector('.wuerfelbox p') || { textContent: '-' }).textContent };
  });
  console.log('Strafe vorher (s):', Math.round(vorher / 1000), '| nachher:', JSON.stringify(nachher));
  await s.screenshot({ path: AUSGABE + '/schuss-wuerfel.png', fullPage: true });

  await browser.close();
  console.log(fehler.length ? 'FEHLER:\n' + fehler.join('\n') : 'keine Seitenfehler');
})();
