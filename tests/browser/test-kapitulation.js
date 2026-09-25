// Kapitulieren: Pfand am Netz und bei Rechenzeit, Verweigerung ohne Zeitschloss.
const { chromium } = require('./playwright.js');
const schein = require('./scheinkette.js').neu({ period: 1, genesisSek: Math.floor(Date.now() / 1000) - 5000 });
let f = 0;
const pruefe = (n, ok, t) => { console.log(`  [${ok ? 'ok  ' : 'FEHL'}] ${n.padEnd(54)} ${t}`); if (!ok) f++; };
const warte = ms => new Promise(r => setTimeout(r, ms));

async function neu(browser, fehler) {
  const seite = await (await browser.newContext({ viewport: { width: 390, height: 1000 } })).newPage();
  seite.on('pageerror', e => fehler.push(e.message));
  await seite.exposeFunction('scheinBeacon', r => schein.beacon(r));
  await seite.goto('http://127.0.0.1:8099/index.html');
  await seite.waitForSelector('#ziffernfelder .zifferfeld');
  await seite.evaluate(info => {
    Tresor.drand.testKette(info, r => window.scheinBeacon(r));
    const H = Tresor.herausforderungen;
    H.registrieren({ id: 'probe-raetsel', dimension: 'raetsel', name: 'Proberaetsel', kurz: 'Test', antwortGebunden: true,
      normalisiere: x => String(x || '').trim().toLowerCase(),
      erzeuge: () => ({ loesung: 'xqzvwk' }), schaetzung: () => 10, beschreibe: () => 'Raetsel',
      starte: k => { const b = document.createElement('button'); b.id = 't-loesen'; b.textContent = 'loesen';
        b.onclick = () => k.pruefeAntwort('xqzvwk'); k.wurzel.append(b); } });
    H.registrieren({ id: 'probe-knopf', dimension: 'geduld', name: 'Probeknopf', kurz: 'Test',
      erzeuge: () => ({}), schaetzung: () => 10, beschreibe: () => 'Knopf',
      starte: k => { const b = document.createElement('button'); b.id = 't-bestehen'; b.textContent = 'bestehen';
        b.onclick = () => k.fertig(); k.wurzel.append(b); } });
    H.nachDimension = d => d === 'raetsel' ? [H.hole('probe-raetsel')] : [H.hole('probe-knopf')];
    // Kapitulation im Test in Sekunden statt Minuten
    Tresor.tresorLogik.KAPITULATION.wartenMin = 2; Tresor.tresorLogik.KAPITULATION.wartenFaktor = 0.2;
    Tresor.tresorLogik.RECHENZEIT_STUFEN[0] = 2;
  }, schein.info);
  return seite;
}

async function einrichten(seite, { dims, zeitschloss, tz }) {
  const felder = await seite.$$('#ziffernfelder .zifferfeld');
  for (let i = 0; i < felder.length; i++) { await felder[i].click(); await felder[i].type('48271'[i]); }
  await seite.$$eval('.dimension-karte input[type=checkbox]', (els, d) => els.forEach(e => {
    if (!e.disabled) { e.checked = d.includes(e.value); e.dispatchEvent(new Event('change', { bubbles: true })); } }), dims);
  await seite.$eval('#aufgaben-pro-fragment', e => { e.value = '1'; e.dispatchEvent(new Event('input')); });
  await seite.$eval('#rechenzeit', e => { e.value = '1'; e.dispatchEvent(new Event('input')); });
  await seite.selectOption('#sicherheit', zeitschloss);
  if (tz) await seite.evaluate(t => { for (const id of ['#tresorzeit-min', '#tresorzeit-max']) { const s = document.querySelector(id);
    const o = document.createElement('option'); o.value = String(t); s.appendChild(o); s.value = String(t); s.dispatchEvent(new Event('change')); } }, tz);
  await seite.click('#verriegeln');
  await seite.waitForSelector('.aufgaben-kopf', { timeout: 60000 });
}

async function kapituliere(seite) {
  // nur der frische Knopf zaehlt - nicht der gesperrte Wuerfel der alten Leiste
  await seite.waitForSelector('.kapitulation > button.knopf.flach:text-is("Kapitulieren")');
  const leiste = await seite.$('.kapitulation');
  await seite.click('.kapitulation > button.knopf.flach:text-is("Kapitulieren")');
  await seite.click('.kapitulation .wuerfelbox button');
  await seite.waitForSelector('.kapitulation .aufgabe-meldung', { timeout: 5000 });
  const meldung = await seite.textContent('.kapitulation');
  await seite.waitForFunction(l => !l.isConnected, leiste, { timeout: 10000 });   // neu gezeichnet
  return meldung.replace(/\s+/g, ' ');
}

(async () => {
  const browser = await chromium.launch();
  const fehler = [];

  console.log('Am Netz: alle Raetsel aufgeben - die Ziffern muessen trotzdem stimmen');
  const s1 = await neu(browser, fehler);
  await einrichten(s1, { dims: ['raetsel'], zeitschloss: 'drand', tz: 40 });
  const pfand = await s1.evaluate(() => JSON.parse(localStorage.getItem('tresor.v1')).fragmente.every(fr => fr.aufgaben.every(a => a.pfand && a.pruefung)));
  pruefe('jede Raetsel-Loesung liegt als Pfand', pfand, '');
  const kein = await s1.evaluate(() => !/xqzvwk/.test(localStorage.getItem('tresor.v1')));
  pruefe('Loesung nirgends im Klartext', kein, '');
  // Zuruecknehmen geht, solange nicht gewuerfelt ist
  await s1.click('.kapitulation button');
  const erklaerung = (await s1.textContent('.kapitulation')).replace(/\s+/g, ' ');
  pruefe('Erklaerung nennt Normalwert und Augen-Tabelle', /Die Freigabe rückt nach hinten, um \d+ s mal 0,5 · 0,75 · 1 · 1,5 · 2 · 3/.test(erklaerung), erklaerung.slice(0, 110));
  await s1.click('.kapitulation button.knopf.flach:not(.wuerfelbox button)');
  pruefe('"Doch weiter versuchen" nimmt zurueck', (await s1.textContent('.kapitulation')).trim() === 'Kapitulieren', '');
  const vorher = await s1.evaluate(() => Tresor.tresorLogik.freigabeZiel(JSON.parse(localStorage.getItem('tresor.v1'))).zeit);
  const m1 = await kapituliere(s1);
  pruefe('Wurf nennt Augen und Aufschlag', /Eine [1-6]\./.test(m1) && /\+\d+ s auf die Freigabe/.test(m1), m1.slice(m1.indexOf('Eine'), m1.indexOf('Eine') + 70));
  const box = (await s1.textContent('.freigabe-karte')).replace(/\s+/g, ' ');
  pruefe('Freigabe-Karte zeigt die Kapitulation', /Kapituliert.*Gewürfelt: [1-6]\. \+\d+ s/.test(box), '');
  for (let i = 0; i < 4; i++) await kapituliere(s1);
  const t1 = await s1.evaluate(() => JSON.parse(localStorage.getItem('tresor.v1')));
  const nachher = await s1.evaluate(() => Tresor.tresorLogik.freigabeZiel(JSON.parse(localStorage.getItem('tresor.v1'))).zeit);
  console.log('    Zustand je Fragment:', t1.fragmente.map(fr => JSON.stringify({ k: fr.aufgaben[0].zustand.kapituliert, e: fr.aufgaben[0].erledigt, a: fr.aufgaben[0].zustand.antwort ? 'ANTWORT' : undefined })).join(' '));
  pruefe('alle aufgegeben, Freigabe spaeter', t1.fragmente.every(fr => fr.aufgaben[0].zustand.kapituliert && fr.aufgaben[0].erledigt) && nachher > vorher,
    `+${Math.round((nachher - vorher) / 1000)} s`);
  const plan = (await s1.textContent('.fragmentliste').catch(() => '')).replace(/\s+/g, ' ');
  pruefe('Fahrplan markiert "aufgegeben"', (plan.match(/aufgegeben/g) || []).length === 5, '');
  await warte(Math.max(0, nachher - Date.now()) + 2500);
  await s1.waitForSelector('.grossezahl', { timeout: 20000 }).catch(() => {});
  const zahl = await s1.textContent('.grossezahl').catch(() => '');
  pruefe('nach der Freigabe: Pfand eingeloest, Zahl stimmt', zahl === '48271', zahl || '(keine Zahl)');

  console.log('\nRechenzeit: aufgeben, warten, rechnen');
  const s2 = await neu(browser, fehler);
  await einrichten(s2, { dims: ['raetsel'], zeitschloss: 'rechenzeit' });
  // lang genug, dass die Wartebuehne nach dem Neuzeichnen noch steht (4..24 s)
  await s2.evaluate(() => { Tresor.tresorLogik.KAPITULATION.wartenMin = 8; });
  const m2 = await kapituliere(s2);
  pruefe('Wurf nennt Wartezeit', /\d+ s Wartezeit/.test(m2), m2.slice(m2.indexOf('Eine'), m2.indexOf('Eine') + 60));
  const buehne2 = (await s2.textContent('.aufgaben-buehne')).replace(/\s+/g, ' ');
  pruefe('Wartebuehne heisst "Kapituliert", ohne "Fehlversuch"', /^Kapituliert/.test(buehne2) && !/Fehlversuch/.test(buehne2), buehne2.slice(0, 70));
  await s2.waitForFunction(() => document.querySelectorAll('.bandziffer.ist-offen').length > 0, null, { timeout: 40000 }).catch(() => {});
  const erste = await s2.evaluate(() => { const t = JSON.parse(localStorage.getItem('tresor.v1')); return t.fragmente[0].offen ? t.fragmente[0].inhalt : null; });
  pruefe('nach Wartezeit und Rechnen: Fragment 1 mit Pfand offen', erste === '4', String(erste));

  console.log('\nNachsichtig: Raetsel verweigern das Aufgeben, anderes nicht');
  const s3 = await neu(browser, fehler);
  await einrichten(s3, { dims: ['raetsel'], zeitschloss: 'ohne-rechenzeit' });
  const nein = (await s3.textContent('.kapitulation')).replace(/\s+/g, ' ');
  pruefe('Raetsel: Aufgeben geht nicht, mit Grund', /Aufgeben geht hier nicht/.test(nein) && !(await s3.$('.kapitulation button')), nein.slice(0, 80));
  const s4 = await neu(browser, fehler);
  await einrichten(s4, { dims: ['geduld'], zeitschloss: 'ohne-rechenzeit' });
  const m4 = await kapituliere(s4);
  pruefe('andere Pruefung: Aufgeben geht', /Wartezeit/.test(m4), '');

  pruefe('keine Seitenfehler', !fehler.length, fehler.join(' | ') || '-');
  console.log(f ? `\nFEHLGESCHLAGEN: ${f}` : '\nAlles gruen.');
  await browser.close(); process.exit(f ? 1 : 0);
})();
