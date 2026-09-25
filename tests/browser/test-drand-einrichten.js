const { chromium } = require('./playwright.js');
const AUSGABE = require('path').join(__dirname, 'schuesse');
let f = 0;
const pruefe = (n, ok, t) => { console.log(`  [${ok ? 'ok  ' : 'FEHL'}] ${n.padEnd(52)} ${t}`); if (!ok) f++; };
(async () => {
  const browser = await chromium.launch();
  const seite = await (await browser.newContext({ viewport: { width: 420, height: 950 } })).newPage();
  const fehler = []; seite.on('pageerror', e => fehler.push(e.message));
  await seite.goto('http://127.0.0.1:8099/index.html');
  await seite.waitForSelector('#sicherheit');
  const lage = () => seite.evaluate(() => ({
    tzSichtbar: !document.querySelector('#tresorzeit-felder').classList.contains('versteckt'),
    rechenSichtbar: !document.querySelector('#rechenzeit-feld').classList.contains('versteckt'),
    exitOptionen: [...document.querySelectorAll('#notausgang-dauer option')].filter(o => !o.hidden).map(o => o.textContent),
    exitWert: document.querySelector('#notausgang-dauer').value,
    schaetzung: document.querySelector('#schaetzung').textContent,
    hinweis: document.querySelector('#sicherheit-hinweis').textContent,
    abschluss: document.querySelector('#abschluss-warnung').textContent
  }));

  console.log('eisern (Rechenzeit)');
  let l = await lage();
  pruefe('Tresorzeit-Felder verborgen', !l.tzSichtbar, '');
  pruefe('Notausgang hoechstens 1 Tag Rechenzeit', l.exitOptionen[l.exitOptionen.length - 1] === '1 Tag Rechenzeit',
    l.exitOptionen.slice(-2).join(', '));

  console.log('\nfern (drand)');
  await seite.selectOption('#sicherheit', 'drand');
  l = await lage();
  pruefe('Tresorzeit-Felder sichtbar', l.tzSichtbar, '');
  pruefe('Rechenzeit-Regler verborgen', !l.rechenSichtbar, '');
  pruefe('Notausgang bis 28 Tage, ohne "Rechenzeit"', l.exitOptionen.includes('28 Tage') && !l.exitOptionen.some(o => /Rechenzeit/.test(o)),
    l.exitOptionen.slice(-3).join(', '));
  pruefe('Schaetzung nennt den Zeitrahmen', /offen nach 1 h bis 3 h/.test(l.schaetzung), l.schaetzung);
  pruefe('Hinweis nennt Netz, Internet, Verlustrisiko', /drand/.test(l.hinweis) && /Internet/.test(l.hinweis) && /verloren/.test(l.hinweis), '');

  // Langer Tresor: 2 bis 4 Tage, Notausgang 7 Tage
  await seite.selectOption('#tresorzeit-min', '172800');
  await seite.selectOption('#tresorzeit-max', '432000');
  await seite.selectOption('#notausgang-dauer', '604800');
  l = await lage();
  pruefe('langer Tresor: Schaetzung', /offen nach 2 bis 5 Tagen/.test(l.schaetzung), l.schaetzung);
  pruefe('Abschluss nennt Notausgang 7 Tagen', /spätestens über den Notausgang nach 7 Tagen/.test(l.abschluss), l.abschluss.slice(0, 120) + '...');
  const karte = await seite.$('#sicherheit').then(h => h.evaluateHandle(e => e.closest('.karte')));
  await karte.asElement().screenshot({ path: AUSGABE + '/schuss-drand-einrichten.png' });

  console.log('\nzurueck auf eisern');
  await seite.selectOption('#sicherheit', 'rechenzeit');
  l = await lage();
  pruefe('7 Tage Rechenzeit rutscht auf 1 Tag', l.exitWert === '86400', l.exitWert);
  pruefe('Notausgang wieder kurz', !l.exitOptionen.includes('7 Tage Rechenzeit'), l.exitOptionen.slice(-1)[0]);

  console.log('\nnachsichtig');
  await seite.selectOption('#sicherheit', 'ohne-rechenzeit');
  l = await lage();
  pruefe('Wartezeit darf Wochen', l.exitOptionen.includes('28 Tage Wartezeit'), l.exitOptionen.slice(-1)[0]);
  pruefe('keine Seitenfehler', !fehler.length, fehler.join(' | ') || '-');
  console.log(f ? `\nFEHLGESCHLAGEN: ${f}` : '\nAlles gruen.');
  await browser.close(); process.exit(f ? 1 : 0);
})();
