const { chromium } = require('./playwright.js');

async function tresorBauen(seite, modus, ohneRechenzeit) {
  await seite.goto('http://127.0.0.1:8099/index.html');
  await seite.waitForSelector('#ziffernfelder .zifferfeld');
  await seite.evaluate(() => { Tresor.tresorLogik.RECHENZEIT_STUFEN[0] = 2; });
  const f = await seite.$$('#ziffernfelder .zifferfeld');
  for (let i = 0; i < f.length; i++) { await f[i].click(); await f[i].type('48271'[i]); }
  await seite.$$eval('.dimension-karte input[type=checkbox]', els => els.forEach(e => {
    if (!e.disabled) { e.checked = (e.value === 'geduld'); e.dispatchEvent(new Event('change', { bubbles: true })); }
  }));
  await seite.$eval('#rechenzeit', e => { e.value = '1'; e.dispatchEvent(new Event('input')); });
  if (ohneRechenzeit) await seite.selectOption('#sicherheit', 'ohne-rechenzeit');
  await seite.selectOption('#notausgang-modus', modus);
  const hinweis = await seite.textContent('#notausgang-spanne');
  const sichtbar = await seite.evaluate(() => ({
    fest: !document.querySelector('#notausgang-fest-feld').classList.contains('versteckt'),
    spanne: !document.querySelector('#notausgang-spanne-felder').classList.contains('versteckt')
  }));
  await seite.evaluate((m) => {
    const setze = (id, wert) => {
      const feld = document.querySelector(id);
      feld.innerHTML = ''; const o = document.createElement('option');
      o.value = String(wert); feld.appendChild(o); feld.value = String(wert);
    };
    if (m === 'fest') setze('#notausgang-dauer', 4);
    else { setze('#notausgang-min', 4); setze('#notausgang-max', 9); }
  }, modus);
  await seite.click('#verriegeln');
  await seite.waitForSelector('.notausgang-karte', { timeout: 60000 });
  return { hinweis, sichtbar };
}

(async () => {
  const browser = await chromium.launch();
  const fehler = [];
  for (const [modus, ohne] of [['fest', false], ['zufall', false], ['geheim', false], ['zufall', true], ['fest', true]]) {
    const kontext = await browser.newContext({ viewport: { width: 420, height: 950 } });
    const seite = await kontext.newPage();
    seite.on('pageerror', e => fehler.push(modus + ': ' + e.message));
    seite.on('console', m => { if (m.type() === 'error') fehler.push(modus + ' console: ' + m.text()); });
    const { hinweis, sichtbar } = await tresorBauen(seite, modus, ohne);
    const daten = await seite.evaluate(() => {
      const e = JSON.parse(localStorage.getItem('tresor.v1')).notausgang;
      return { art: e.art, modus: e.modus, sekunden: e.sekunden, rahmen: e.rahmen,
        hatT: !!(e.schloss && e.schloss.t), hatPruef: !!(e.schloss && e.schloss.pruef) };
    });
    const karte = (await seite.textContent('.notausgang-karte')).replace(/\s+/g, ' ');
    console.log('--- ' + modus + (ohne ? ' (ohne Rechenzeit)' : '') + ' | Felder fest/spanne: ' + sichtbar.fest + '/' + sichtbar.spanne);
    console.log('    Einrichten:', hinweis.slice(0, 135));
    console.log('    gespeichert:', JSON.stringify(daten));
    console.log('    Karte:', karte.slice(0, 165));
    await kontext.close();
  }
  console.log(fehler.length ? 'FEHLER:\n' + fehler.join('\n') : 'Keine Konsolenfehler.');
  await browser.close();
})();
