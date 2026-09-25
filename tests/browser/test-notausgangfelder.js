const { chromium } = require('./playwright.js');

/* Der Notausgang ist unter "meinen Regeln" der einzige Wert, den der Spieler
 * setzt. Alle drei Spielarten muessen dort einstellbar sein. */
(async () => {
  const browser = await chromium.launch();
  const k = await browser.newContext({ viewport: { width: 420, height: 950 } });
  const s = await k.newPage();
  const fehler = [];
  s.on('pageerror', e => fehler.push('pageerror: ' + e.message));
  s.on('console', m => { if (m.type() === 'error') fehler.push('console: ' + m.text()); });
  await s.goto('http://127.0.0.1:8099/index.html');
  await s.waitForSelector('#blindgang');

  const sichtbar = sel => s.evaluate(sel => {
    const e = document.querySelector(sel);
    return !!(e && e.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true }));
  }, sel);

  const pruefe = async (marke) => {
    for (const modus of ['aus', 'fest', 'zufall', 'geheim']) {
      await s.selectOption('#notausgang-modus', modus);
      await s.waitForTimeout(250);
      const fest = await sichtbar('#notausgang-dauer');
      const spanne = await sichtbar('#notausgang-min');
      const soll = { aus: [false, false], fest: [true, false], zufall: [false, true], geheim: [false, true] }[modus];
      const ok = fest === soll[0] && spanne === soll[1];
      const wert = fest ? await s.$eval('#notausgang-dauer', e => e.options[e.selectedIndex].textContent) : '-';
      console.log(`${marke}  ${modus.padEnd(7)} feste Dauer: ${String(fest).padEnd(5)} Spanne: ${String(spanne).padEnd(5)} ` +
                  `${ok ? 'richtig' : 'FALSCH'}  ${wert !== '-' ? '(' + wert.trim() + ')' : ''}`);
      if (!ok) fehler.push(marke + ' ' + modus);
    }
    const hinweis = await s.textContent('#notausgang-spanne');
    console.log(`${marke}  Erklärung: "${hinweis.trim().slice(0, 78)}"`);
  };

  await pruefe('NORMAL');
  await s.check('#blindgang');
  await s.waitForTimeout(300);
  await pruefe('REGELN');

  // und der eingestellte Wert muss auch im Tresor ankommen
  await s.selectOption('#notausgang-modus', 'fest');
  await s.selectOption('#notausgang-dauer', '1800');
  await s.waitForTimeout(250);
  const konfig = await s.evaluate(() => {
    const el = document.querySelector('#blindgang');
    return { blind: el.checked };
  });
  await s.evaluate(() => { Tresor.tresorLogik.RECHENZEIT_STUFEN.forEach((_, i) => { Tresor.tresorLogik.RECHENZEIT_STUFEN[i] = 2; }); });
  const f = await s.$$('#ziffernfelder .zifferfeld');
  for (let i = 0; i < f.length; i++) { await f[i].click(); await f[i].type('3'); }
  await s.waitForTimeout(300);
  await s.click('#verriegeln');
  await s.waitForSelector('#aufgabenkarte', { timeout: 60000 });
  const gespeichert = await s.evaluate(() => {
    const t = JSON.parse(localStorage.getItem('tresor.v1'));
    return { blind: t.konfig.blind, modus: t.konfig.notausgang.modus,
             gesetzt: t.konfig.notausgang.sekunden, imTresor: t.notausgang.sekunden };
  });
  console.log('verriegelt:', JSON.stringify(gespeichert),
              gespeichert.gesetzt === 1800 && gespeichert.imTresor === 1800 ? '-> 30 min uebernommen' : '-> NICHT uebernommen');

  await browser.close();
  console.log(fehler.length ? 'FEHLER:\n' + fehler.join('\n') : 'keine Seitenfehler');
})();
