const { chromium } = require('./playwright.js');
const AUSGABE = require('path').join(__dirname, 'schuesse');

/* Im Blindgang darf keine Zahl die Zukunft verraten. */
(async () => {
  const browser = await chromium.launch();
  const fehler = [];
  const lauf = async (blind) => {
    const k = await browser.newContext({ viewport: { width: 420, height: 1100 }, deviceScaleFactor: 2 });
    const s = await k.newPage();
    s.on('pageerror', e => fehler.push('pageerror: ' + e.message));
    s.on('console', m => { if (m.type() === 'error') fehler.push('console: ' + m.text()); });
    s.on('dialog', d => d.accept());
    await s.goto('http://127.0.0.1:8099/index.html');
    await s.waitForSelector('#blindgang');
    await s.evaluate(() => { Tresor.tresorLogik.RECHENZEIT_STUFEN.forEach((_, i) => { Tresor.tresorLogik.RECHENZEIT_STUFEN[i] = 600; }); });
    const f = await s.$$('#ziffernfelder .zifferfeld');
    for (let i = 0; i < f.length; i++) { await f[i].click(); await f[i].type('8'); }
    if (blind) { await s.check('#blindgang'); await s.selectOption('#blind-zeitschloss', 'rechenzeit'); }
    else {
      await s.$$eval('.dimension-karte input[type=checkbox]', els => els.forEach(e => {
        if (!e.disabled) { e.checked = (e.value === 'glueck'); e.dispatchEvent(new Event('change', { bubbles: true })); }
      }));
      await s.$eval('#aufgaben-pro-fragment', e => { e.value = '1'; e.dispatchEvent(new Event('input')); });
      await s.$eval('#rechenzeit', e => { e.value = '3'; e.dispatchEvent(new Event('input')); });
    }
    await s.selectOption('#notausgang-modus', 'geheim');
    await s.waitForTimeout(400);
    await s.click('#verriegeln');
    await s.waitForSelector('#aufgabenkarte', { timeout: 90000 });
    // Aufgaben vom Tisch, damit der Bann sichtbar wird
    await k.addInitScript(() => {
      try {
        const t = JSON.parse(localStorage.getItem('tresor.v1'));
        if (!t || t.fragmente[0].offen) return;
        t.fragmente[0].aufgaben.forEach(a => { a.erledigt = true; });
        localStorage.setItem('tresor.v1', JSON.stringify(t));
      } catch (e) {}
    });
    await s.reload();
    await s.waitForSelector('.aufgabenkarte .countdown', { timeout: 30000 });
    await s.waitForTimeout(1500);
    const bild = await s.evaluate(() => ({
      bann: document.querySelector('.aufgabenkarte .countdown').textContent.trim(),
      bannText: (document.querySelector('.aufgabenkarte .balken-text') || {}).textContent || '',
      hinweis: document.querySelector('.aufgabe-hinweis').textContent.trim(),
      wort: (document.querySelector('.wachterwort') || {}).textContent || '',
      exit: (document.querySelector('.notausgang-karte') || {}).innerText.replace(/\n+/g, ' | ').slice(0, 130),
      fahrplan: ([...document.querySelectorAll('.karte')].map(x => x.innerText).filter(x => x.startsWith('Fahrplan'))[0] || 'gibt es nicht').replace(/\n+/g, ' | ').slice(0, 90)
    }));
    console.log((blind ? 'BLIND  ' : 'NORMAL ') + JSON.stringify(bild, null, 1).replace(/\n\s*/g, ' '));
    await s.screenshot({ path: AUSGABE + (blind ? '/schuss-dunkel.png' : '/schuss-hell.png'), fullPage: true });
    await k.close();
  };
  await lauf(false);
  await lauf(true);
  await browser.close();
  console.log(fehler.length ? 'FEHLER:\n' + fehler.join('\n') : 'keine Seitenfehler');
})();
