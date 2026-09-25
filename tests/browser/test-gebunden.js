const { chromium } = require('./playwright.js');
const AUSGABE = require('path').join(__dirname, 'schuesse');

(async () => {
  const browser = await chromium.launch();
  const seite = await browser.newPage({ viewport: { width: 420, height: 950 } });
  const fehler = [];
  seite.on('pageerror', e => fehler.push('pageerror: ' + e.message));
  seite.on('console', m => { if (m.type() === 'error') fehler.push('console: ' + m.text()); });

  await seite.goto('http://127.0.0.1:8099/index.html');
  await seite.waitForSelector('#ziffernfelder .zifferfeld');

  // Testbeschleunigung + Mitschnitt der erzeugten Lösungen
  await seite.evaluate(() => {
    Tresor.tresorLogik.RECHENZEIT_STUFEN[0] = 2;
    Tresor.tresorLogik.STRAFZEIT_BASIS[2] = 3;
    window.__loesungen = [];
    Tresor.herausforderungen.liste().forEach(m => {
      if (!m.antwortGebunden) return;
      const orig = m.erzeuge;
      m.erzeuge = function (z, s) {
        const p = orig.call(m, z, s);
        if (p && p.loesung) window.__loesungen.push({ id: m.id, loesung: m.normalisiere(p.loesung) });
        return p;
      };
    });
  });

  const felder = await seite.$$('#ziffernfelder .zifferfeld');
  for (let i = 0; i < felder.length; i++) { await felder[i].click(); await felder[i].type('48271'[i]); }

  console.log('Dimensionen in der Oberfläche:',
    await seite.$$eval('.dimension-karte strong', els => els.map(e => e.textContent).join(', ')));

  // nur Rätsel, eine Aufgabe je Fragment, harte Strafzeit
  await seite.$$eval('.dimension-karte input[type=checkbox]', els => els.forEach(e => {
    if (!e.disabled) { e.checked = (e.value === 'raetsel'); e.dispatchEvent(new Event('change', { bubbles: true })); }
  }));
  await seite.$eval('#stufe-raetsel', e => { e.value = '1'; e.dispatchEvent(new Event('input')); });
  await seite.$eval('#aufgaben-pro-fragment', e => { e.value = '1'; e.dispatchEvent(new Event('input')); });
  await seite.$eval('#rechenzeit', e => { e.value = '1'; e.dispatchEvent(new Event('input')); });
  await seite.selectOption('#strafzeit', '2');
  console.log('Schätzung:', await seite.textContent('#schaetzung'), '|', await seite.textContent('#schaetzung-detail'));
  await seite.screenshot({ path: AUSGABE + '/schuss-zeitregeln.png', fullPage: true });

  await seite.evaluate(() => { window.__loesungen = []; });
  await seite.click('#verriegeln');
  await seite.waitForSelector('.ziffernband', { timeout: 120000 });
  const loesungen = await seite.evaluate(() => window.__loesungen);
  console.log('Mitgeschnittene Lösungen:', JSON.stringify(loesungen));

  const gespeichert = await seite.evaluate(() => {
    const t = JSON.parse(localStorage.getItem('tresor.v1'));
    const roh = JSON.stringify(t);
    return {
      enthaeltLoesungSchluessel: roh.includes('"loesung"'),
      enthaeltKlartextLoesung: window.__loesungen.some(l => roh.includes(l.loesung)),
      hatPruefung: !!t.fragmente[0].aufgaben[0].pruefung,
      iterationen: t.fragmente[0].iterationen,
      salzLaenge: (t.fragmente[0].antwortSalz || '').length,
      aufgaben: t.fragmente.map(f => f.aufgaben.map(a => a.id).join(','))
    };
  });
  console.log('Speicherbild:', JSON.stringify(gespeichert));

  // falsche Antwort -> Ablehnung + Strafzeit
  console.log('Aufgabe 1:', await seite.textContent('.aufgabe-titel'));
  await seite.fill('.aufgabenkarte .antwortfeld', 'falschewort');
  await seite.click('.aufgabenkarte .antwortzeile .knopf');
  await seite.waitForSelector('.aufgabenkarte .countdown', { timeout: 20000 });
  console.log('Nach falscher Antwort:', (await seite.textContent('.aufgabe-titel')).trim(),
    '|', (await seite.textContent('.aufgabe-hinweis')).replace(/\s+/g, ' ').trim());
  await seite.screenshot({ path: AUSGABE + '/schuss-strafzeit.png', fullPage: true });

  // Strafzeit absitzen, dann richtig antworten
  await seite.waitForSelector('.aufgabenkarte .antwortfeld', { timeout: 20000 });
  await seite.fill('.aufgabenkarte .antwortfeld', loesungen[0].loesung);
  await seite.click('.aufgabenkarte .antwortzeile .knopf');
  await seite.waitForFunction(() => document.querySelectorAll('.bandziffer.ist-offen').length > 0, null, { timeout: 60000 })
    .catch(async () => {
      console.log('   !! Bühne:', (await seite.textContent('#buehne')).replace(/\s+/g, ' ').slice(0, 300));
      throw new Error('keine Ziffer frei');
    });
  const nachFreigabe = await seite.evaluate(() => {
    const t = JSON.parse(localStorage.getItem('tresor.v1'));
    return {
      ziffer: t.fragmente[0].inhalt,
      antwortGeloescht: t.fragmente[0].aufgaben[0].zustand.antwort === true,
      band: [...document.querySelectorAll('.bandziffer')].map(e => e.textContent).join('')
    };
  });
  console.log('Freigabe:', JSON.stringify(nachFreigabe), '| korrekt:', nachFreigabe.ziffer === '4' ? 'JA' : 'NEIN');

  console.log(fehler.length ? 'FEHLER:\n' + fehler.join('\n') : 'Keine Konsolenfehler.');
  await browser.close();
})();
