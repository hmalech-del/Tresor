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
  await seite.evaluate(() => { Tresor.tresorLogik.RECHENZEIT_STUFEN[0] = 40; });

  const felder = await seite.$$('#ziffernfelder .zifferfeld');
  for (let i = 0; i < felder.length; i++) { await felder[i].click(); await felder[i].type('48271'[i]); }
  await seite.$$eval('.dimension-karte input[type=checkbox]', els => els.forEach(e => {
    if (!e.disabled) { e.checked = (e.value === 'geduld'); e.dispatchEvent(new Event('change', { bubbles: true })); }
  }));
  await seite.$eval('#aufgaben-pro-fragment', e => { e.value = '1'; e.dispatchEvent(new Event('input')); });
  await seite.$eval('#rechenzeit', e => { e.value = '1'; e.dispatchEvent(new Event('input')); });

  // Höchstzeit einschalten, Spanne für den Test auf Sekunden schrumpfen
  await seite.$eval('#frist-aktiv', e => { e.checked = true; e.dispatchEvent(new Event('change', { bubbles: true })); });
  console.log('Bezug-Auswahl:', await seite.$$eval('#frist-bezug option', els => els.map(e => e.textContent).join(' / ')));
  console.log('Zeit-Auswahl:', await seite.$$eval('#frist-min-zeit option', els => els.map(e => e.textContent).join(', ')));
  console.log('Hinweis 1 h / 5 h:', await seite.evaluate(() => {
    document.querySelector('#frist-min-zeit').value = '3600';
    document.querySelector('#frist-max-zeit').value = '18000';
    document.querySelector('#frist-max-zeit').dispatchEvent(new Event('change'));
    return document.querySelector('#frist-spanne-hinweis').textContent;
  }));
  console.log('Schätzungszeile:', await seite.textContent('#schaetzung-detail'));
  await seite.screenshot({ path: AUSGABE + '/schuss-hoechstzeit-setup.png', fullPage: true });

  await seite.evaluate(() => {
    for (const id of ['#frist-min-zeit', '#frist-max-zeit']) {
      const feld = document.querySelector(id);
      feld.innerHTML = '';
      const opt = document.createElement('option');
      opt.value = id.includes('min') ? '14' : '18';
      feld.appendChild(opt);
      feld.value = opt.value;
    }
    document.querySelector('#frist-folge').value = 'alles';
  });

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

  await seite.click('#verriegeln');
  await seite.waitForSelector('.ziffernband', { timeout: 120000 });
  const gezogen = await seite.evaluate(() => JSON.parse(localStorage.getItem('tresor.v1')).frist);
  console.log('Gezogene Höchstzeit:', JSON.stringify(gezogen),
    '| im Rahmen:', gezogen.sekunden >= 14 && gezogen.sekunden <= 18 ? 'JA' : 'NEIN');
  console.log('Karte:', (await seite.textContent('.frist-karte')).replace(/\s+/g, ' ').slice(0, 190));

  // Aufgabe erledigen -> Zeitschloss rechnet
  await seite.reload();
  await seite.waitForSelector('.halteknopf');
  const knopf = await seite.$('.halteknopf');
  const kasten = await knopf.boundingBox();
  await seite.mouse.move(kasten.x + kasten.width / 2, kasten.y + kasten.height / 2);
  await seite.mouse.down();
  await seite.waitForTimeout(2400);
  await seite.mouse.up();
  await seite.waitForSelector('.aufgabenkarte .countdown', { timeout: 10000 });
  await seite.waitForTimeout(2500);
  const vorAblauf = await seite.evaluate(() => {
    const t = JSON.parse(localStorage.getItem('tresor.v1'));
    return { erledigt: t.fragmente[0].aufgaben[0].erledigt, schritte: t.fragmente[0].stand.erledigt };
  });
  console.log('Vor Ablauf:', JSON.stringify(vorAblauf));

  // Ablauf abwarten
  await seite.waitForFunction(() => !!document.querySelector('.warnung'), null, { timeout: 40000 });
  console.log('Meldung:', (await seite.textContent('.warnung')).replace(/\s+/g, ' '));
  const nachAblauf = await seite.evaluate(() => {
    const t = JSON.parse(localStorage.getItem('tresor.v1'));
    return {
      erledigt: t.fragmente[0].aufgaben[0].erledigt,
      schritte: t.fragmente[0].stand.erledigt,
      xZurueckgesetzt: t.fragmente[0].stand.x === t.fragmente[0].schloss.a,
      abgelaufen: t.frist.abgelaufen,
      neueSekunden: t.frist.sekunden,
      neuGestartet: Date.now() - t.frist.start < 5000,
      aufgabeWiederAktiv: (document.querySelector('.aufgabe-titel') || {}).textContent
    };
  });
  console.log('Nach Ablauf:', JSON.stringify(nachAblauf));
  await seite.screenshot({ path: AUSGABE + '/schuss-hoechstzeit-abgelaufen.png', fullPage: true });

  console.log(fehler.length ? 'FEHLER:\n' + fehler.join('\n') : 'Keine Konsolenfehler.');
  await browser.close();
})();
