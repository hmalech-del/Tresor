const { chromium } = require('./playwright.js');

(async () => {
  const browser = await chromium.launch();
  const k = await browser.newContext({ viewport: { width: 420, height: 1000 } });
  const s = await k.newPage();
  const fehler = [];
  s.on('pageerror', e => fehler.push('pageerror: ' + e.message));
  s.on('console', m => { if (m.type() === 'error') fehler.push('console: ' + m.text()); });
  s.on('dialog', d => d.accept());
  await s.goto('http://127.0.0.1:8099/index.html');
  await s.waitForSelector('#notausgang-modus');
  await s.waitForTimeout(400);

  console.log('Modus-Vorgabe:   ', await s.$eval('#notausgang-modus', e => e.value));
  console.log('Dauer-Vorgabe:   ', await s.$eval('#notausgang-dauer', e => e.options[e.selectedIndex].textContent.trim()));
  console.log('Feld sichtbar:   ', await s.evaluate(() =>
    document.querySelector('#notausgang-dauer').checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true })));
  console.log('Erklärung:       ', (await s.textContent('#notausgang-spanne')).trim());
  console.log('Abschlusswarnung:', (await s.textContent('#abschluss-warnung')).trim().slice(0, 110));
  console.log('Budget daraus:   ', await s.evaluate(() => {
    const L = Tresor.tresorLogik;
    const k = L.standardKonfiguration();
    return L.zeitBudget(k) + ' s, je Platz ' + Math.floor(L.zeitBudget(k) / (5 * k.aufgabenProFragment)) + ' s';
  }));

  // Ohne irgendetwas anzufassen verriegeln
  await s.evaluate(() => { Tresor.tresorLogik.RECHENZEIT_STUFEN.forEach((_, i) => { Tresor.tresorLogik.RECHENZEIT_STUFEN[i] = 2; }); });
  const f = await s.$$('#ziffernfelder .zifferfeld');
  for (let i = 0; i < f.length; i++) { await f[i].click(); await f[i].type('9'); }
  await s.waitForTimeout(300);
  console.log('Schätzung:       ', await s.textContent('#schaetzung'));
  await s.click('#verriegeln');
  await s.waitForSelector('#aufgabenkarte', { timeout: 60000 });
  const t = await s.evaluate(() => {
    const t = JSON.parse(localStorage.getItem('tresor.v1'));
    const lang = [];
    t.fragmente.forEach(fr => fr.aufgaben.forEach(a => {
      const m = Tresor.herausforderungen.hole(a.id);
      lang.push({ id: a.id, s: m.schaetzung(a.params) });
    }));
    lang.sort((x, y) => y.s - x.s);
    return { exit: t.notausgang && { art: t.notausgang.art, sekunden: t.notausgang.sekunden },
             laengste: lang.slice(0, 3) };
  });
  console.log('Im Tresor:       ', JSON.stringify(t.exit));
  console.log('längste Aufgaben:', t.laengste.map(x => x.id + ' ' + x.s + ' s').join(', '));
  await browser.close();
  console.log(fehler.length ? 'FEHLER:\n' + fehler.join('\n') : 'keine Seitenfehler');
})();
