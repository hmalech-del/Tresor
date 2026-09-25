const { chromium } = require('./playwright.js');
const AUSGABE = require('path').join(__dirname, 'schuesse');
const fake = require('./fake-sensor.js');

(async () => {
  const browser = await chromium.launch();
  const k = await browser.newContext({ viewport: { width: 420, height: 1100 }, deviceScaleFactor: 2 });
  await k.addInitScript(fake);
  const s = await k.newPage();
  const fehler = [];
  s.on('pageerror', e => fehler.push('pageerror: ' + e.message));
  s.on('console', m => { if (m.type() === 'error') fehler.push('console: ' + m.text()); });
  await s.goto('http://127.0.0.1:8099/index.html');
  await s.waitForSelector('#verriegeln');

  await s.click('text=Prüfungen ausprobieren');
  await s.waitForSelector('.probe-gruppe', { timeout: 10000 });
  const gruppen = await s.$$eval('.probe-gruppe', els =>
    els.map(e => e.querySelector('summary').textContent.replace(/\s+/g, ' ').trim()));
  console.log('Gruppen (zugeklappt):', gruppen.join(' | '));
  await s.$$eval('.probe-gruppe', els => els.forEach(e => { e.open = true; }));
  await s.waitForTimeout(300);
  const zeilen = await s.$$eval('.probe-zeile', els => els.length);
  console.log('Aufgaben gelistet:', zeilen);

  // Jede Vorschau muss etwas sagen - eine leere waere ein Generator, der nie liefert
  const leer = await s.$$eval('.probe-vorschau', els =>
    els.map((e, i) => [i, e.textContent.trim()]).filter(([, t]) => !t || t.includes('nicht bauen')));
  console.log('Vorschauen ohne Inhalt:', leer.length ? JSON.stringify(leer) : 'keine');

  // Stufenregler wirkt?
  const vorher = await s.$eval('#probe-stufe-halten', e => e.closest('.probe-zeile').querySelector('.probe-vorschau').textContent);
  await s.$eval('#probe-stufe-halten', e => { e.value = '5'; e.dispatchEvent(new Event('input')); });
  await s.waitForTimeout(200);
  const nachher = await s.$eval('#probe-stufe-halten', e => e.closest('.probe-zeile').querySelector('.probe-vorschau').textContent);
  console.log('Stufe 3:', vorher.trim(), '| Stufe 5:', nachher.trim());

  // Wartezeit muss gestaucht sein
  const wartezeit = await s.$eval('#probe-stufe-wartezeit', e => {
    e.value = '5'; e.dispatchEvent(new Event('input'));
    return e.closest('.probe-zeile').querySelector('.probe-vorschau').textContent;
  });
  console.log('Sperrfrist Stufe 5 im Probelauf:', wartezeit.trim());

  // Eine echte Aufgabe durchspielen: Stillhalten auf Stufe 1
  await s.$eval('#probe-stufe-halten', e => { e.value = '1'; e.dispatchEvent(new Event('input')); });
  await s.$eval('#probe-stufe-halten', e => e.closest('.probe-zeile').querySelector('button').click());
  await s.waitForSelector('.halteknopf', { timeout: 10000 });
  console.log('Aufgabe läuft:', (await s.textContent('#probe-buehne .aufgabe-titel')).trim());
  const knopf = await s.$('.halteknopf');
  await knopf.dispatchEvent('pointerdown', { pointerId: 1, isPrimary: true, button: 0 });
  await s.waitForTimeout(600);
  await knopf.dispatchEvent('pointerup', { pointerId: 1, isPrimary: true, button: 0 });
  await s.waitForTimeout(400);
  console.log('nach Loslassen (kein Abbruch, nur Fehlversuch):',
    await s.evaluate(() => !!document.querySelector('.halteknopf')));
  await s.screenshot({ path: AUSGABE + '/schuss-probe.png', fullPage: true });

  // Abbrechen -> Bericht
  await s.$eval('#probe-buehne .knopfzeile button', e => e.click());
  await s.waitForTimeout(400);
  console.log('Bericht:', (await s.textContent('#probe-bericht')).trim());

  // Ein gebundenes Rätsel: Lösung zeigen
  await s.$eval('#probe-stufe-caesar', e => e.closest('.probe-zeile').querySelector('button').click());
  await s.waitForTimeout(500);
  const knoepfe = await s.$$eval('#probe-buehne .knopfzeile button', els => els.map(e => e.textContent));
  console.log('Werkzeuge bei gebundenem Rätsel:', knoepfe.join(', '));
  await s.$$eval('#probe-buehne .knopfzeile button', els => els[1].click());
  await s.waitForTimeout(300);
  console.log('Lösung:', await s.$$eval('#probe-buehne .knopfzeile button', els => els[1].textContent));

  // Die Station muss sich jetzt bauen lassen
  console.log('Station-Vorschau:', (await s.$eval('#probe-stufe-station',
    e => e.closest('.probe-zeile').querySelector('.probe-vorschau').textContent)).trim());

  // Nichts darf im Speicher landen
  console.log('Speicher unberührt:', await s.evaluate(() => !localStorage.getItem('tresor.v1')));
  // Zurueck
  await s.click('text=Zurück zur Einrichtung');
  await s.waitForSelector('#verriegeln', { timeout: 10000 });
  console.log('zurück in der Einrichtung: ja');
  console.log('geliehener Markenvorrat geleert:', await s.evaluate(() => Tresor.ortAufgaben.vorratGroesse() === 0));

  await browser.close();
  console.log(fehler.length ? 'FEHLER:\n' + fehler.join('\n') : 'keine Seitenfehler');
})();
