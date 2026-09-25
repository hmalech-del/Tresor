const { chromium } = require('./playwright.js');
const AUSGABE = require('path').join(__dirname, 'schuesse');

async function neueSeite(browser) {
  // eigener Kontext = eigener localStorage, sonst schreibt die alte Seite beim
  // Verlassen ihren Stand zurueck
  const kontext = await browser.newContext({ viewport: { width: 420, height: 950 } });
  const seite = await kontext.newPage();
  seite.on('pageerror', e => console.log('PAGEERROR:', e.message));
  seite.on('console', m => { if (m.type() === 'error') console.log('CONSOLE-ERROR:', m.text()); });
  await seite.goto('http://127.0.0.1:8099/index.html');
  await seite.waitForSelector('#ziffernfelder .zifferfeld');
  return seite;
}

async function einrichten(seite, dimension, extras) {
  await seite.waitForSelector('#ziffernfelder .zifferfeld');
  await seite.evaluate(() => {
    Tresor.tresorLogik.RECHENZEIT_STUFEN[0] = 2;
    Tresor.tresorLogik.STRAFZEIT_BASIS[1] = 3;
  });
  const felder = await seite.$$('#ziffernfelder .zifferfeld');
  for (let i = 0; i < felder.length; i++) { await felder[i].click(); await felder[i].type('48271'[i]); }
  await seite.$$eval('.dimension-karte input[type=checkbox]', (els, dim) => els.forEach(e => {
    if (!e.disabled) { e.checked = (e.value === dim); e.dispatchEvent(new Event('change', { bubbles: true })); }
  }), dimension);
  await seite.$eval('#stufe-' + dimension, e => { e.value = '1'; e.dispatchEvent(new Event('input')); });
  await seite.$eval('#aufgaben-pro-fragment', e => { e.value = '1'; e.dispatchEvent(new Event('input')); });
  await seite.$eval('#rechenzeit', e => { e.value = '1'; e.dispatchEvent(new Event('input')); });
  if (extras) await extras(seite);
  await seite.click('#verriegeln');
  await seite.waitForSelector('.ziffernband', { timeout: 180000 });
}

(async () => {
  const browser = await chromium.launch();
  const seite = await neueSeite(browser);

  // ---------- 1. Notausgang ----------
  await einrichten(seite, 'geduld', async s => {
    await s.selectOption('#notausgang-modus', 'geheim');
    await s.evaluate(() => {
      for (const [id, wert] of [['#notausgang-min', '3'], ['#notausgang-max', '6']]) {
        const feld = document.querySelector(id);
        feld.innerHTML = '';
        const opt = document.createElement('option');
        opt.value = wert; feld.appendChild(opt); feld.value = wert;
      }
    });
  });
  console.log('Notausgang-Karte:', (await seite.textContent('.notausgang-karte')).replace(/\s+/g, ' ').slice(0, 120));
  await seite.click('.notausgang-karte button.knopf');
  await seite.waitForSelector('.notausgang-karte .countdown');
  await seite.waitForFunction(() => document.querySelectorAll('.bandziffer.ist-offen').length === 5, null, { timeout: 120000 });
  const exitErgebnis = await seite.evaluate(() => {
    const t = JSON.parse(localStorage.getItem('tresor.v1'));
    return {
      band: [...document.querySelectorAll('.bandziffer')].map(e => e.textContent).join(''),
      benutzt: t.notausgang.benutzt,
      alleOffen: t.fragmente.every(f => f.offen)
    };
  });
  console.log('Notausgang:', JSON.stringify(exitErgebnis), '| korrekt:', exitErgebnis.band === '48271' ? 'JA' : 'NEIN');
  await seite.screenshot({ path: AUSGABE + '/schuss-notausgang.png', fullPage: true });

  // ---------- 2. Geheime Frist ----------
  const seite2 = await neueSeite(browser);
  await einrichten(seite2, 'geduld', async s => {
    await s.$eval('#frist-aktiv', e => { e.checked = true; e.dispatchEvent(new Event('change', { bubbles: true })); });
    await s.selectOption('#frist-bezug', 'aufgabe');
    await s.selectOption('#strafzeit', '1');
  });
  const fristVorher = await seite2.evaluate(() => JSON.parse(localStorage.getItem('tresor.v1')).fragmente[0].frist
    || JSON.parse(localStorage.getItem('tresor.v1')).fragmente[0].aufgaben[0].frist);
  console.log('Gezogene Frist (Sekunden):', fristVorher, '| Marke sichtbar:', await seite2.isVisible('.fristmarke'));
  // Frist auf 3 s kürzen und ablaufen lassen
  await seite2.context().addInitScript(() => {
    try {
      const t = JSON.parse(localStorage.getItem('tresor.v1') || 'null');
      if (!t || !t.fragmente[0].aufgaben[0].frist || t.fragmente[0].aufgaben[0].frist <= 4) return;
      t.fragmente[0].aufgaben[0].frist = 3;
      t.fragmente[0].aufgaben[0].zustand.fristStart = 0;
      localStorage.setItem('tresor.v1', JSON.stringify(t));
    } catch (e) {}
  });
  await seite2.reload();
  await seite2.waitForSelector('.aufgabe-titel');
  await seite2.waitForFunction(() => /^Strafe$/.test(document.querySelector('.aufgabe-titel').textContent), null, { timeout: 30000 });
  console.log('Nach Fristablauf:', (await seite2.textContent('.aufgabe-hinweis')).replace(/\s+/g, ' ').trim());
  const neueFrist = await seite2.evaluate(() => JSON.parse(localStorage.getItem('tresor.v1')).fragmente[0].aufgaben[0].frist);
  console.log('Neue Frist gezogen:', neueFrist, '| verschieden von 3:', neueFrist !== 3 ? 'JA' : 'NEIN');

  // ---------- 3. Glück ----------
  const seite3 = await neueSeite(browser);
  await einrichten(seite3, 'glueck');
  const titel = await seite3.textContent('.aufgabe-titel');
  console.log('Glücksaufgabe:', titel);
  let klicks = 0;
  while (klicks < 400) {
    const fertig = await seite3.evaluate(() => document.querySelectorAll('.bandziffer.ist-offen').length > 0
      || /Zeitschloss/.test((document.querySelector('.aufgabe-titel') || {}).textContent || ''));
    if (fertig) break;
    const knopf = await seite3.$('.aufgabe-koerper button:not([disabled])');
    if (knopf) { await knopf.click().catch(() => {}); klicks++; }
    await seite3.waitForTimeout(120);
  }
  console.log('Glücksaufgabe gelöst nach', klicks, 'Klicks | jetzt:', await seite3.textContent('.aufgabe-titel'));
  await seite3.screenshot({ path: AUSGABE + '/schuss-glueck.png', fullPage: true });

  await browser.close();
})();
