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

  // Einstellung zeigen: 1 h bis 5 h
  await seite.selectOption('#notausgang-modus', 'geheim');
  await seite.selectOption('#notausgang-min', '3600');
  await seite.selectOption('#notausgang-max', '18000');
  console.log('Spannen-Hinweis:', await seite.textContent('#notausgang-spanne'));
  console.log('Abschluss-Warnung:', await seite.textContent('#abschluss-warnung'));
  await seite.screenshot({ path: AUSGABE + '/schuss-notausgang-setup.png', fullPage: true });

  // Für den Test auf Sekunden schrumpfen
  await seite.evaluate(() => {
    Tresor.tresorLogik.RECHENZEIT_STUFEN[0] = 2;
    for (const [id, wert] of [['#notausgang-min', '3'], ['#notausgang-max', '9']]) {
      const feld = document.querySelector(id);
      feld.innerHTML = '';
      const opt = document.createElement('option');
      opt.value = wert; feld.appendChild(opt); feld.value = wert;
    }
  });
  await seite.$eval('#rechenzeit', e => { e.value = '1'; e.dispatchEvent(new Event('input')); });
  await seite.click('#verriegeln');
  await seite.waitForSelector('.ziffernband', { timeout: 120000 });

  const gespeichert = await seite.evaluate(() => {
    const t = JSON.parse(localStorage.getItem('tresor.v1'));
    const e = t.notausgang;
    return {
      blind: e.blind, rahmen: e.rahmen,
      schluessel: Object.keys(e.schloss).join(','),
      hatSchrittzahl: 't' in e.schloss || 'sekunden' in e,
      untergrenze: e.schloss.untergrenze, obergrenze: e.schloss.obergrenze,
      pruefLaenge: e.schloss.pruef.length, rate: t.rate
    };
  });
  console.log('Gespeicherter Notausgang:', JSON.stringify(gespeichert));
  console.log('Schrittzahl nirgends gespeichert:', gespeichert.hatSchrittzahl ? 'NEIN' : 'JA');
  console.log('Teaser:', (await seite.textContent('.notausgang-karte')).replace(/\s+/g, ' ').slice(0, 200));

  await seite.click('.notausgang-karte button.knopf');
  await seite.waitForSelector('.notausgang-karte .countdown');
  await seite.waitForTimeout(1200);
  console.log('Anzeige während des Rechnens:', (await seite.textContent('.notausgang-karte .countdown')).trim(),
    '|', (await seite.textContent('.balken-text')).trim());
  console.log('Marke für Untergrenze sichtbar:', await seite.isVisible('.balken-marke'));

  const start = Date.now();
  await seite.waitForFunction(() => document.querySelectorAll('.bandziffer.ist-offen').length === 5, null, { timeout: 120000 });
  const dauer = (Date.now() - start) / 1000;
  const ergebnis = await seite.evaluate(() => {
    const t = JSON.parse(localStorage.getItem('tresor.v1'));
    return {
      band: [...document.querySelectorAll('.bandziffer')].map(e => e.textContent).join(''),
      schritte: t.notausgang.stand.erledigt,
      untergrenze: t.notausgang.schloss.untergrenze,
      obergrenze: t.notausgang.schloss.obergrenze,
      benutzt: t.notausgang.benutzt
    };
  });
  console.log('Geöffnet nach', dauer.toFixed(1), 's |', JSON.stringify(ergebnis));
  console.log('Geheimnis korrekt:', ergebnis.band === '48271' ? 'JA' : 'NEIN',
    '| Schritte im Rahmen:', ergebnis.schritte >= ergebnis.untergrenze && ergebnis.schritte <= ergebnis.obergrenze ? 'JA' : 'NEIN');
  await seite.screenshot({ path: AUSGABE + '/schuss-notausgang-blind.png', fullPage: true });
  console.log(fehler.length ? 'FEHLER:\n' + fehler.join('\n') : 'Keine Konsolenfehler.');
  await browser.close();
})();
