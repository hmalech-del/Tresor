const { chromium } = require('./playwright.js');
const AUSGABE = require('path').join(__dirname, 'schuesse');

(async () => {
  const browser = await chromium.launch();
  const fehler = [];

  const lauf = async (ohneRechenzeit) => {
    const k = await browser.newContext({ viewport: { width: 420, height: 1000 }, deviceScaleFactor: 2 });
    const s = await k.newPage();
    s.on('pageerror', e => fehler.push('pageerror: ' + e.message));
    s.on('console', m => { if (m.type() === 'error') fehler.push('console: ' + m.text()); });
    s.on('dialog', d => d.accept());
    await s.goto('http://127.0.0.1:8099/index.html');
    await s.waitForSelector('#blindgang');
    await s.check('#blindgang');
    await s.waitForTimeout(250);
    console.log('Schalter "ohne Rechenzeit" sichtbar:',
      await s.$eval('#blind-sanft-zeile', e => !e.classList.contains('versteckt')));
    await s.selectOption('#blind-zeitschloss', ohneRechenzeit ? 'ohne-rechenzeit' : 'rechenzeit');
    await s.waitForTimeout(250);
    console.log('  Warnung:', (await s.textContent('#blindgang-warnung')).trim().slice(0, 72));
    await s.selectOption('#notausgang-modus', 'fest');
    await s.waitForTimeout(250);
    console.log('  Notausgang-Einheit:', await s.$eval('#notausgang-dauer', e => e.options[e.selectedIndex].textContent.trim()));

    await s.evaluate(() => { Tresor.tresorLogik.RECHENZEIT_STUFEN.forEach((_, i) => { Tresor.tresorLogik.RECHENZEIT_STUFEN[i] = 600; }); });
    const f = await s.$$('#ziffernfelder .zifferfeld');
    for (let i = 0; i < f.length; i++) { await f[i].click(); await f[i].type('4'); }
    await s.waitForTimeout(300);
    await s.click('#verriegeln');
    await s.waitForSelector('#aufgabenkarte', { timeout: 90000 });
    const konf = await s.evaluate(() => {
      const t = JSON.parse(localStorage.getItem('tresor.v1'));
      return { sicherheit: t.konfig.sicherheit, blind: t.konfig.blind,
               hatSchloss: !!t.fragmente[0].schloss, exitArt: t.notausgang.art };
    });
    console.log('  verriegelt:', JSON.stringify(konf));

    if (!ohneRechenzeit) {
      // Aufgaben abhaken, damit der Bann sichtbar wird
      await k.addInitScript(() => {
        try {
          const t = JSON.parse(localStorage.getItem('tresor.v1'));
          if (!t || t.fragmente[0].offen) return;
          t.fragmente[0].aufgaben.forEach(a => { a.erledigt = true; });
          localStorage.setItem('tresor.v1', JSON.stringify(t));
        } catch (e) {}
      });
      await s.reload();
      await s.waitForSelector('.aufgabenkarte .mahlwerk', { timeout: 30000 });
      await s.waitForTimeout(2000);
      const m = await s.evaluate(() => {
        const bann = document.querySelector('.aufgabenkarte .mahlwerk');
        const exit = document.querySelector('.notausgang-karte .mahlwerk');
        const stil = getComputedStyle(bann, '::after');
        return {
          bannLaeuft: !bann.classList.contains('ist-still'),
          bannHatBalken: !!document.querySelector('.aufgabenkarte .balken'),
          animation: stil.animationName + ' ' + stil.animationPlayState,
          exitDa: !!exit, exitStill: exit ? exit.classList.contains('ist-still') : null
        };
      });
      console.log('  Mahlwerk:', JSON.stringify(m));
      // anhalten -> muss stillstehen
      await s.click('.aufgabenkarte button.haupt');
      await s.waitForTimeout(800);
      console.log('  nach Pause still:', await s.$eval('.aufgabenkarte .mahlwerk', e => e.classList.contains('ist-still')));
      await s.screenshot({ path: AUSGABE + '/schuss-mahlwerk.png', fullPage: true });
    }
    await k.close();
  };

  console.log('=== mit Rechenzeit ===');       await lauf(false);
  console.log('=== ohne Rechenzeit ===');      await lauf(true);
  await browser.close();
  console.log(fehler.length ? 'FEHLER:\n' + fehler.join('\n') : 'keine Seitenfehler');
})();
