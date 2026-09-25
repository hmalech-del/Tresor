const { chromium } = require('./playwright.js');
const AUSGABE = require('path').join(__dirname, 'schuesse');

(async () => {
  const browser = await chromium.launch();
  const kontext = await browser.newContext({ viewport: { width: 420, height: 950 } });
  const seite = await kontext.newPage();
  const fehler = [];
  seite.on('pageerror', e => fehler.push('pageerror: ' + e.message));
  seite.on('console', m => { if (m.type() === 'error') fehler.push('console: ' + m.text()); });
  await seite.goto('http://127.0.0.1:8099/index.html');
  await seite.waitForSelector('#ziffernfelder .zifferfeld');

  const felder = await seite.$$('#ziffernfelder .zifferfeld');
  for (let i = 0; i < felder.length; i++) { await felder[i].click(); await felder[i].type('48271'[i]); }
  await seite.selectOption('#sicherheit', 'ohne-rechenzeit');
  await seite.selectOption('#notausgang-modus', 'geheim');
  await seite.selectOption('#notausgang-min', '3600');
  await seite.selectOption('#notausgang-max', '18000');
  console.log('Optionen:', await seite.$$eval('#notausgang-min option', els => els.slice(0, 4).map(e => e.textContent).join(' | ')));
  console.log('Wartefrist-Feld sichtbar:', await seite.isVisible('#notausgang-frist'));
  console.log('Spanne:', await seite.textContent('#notausgang-spanne'));
  console.log('Abschluss:', await seite.textContent('#abschluss-warnung'));
  await seite.screenshot({ path: AUSGABE + '/schuss-wenigersicher-setup.png', fullPage: true });

  await seite.selectOption('#notausgang-modus', 'geheim');
  await seite.evaluate(() => {
    for (const [id, wert] of [['#notausgang-min', '3'], ['#notausgang-max', '8']]) {
      const feld = document.querySelector(id);
      feld.innerHTML = '';
      const opt = document.createElement('option');
      opt.value = wert; feld.appendChild(opt); feld.value = wert;
    }
  });
  await seite.$$eval('.dimension-karte input[type=checkbox]', els => els.forEach(e => {
    if (!e.disabled) { e.checked = (e.value === 'geduld'); e.dispatchEvent(new Event('change', { bubbles: true })); }
  }));
  await seite.click('#verriegeln');
  await seite.waitForSelector('.ziffernband', { timeout: 60000 });

  const gespeichert = await seite.evaluate(() => {
    const t = JSON.parse(localStorage.getItem('tresor.v1'));
    const e = t.notausgang;
    return {
      art: e.art, rahmen: e.rahmen, hatSchluessel: !!e.schluessel, hatSchloss: !!e.schloss,
      wartezeitSekunden: Math.round((e.frei - t.erstellt) / 1000),
      fragmentSchloss: !!t.fragmente[0].schloss
    };
  });
  console.log('Gespeichert:', JSON.stringify(gespeichert),
    '| im Rahmen:', gespeichert.wartezeitSekunden >= 3 && gespeichert.wartezeitSekunden <= 8 ? 'JA' : 'NEIN');

  const teaser = (await seite.textContent('.notausgang-karte')).replace(/\s+/g, ' ');
  console.log('Teaser:', teaser.slice(0, 230));
  console.log('Verrät keine Uhrzeit:', /\d{1,2}:\d{2}/.test(teaser) ? 'NEIN' : 'JA');

  await seite.waitForFunction(() => {
    const knopf = document.querySelector('.notausgang-karte button.haupt');
    return !!knopf && !knopf.disabled;
  }, null, { timeout: 30000 });
  console.log('Notausgang wurde offen nach Wartezeit.');
  console.log('Karte:', (await seite.textContent('.notausgang-karte')).replace(/\s+/g, ' ').slice(0, 170));
  await seite.screenshot({ path: AUSGABE + '/schuss-wartenotausgang.png', fullPage: true });
  await seite.click('.notausgang-karte button.haupt');
  await seite.waitForFunction(() => document.querySelectorAll('.bandziffer.ist-offen').length === 5, null, { timeout: 20000 });
  const ergebnis = await seite.evaluate(() => ({
    band: [...document.querySelectorAll('.bandziffer')].map(e => e.textContent).join(''),
    archiv: JSON.parse(localStorage.getItem('tresor.archiv.v1') || '[]').length
  }));
  console.log('Ergebnis:', JSON.stringify(ergebnis), '| korrekt:', ergebnis.band === '48271' ? 'JA' : 'NEIN');
  console.log(fehler.length ? 'FEHLER:\n' + fehler.join('\n') : 'Keine Konsolenfehler.');
  await browser.close();
})();
