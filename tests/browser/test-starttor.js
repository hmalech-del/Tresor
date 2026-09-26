// Aufgaben auf Zeit laufen erst nach "Los" - und nach einem Fehler steht das
// Tor wieder, statt sofort weiterzulaufen.
const { chromium } = require('./playwright.js');
const AUSGABE = require('path').join(__dirname, 'schuesse');
let f = 0;
const pruefe = (n, ok, t) => { console.log(`  [${ok ? 'ok  ' : 'FEHL'}] ${n.padEnd(56)} ${t}`); if (!ok) f++; };
const warte = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const seite = await (await browser.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  const fehler = []; seite.on('pageerror', e => fehler.push(e.message));
  await seite.goto('http://127.0.0.1:8099/index.html');
  await seite.waitForFunction(() => window.Tresor && Tresor.herausforderungen);

  // Jede Aufgabe einzeln auf einer Testbuehne starten, wie die App es tut
  async function starte(id, stufe) {
    await seite.evaluate(({ id, stufe }) => {
      const H = Tresor.herausforderungen, m = H.hole(id);
      document.querySelector('#buehne').innerHTML = '<div id="t-wurzel"></div>';
      window.__fehl = 0; window.__fertig = 0;
      const params = m.erzeuge(new Tresor.Zufall(7), stufe);
      if (window.__halt) window.__halt();
      window.__halt = m.starte({ wurzel: document.querySelector('#t-wurzel'), params, zustand: {}, konfig: {},
        speichern() {}, fertig() { window.__fertig++; }, fehlschlag() { window.__fehl++; return false; } });
    }, { id, stufe });
  }
  const sichtbar = sel => seite.$eval(sel, e => !e.closest('[hidden]') && e.offsetParent !== null).catch(() => false);

  for (const [id, zeichen] of [['nback', '.nbackzeichen'], ['stroop', '.stroopwort'], ['zahlenjagd', '.zahlengitter'], ['simon', '.simongitter']]) {
    console.log(id);
    await starte(id, 3);
    await warte(id === 'nback' ? 4500 : 2500);
    const tor = await seite.$('.starttor button');
    pruefe('Tor steht, Aufgabe verborgen', !!tor && !(await sichtbar(zeichen)), tor ? await tor.textContent() : 'kein Tor');
    pruefe('ohne "Los" kein Fehlschlag, auch nach Wartezeit', await seite.evaluate(() => window.__fehl) === 0, '');
    await seite.click('.starttor button');
    pruefe('nach "Los" sichtbar', await sichtbar(zeichen), '');
  }

  console.log('\nN-Back: Fehler -> Tor statt Weiterlaufen');
  await starte('nback', 3);
  await seite.click('.starttor button');
  await warte(2000);
  await seite.click('.aufgabe-koerper button.haupt');           // mit hoher Wahrscheinlichkeit daneben
  const nachFehler = await seite.evaluate(() => ({ fehl: window.__fehl, tor: !!document.querySelector('.starttor button'),
    text: (document.querySelector('.starttor button') || {}).textContent }));
  if (nachFehler.fehl) {
    pruefe('nach dem Fehler: Tor "Noch einmal"', nachFehler.tor && nachFehler.text === 'Noch einmal', JSON.stringify(nachFehler));
    const vorher = nachFehler.fehl;
    await warte(6000);
    pruefe('solange das Tor steht, kein weiterer Fehlschlag', await seite.evaluate(() => window.__fehl) === vorher, '');
  } else {
    pruefe('Treffer statt Fehler - Tor bleibt weg', !nachFehler.tor, '');
  }
  await seite.screenshot({ path: AUSGABE + '/schuss-starttor.png' });

  pruefe('keine Seitenfehler', !fehler.length, fehler.join(' | ') || '-');
  console.log(f ? `\nFEHLGESCHLAGEN: ${f}` : '\nAlles gruen.');
  await browser.close(); process.exit(f ? 1 : 0);
})();
