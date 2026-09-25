const { chromium } = require('./playwright.js');
(async () => {
  const browser = await chromium.launch();
  const kontext = await browser.newContext({ viewport: { width: 420, height: 950 } });
  const seite = await kontext.newPage();
  const fehler = [];
  seite.on('pageerror', e => fehler.push('pageerror: ' + e.message));
  seite.on('console', m => { if (m.type() === 'error') fehler.push('console: ' + m.text()); });
  await seite.goto('http://127.0.0.1:8099/index.html');
  await seite.waitForSelector('#ziffernfelder .zifferfeld');
  await seite.evaluate(() => { Tresor.tresorLogik.RECHENZEIT_STUFEN[0] = 600; });
  const f = await seite.$$('#ziffernfelder .zifferfeld');
  for (let i = 0; i < f.length; i++) { await f[i].click(); await f[i].type('48271'[i]); }
  await seite.$$eval('.dimension-karte input[type=checkbox]', els => els.forEach(e => {
    if (!e.disabled) { e.checked = (e.value === 'geduld'); e.dispatchEvent(new Event('change', { bubbles: true })); }
  }));
  await seite.$eval('#rechenzeit', e => { e.value = '1'; e.dispatchEvent(new Event('input')); });
  await seite.selectOption('#notausgang-modus', 'fest');
  await seite.evaluate(() => {
    const feld = document.querySelector('#notausgang-dauer');
    feld.innerHTML = ''; const o = document.createElement('option');
    o.value = '6'; feld.appendChild(o); feld.value = '6';
  });
  await seite.click('#verriegeln');
  await seite.waitForSelector('.notausgang-karte', { timeout: 60000 });
  await seite.click('.notausgang-karte button.knopf');
  await seite.waitForTimeout(2500);
  console.log('Anzeige:', (await seite.textContent('.notausgang-karte .countdown')).trim(),
    '|', (await seite.textContent('.notausgang-karte .balken-text')).trim());
  await seite.waitForFunction(() => document.querySelectorAll('.bandziffer.ist-offen').length === 5, null, { timeout: 90000 });
  console.log('Geöffnet:', await seite.evaluate(() =>
    [...document.querySelectorAll('.bandziffer')].map(e => e.textContent).join('')));
  console.log(fehler.length ? 'FEHLER:\n' + fehler.join('\n') : 'Keine Konsolenfehler.');
  await browser.close();
})();
