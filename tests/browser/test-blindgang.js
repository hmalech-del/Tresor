const { chromium } = require('./playwright.js');
const AUSGABE = require('path').join(__dirname, 'schuesse');

(async () => {
  const browser = await chromium.launch();
  const k = await browser.newContext({ viewport: { width: 420, height: 950 } });
  const s = await k.newPage();
  const fehler = [];
  s.on('pageerror', e => fehler.push('pageerror: ' + e.message));
  s.on('console', m => { if (m.type() === 'error') fehler.push('console: ' + m.text()); });
  s.on('dialog', d => d.accept());
  await s.goto('http://127.0.0.1:8099/index.html');
  await s.waitForSelector('#blindgang');

  const sichtbar = sel => s.$eval(sel, e => !e.classList.contains('versteckt') && e.offsetParent !== null);

  console.log('vorher  | Dimensionen sichtbar:', await sichtbar('.dimension-karte'),
              '| Schätzung:', await s.textContent('#schaetzung'));
  await s.check('#blindgang'); await s.selectOption('#blind-zeitschloss', 'rechenzeit');
  await s.waitForTimeout(300);
  console.log('blind   | Dimensionen sichtbar:', await sichtbar('.dimension-karte'),
              '| Feineinstellung:', await s.evaluate(() =>
                [...document.querySelectorAll('h2')].some(h => h.textContent.includes('Feineinstellung') && h.offsetParent)),
              '| Notausgang sichtbar:', await sichtbar('#notausgang-modus'),
              '| Schätzung:', await s.textContent('#schaetzung'));
  console.log('        | Überschrift Zeitregeln:', await s.evaluate(() =>
    [...document.querySelectorAll('h2')].map(h => h.textContent).filter(t => /Notausgang|Zeitregeln/.test(t))));

  // gezogene Konfigurationen anschauen
  const proben = await s.evaluate(() => {
    const aus = [];
    for (let i = 0; i < 6; i++) {
      const konf = Tresor.tresorLogik.blindKonfiguration({ modus: 'geheim', minSekunden: 1800, maxSekunden: 7200 }, true);
      aus.push({ dim: konf.dimensionen.length, aufg: konf.aufgabenProFragment, rz: konf.rechenzeit,
                 strafe: konf.strafe, frist: konf.geheimeFrist.aktiv, spiel: konf.gluecksspiel, blind: konf.blind,
                 sicher: konf.sicherheit });
    }
    return aus;
  });
  proben.forEach(p => console.log('   Ziehung:', JSON.stringify(p)));

  // Tresor im Blindgang verriegeln
  await s.evaluate(() => { Tresor.tresorLogik.RECHENZEIT_STUFEN.forEach((_, i) => { Tresor.tresorLogik.RECHENZEIT_STUFEN[i] = 2; }); });
  const f = await s.$$('#ziffernfelder .zifferfeld');
  for (let i = 0; i < f.length; i++) { await f[i].click(); await f[i].type('42'[i % 2]); }
  await s.selectOption('#notausgang-modus', 'aus');
  await s.waitForTimeout(300);
  console.log('Knopf frei:', await s.$eval('#verriegeln', e => !e.disabled));
  await s.click('#verriegeln');
  await s.waitForSelector('#aufgabenkarte', { timeout: 60000 });
  const lage = await s.evaluate(() => {
    const t = JSON.parse(localStorage.getItem('tresor.v1'));
    return {
      blind: t.konfig.blind, dimensionen: t.konfig.dimensionen.length, spiel: t.konfig.gluecksspiel,
      fahrplan: [...document.querySelectorAll('.karte')].map(k => k.innerText).filter(x => x.startsWith('Fahrplan'))[0] || 'keiner - wie gewollt',
      kopf: document.querySelector('.aufgaben-kopf').innerText.replace(/\n/g, ' | ')
    };
  });
  console.log('verriegelt:', JSON.stringify(lage));
  await s.screenshot({ path: AUSGABE + '/schuss-blindgang.png', fullPage: true });

  await browser.close();
  console.log(fehler.length ? 'FEHLER:\n' + fehler.join('\n') : 'keine Seitenfehler');
})();
