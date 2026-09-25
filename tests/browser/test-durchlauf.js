const { chromium } = require('./playwright.js');
const AUSGABE = require('path').join(__dirname, 'schuesse');

(async () => {
  const browser = await chromium.launch();
  const seite = await browser.newPage({ viewport: { width: 420, height: 900 } });
  const fehler = [];
  seite.on('pageerror', e => fehler.push('pageerror: ' + e.message));
  seite.on('console', m => { if (m.type() === 'error') fehler.push('console: ' + m.text()); });

  await seite.goto('http://127.0.0.1:8099/index.html');
  await seite.waitForSelector('#ziffernfelder .zifferfeld');
  const zahl = '48271';
  const felder = await seite.$$('#ziffernfelder .zifferfeld');
  for (let i = 0; i < felder.length; i++) { await felder[i].click(); await felder[i].type(zahl[i]); }

  // nur Geduld, eine Aufgabe, kuerzestes Zeitschloss
  /* Nur Geduld. Blieb "Raetsel" angehakt, zog der Tresor fuer Fragment 1
   * manchmal eine Aufgabe, deren Antwort im Schluessel steckt - und nach dem
   * Austausch gegen "Stillhalten" unten fehlte sie. Dann verweigert die App
   * die Entschluesselung, zu Recht; der Test lief in einen Timeout. */
  await seite.$$eval('.dimension-karte input[type=checkbox]', els => els.forEach(e => {
    if (!e.disabled) { e.checked = e.value === 'geduld'; e.dispatchEvent(new Event('change', { bubbles: true })); } }));
  await seite.$eval('#stufe-geduld', e => { e.value = '1'; e.dispatchEvent(new Event('input')); });
  await seite.$eval('#aufgaben-pro-fragment', e => { e.value = '1'; e.dispatchEvent(new Event('input')); });
  await seite.$eval('#rechenzeit', e => { e.value = '1'; e.dispatchEvent(new Event('input')); });
  await seite.click('#verriegeln');
  await seite.waitForSelector('.ziffernband');

  // Aufgabe des ersten Fragments durch ein kurzes "Stillhalten" ersetzen.
  // Als Init-Skript, weil die App beim Verlassen der Seite ihren Stand zurueckschreibt.
  await seite.context().addInitScript(() => {
    try {
      const roh = localStorage.getItem('tresor.v1');
      if (!roh) return;
      const t = JSON.parse(roh);
      if (t.fragmente[0].offen || t.fragmente[0].aufgaben[0].id === 'halten') return;
      t.fragmente[0].aufgaben = [{ id: 'halten', dimension: 'geduld', params: { sekunden: 2 }, zustand: {}, erledigt: false }];
      localStorage.setItem('tresor.v1', JSON.stringify(t));
    } catch (e) {}
  });
  await seite.reload();
  await seite.waitForSelector('.halteknopf');
  console.log('Aufgabe:', await seite.textContent('.aufgabe-titel'));

  // kurz loslassen -> muss zuruecksetzen
  const knopf = await seite.$('.halteknopf');
  const kasten = await knopf.boundingBox();
  await seite.mouse.move(kasten.x + kasten.width/2, kasten.y + kasten.height/2);
  await seite.mouse.down();
  await seite.waitForTimeout(700);
  await seite.mouse.up();
  await seite.waitForTimeout(150);
  console.log('Nach Loslassen:', (await seite.textContent('.aufgabe-meldung')).trim());

  // jetzt richtig durchhalten
  await seite.mouse.down();
  await seite.waitForTimeout(2400);
  await seite.mouse.up();
  await seite.waitForSelector('.countdown', { timeout: 5000 });
  console.log('Zeitschloss-Ansicht erreicht:', await seite.textContent('.aufgabe-titel'));
  await seite.screenshot({ path: AUSGABE + '/schuss-zeitschloss.png', fullPage: true });

  // Mitten im Rechnen neu laden: Fortschritt muss erhalten bleiben
  await seite.waitForTimeout(3500);
  const vorReload = await seite.evaluate(() => JSON.parse(localStorage.getItem('tresor.v1')).fragmente[0].stand.erledigt);
  await seite.reload();
  await seite.waitForSelector('.countdown');
  await seite.waitForTimeout(500);
  const nachReload = await seite.evaluate(() => JSON.parse(localStorage.getItem('tresor.v1')).fragmente[0].stand.erledigt);
  console.log('Rechenfortschritt vor Reload:', vorReload, '| danach:', nachReload, '|', nachReload >= vorReload ? 'erhalten' : 'VERLOREN');

  // bis zur Freigabe warten
  await seite.waitForFunction(() => document.querySelectorAll('.bandziffer.ist-offen').length > 0, null, { timeout: 90000 });
  const ergebnis = await seite.evaluate(() => {
    const t = JSON.parse(localStorage.getItem('tresor.v1'));
    return {
      erste: t.fragmente[0].inhalt,
      offen: t.fragmente[0].offen,
      band: [...document.querySelectorAll('.bandziffer')].map(e => e.textContent).join(''),
      naechsteAufgabe: document.querySelector('.aufgabe-titel') ? document.querySelector('.aufgabe-titel').textContent : '-'
    };
  });
  console.log('Freigegeben:', JSON.stringify(ergebnis), '| korrekt:', ergebnis.erste === '4' ? 'JA' : 'NEIN');
  await seite.screenshot({ path: AUSGABE + '/schuss-freigabe.png', fullPage: true });

  console.log(fehler.length ? 'FEHLER:\n' + fehler.join('\n') : 'Keine Konsolenfehler.');
  await browser.close();
})();
