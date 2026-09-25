// Willkuer am Netz: Rahmen vom Game Master, keine Uhr, unregelmaessiger Takt.
const { chromium } = require('./playwright.js');
const AUSGABE = require('path').join(__dirname, 'schuesse');
const schein = require('./scheinkette.js').neu({ period: 1, genesisSek: Math.floor(Date.now() / 1000) - 5000 });
let f = 0;
const pruefe = (n, ok, t) => { console.log(`  [${ok ? 'ok  ' : 'FEHL'}] ${n.padEnd(52)} ${t}`); if (!ok) f++; };
(async () => {
  const browser = await chromium.launch();
  const seite = await (await browser.newContext({ viewport: { width: 390, height: 1000 } })).newPage();
  const fehler = []; seite.on('pageerror', e => fehler.push(e.message));
  await seite.exposeFunction('scheinBeacon', r => schein.beacon(r));
  await seite.goto('http://127.0.0.1:8099/index.html');
  await seite.waitForSelector('#ziffernfelder .zifferfeld');
  await seite.evaluate(info => {
    Tresor.drand.testKette(info, r => window.scheinBeacon(r));
    Tresor.tresorLogik.TAKT.ab = 5; Tresor.tresorLogik.TAKT.fensterMin = 2;
    Tresor.herausforderungen.registrieren({ id: 'probe-knopf', dimension: 'geduld', name: 'Probeknopf', kurz: 'Test',
      erzeuge: () => ({}), schaetzung: () => 10, beschreibe: () => 'Knopf',
      starte: k => { const b = document.createElement('button'); b.id = 't-scheitern'; b.textContent = 'scheitern';
        b.onclick = () => k.fehlschlag('Probe verhauen.'); k.wurzel.append(b); } });
    Tresor.herausforderungen.nachDimension = () => [Tresor.herausforderungen.hole('probe-knopf')];
  }, schein.info);
  const felder = await seite.$$('#ziffernfelder .zifferfeld');
  for (let i = 0; i < felder.length; i++) { await felder[i].click(); await felder[i].type('48271'[i]); }
  await seite.check('#blindgang');
  const titel = await seite.textContent('.blindtitel');
  const vorgabe = await seite.$eval('#blind-zeitschloss', e => e.value);
  pruefe('heisst Willkuer, Vorgabe: das Netz', titel === 'Willkür' && vorgabe === 'drand', `${titel} / ${vorgabe}`);
  const warnung = await seite.textContent('#blindgang-warnung');
  pruefe('Warnung sagt, dass Strafen gezogen werden', /ich ziehe, wie viel sie wiegen/.test(warnung), '');
  await seite.evaluate(() => { const s = document.querySelector('#notausgang-dauer'); const o = document.createElement('option');
    o.value = '60'; o.dataset.sekunden = '60'; s.appendChild(o); s.value = '60'; s.dispatchEvent(new Event('change')); });
  await seite.click('#verriegeln');
  await seite.waitForSelector('.freigabe-karte', { timeout: 60000 });

  const t = await seite.evaluate(() => JSON.parse(localStorage.getItem('tresor.v1')));
  const tz = t.konfig.tresorzeit, fr = t.freigabe;
  console.log('Rahmen');
  pruefe('Willkuer am Netz', t.konfig.blind && t.konfig.sicherheit === 'drand', t.konfig.sicherheit);
  pruefe('Rahmen vom Game Master aus dem Notausgang', tz.minSekunden >= 12 && tz.minSekunden <= 30 && tz.maxSekunden >= 36 && tz.maxSekunden <= 54,
    `${tz.minSekunden} s .. ${tz.maxSekunden} s bei 60 s Notausgang`);
  pruefe('Uhr startet oben', fr.konto.zielSek === tz.maxSekunden, fr.konto.zielSek + ' s');
  const alle = t.fragmente.flatMap(x => x.aufgaben);
  const abst = alle.slice(1).map((a, i) => a.frei - alle[i].frei);
  console.log('\nTakt');
  pruefe('Abstaende ungleich', new Set(abst).size > 1, abst.map(x => (x / 1000).toFixed(1)).join(', ') + ' s');
  const letzte = alle[alle.length - 1];
  pruefe('letzte Pruefung vor der unteren Grenze', letzte.frei - fr.start < tz.minSekunden * 1000, `${((letzte.frei - fr.start) / 1000).toFixed(1)} s < ${tz.minSekunden} s`);
  pruefe('Puenktlichkeitsfenster nie unter dem Minimum', alle.every(a => a.puenktlichBis - a.frei >= 2000), '');

  console.log('\nAnsicht');
  const karte = (await seite.textContent('.freigabe-karte')).replace(/\s+/g, ' ');
  pruefe('keine Uhr bis zur Freigabe', /· · ·/.test(karte) && /Wie lange noch, sage ich nicht/.test(karte), '');
  pruefe('kein Bestenfalls/Spaetestens', !/Bestenfalls/.test(karte), '');
  const kopf = (await seite.textContent('.aufgaben-kopf')).replace(/\s+/g, ' ');
  pruefe('Kopf ohne Gesamtzahl und ohne Betrag', /^Prüfung/.test(kopf) && !/von|holt/.test(kopf), kopf);
  pruefe('kein Fahrplan', !(await seite.$('.fragmentliste')), '');
  await seite.click('#t-scheitern');
  await seite.waitForSelector('.strafkasten');
  const strafe = (await seite.textContent('.strafkasten')).replace(/\s+/g, ' ');
  pruefe('Strafe nennt, was sie kostet', /Fehlversuch 1\. \+\d+ s\./.test(strafe), strafe.slice(0, 80));
  const nochDunkel = (await seite.textContent('.freigabe-karte .countdown'));
  pruefe('auch nach der Strafe keine Uhr', nochDunkel === '· · ·', nochDunkel);
  await seite.screenshot({ path: AUSGABE + '/schuss-willkuer.png' });
  pruefe('keine Seitenfehler', !fehler.length, fehler.join(' | ') || '-');
  console.log(f ? `\nFEHLGESCHLAGEN: ${f}` : '\nAlles gruen.');
  await browser.close(); process.exit(f ? 1 : 0);
})();
