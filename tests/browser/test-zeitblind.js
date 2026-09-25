const { chromium } = require('./playwright.js');

/* Im Blindgang darf nur die Sperrfrist ihre Uhr verlieren. Zeitfenster und
 * Rueckmeldungen brauchen ihre Termine, sonst sind sie unloesbar.
 *
 * Je Aufgabe ein eigener Kontext: Wird im laufenden Tresor umgeschrieben,
 * ueberschreibt das Aufraeumen der alten Aufgabe die Aenderung wieder. */
const AUFGABEN = {
  wartezeit:   { id: 'wartezeit',   dimension: 'zeit', params: { sekunden: 3600 } },
  zeitfenster: { id: 'zeitfenster', dimension: 'zeit', params: { von: 9, bis: 17 } },
  intervall:   { id: 'intervall',   dimension: 'zeit', params: { anzahl: 3, abstand: 720, stufe: 2 } }
};

(async () => {
  const browser = await chromium.launch();
  const fehler = [];

  const lauf = async (blind, schluessel) => {
    const k = await browser.newContext({ viewport: { width: 420, height: 950 } });
    const s = await k.newPage();
    s.on('pageerror', e => fehler.push('pageerror: ' + e.message));
    s.on('console', m => { if (m.type() === 'error') fehler.push('console: ' + m.text()); });
    s.on('dialog', d => d.accept());
    await s.goto('http://127.0.0.1:8099/index.html');
    await s.waitForSelector('#blindgang');
    await s.evaluate(() => { Tresor.tresorLogik.RECHENZEIT_STUFEN.forEach((_, i) => { Tresor.tresorLogik.RECHENZEIT_STUFEN[i] = 2; }); });
    const f = await s.$$('#ziffernfelder .zifferfeld');
    for (let i = 0; i < f.length; i++) { await f[i].click(); await f[i].type('5'); }
    if (blind) { await s.check('#blindgang'); await s.selectOption('#blind-zeitschloss', 'rechenzeit'); }
    else {
      await s.$$eval('.dimension-karte input[type=checkbox]', els => els.forEach(e => {
        if (!e.disabled) { e.checked = (e.value === 'zeit'); e.dispatchEvent(new Event('change', { bubbles: true })); }
      }));
      await s.$eval('#aufgaben-pro-fragment', e => { e.value = '1'; e.dispatchEvent(new Event('input')); });
      await s.$eval('#rechenzeit', e => { e.value = '1'; e.dispatchEvent(new Event('input')); });
    }
    await s.selectOption('#notausgang-modus', 'aus');
    await s.waitForTimeout(400);
    await s.click('#verriegeln');
    await s.waitForSelector('#aufgabenkarte', { timeout: 60000 });

    // vor dem App-Start setzen, sonst ueberschreibt das naechste Sichern es
    await k.addInitScript((wunsch) => {
      try {
        const roh = localStorage.getItem('tresor.v1'); if (!roh) return;
        const t = JSON.parse(roh);
        if (t.fragmente[0].offen || t.fragmente[0].aufgaben[0].id === wunsch.id) return;
        t.fragmente[0].aufgaben = [Object.assign({ zustand: {}, erledigt: false }, wunsch)];
        localStorage.setItem('tresor.v1', JSON.stringify(t));
      } catch (e) {}
    }, AUFGABEN[schluessel]);
    await s.reload();
    await s.waitForSelector('.aufgabe-titel', { timeout: 20000 });
    await s.waitForTimeout(1000);

    const bild = await s.evaluate(() => ({
      titel: document.querySelector('.aufgabe-titel').textContent.trim(),
      text: document.querySelector('.aufgabenkarte').innerText.replace(/\s+/g, ' ').trim()
    }));
    // Uhrzeit (11:31) oder Dauer (12 min) irgendwo in der Karte?
    const zeigtZeit = /\d{1,2}[:.]\d{2}|\d+\s*(min|Sekunden|s\b|h\b|Stunde)/.test(bild.text);
    console.log(
      `${blind ? 'BLIND ' : 'NORMAL'} ${bild.titel.padEnd(14)} Zeitangabe: ${zeigtZeit ? 'JA ' : 'NEIN'}` +
      `  "${bild.text.slice(0, 96)}"`);
    await k.close();
    return { titel: bild.titel, zeigtZeit };
  };

  const ergebnis = {};
  for (const schluessel of ['wartezeit', 'zeitfenster', 'intervall']) {
    ergebnis[schluessel] = {
      normal: await lauf(false, schluessel),
      blind: await lauf(true, schluessel)
    };
  }

  console.log('\n--- Soll ---');
  const soll = [
    ['wartezeit',   'blind ohne Zeit', ergebnis.wartezeit.blind.zeigtZeit === false],
    ['zeitfenster', 'blind MIT Zeit',  ergebnis.zeitfenster.blind.zeigtZeit === true],
    ['intervall',   'blind MIT Zeit',  ergebnis.intervall.blind.zeigtZeit === true]
  ];
  soll.forEach(([name, was, ok]) => console.log(`  ${name.padEnd(12)} ${was.padEnd(16)} ${ok ? 'erfüllt' : 'VERLETZT'}`));
  await browser.close();
  console.log(fehler.length ? '\nFEHLER:\n' + fehler.join('\n') : '\nkeine Seitenfehler');
})();
