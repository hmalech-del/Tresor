// Marken: NFC und QR. Eine Marke ist ein Link mit geheimem Code; die App
// loest ihn aus der Adresse ein. Im Tresor liegt nur ein Pruefwert.
const { chromium } = require('./playwright.js');
const AUSGABE = require('path').join(__dirname, 'schuesse');
const schein = require('./scheinkette.js').neu({ period: 1, genesisSek: Math.floor(Date.now() / 1000) - 5000 });
let f = 0;
const pruefe = (n, ok, t) => { console.log(`  [${ok ? 'ok  ' : 'FEHL'}] ${n.padEnd(56)} ${t}`); if (!ok) f++; };
const ADRESSE = 'http://127.0.0.1:8099/index.html';

async function neu(browser, fehler) {
  const seite = await (await browser.newContext({ viewport: { width: 390, height: 1000 } })).newPage();
  seite.on('pageerror', e => fehler.push(e.message));
  await seite.exposeFunction('scheinBeacon', r => schein.beacon(r));
  await seite.context().addInitScript(info => {
    document.addEventListener('DOMContentLoaded', () => {
      Tresor.drand.testKette(info, r => window.scheinBeacon(r));
      const H = Tresor.herausforderungen;
      H.registrieren({ id: 'probe-knopf', dimension: 'geduld', name: 'Probeknopf', kurz: 'Test',
        erzeuge: () => ({}), schaetzung: () => 10, beschreibe: () => 'Knopf',
        starte: k => { const b = document.createElement('button'); b.id = 't-bestehen'; b.textContent = 'bestehen';
          b.onclick = () => k.fertig(); k.wurzel.append(b); } });
      H.nachDimension = () => [H.hole('probe-knopf')];
      Tresor.tresorLogik.TAKT.ab = 1e9;
    });
  }, schein.info);
  await seite.goto(ADRESSE);
  await seite.waitForSelector('#ziffernfelder .zifferfeld');
  return seite;
}

const gespeichert = seite => seite.evaluate(() => JSON.parse(localStorage.getItem('tresor.v1')));

(async () => {
  const browser = await chromium.launch();
  const fehler = [];

  console.log('Logik');
  const s0 = await neu(browser, fehler);
  const r = await s0.evaluate(async () => {
    const L = Tresor.tresorLogik, M = Tresor.marken;
    const codes = [M.neuerCode(), M.neuerCode(), M.neuerCode(), M.neuerCode()];
    const k = Object.assign(L.standardKonfiguration(), { dimensionen: ['geduld'], stufen: { geduld: 1 }, aufgabenProFragment: 1,
      sicherheit: 'drand', tresorzeit: { minSekunden: 1000, maxSekunden: 3000 }, notausgang: { modus: 'aus' } });
    k.marken = await L.markenVorbereiten([
      { code: codes[0], name: 'Keller', wirkung: 'nachlass', minuten: 10 },
      { code: codes[1], name: 'Bad', wirkung: 'aufschlag', minuten: 5, mehrfach: true, sperreMin: 30 },
      { code: codes[2], name: 'Kühlschrank', wirkung: 'frost', minuten: 2 },
      { code: codes[3], name: 'Flur', wirkung: 'wurf', minuten: 3 }]);
    const t = await L.erstellen({ art: 'zahl', teile: ['1', '2'], konfig: k });
    const fr = t.freigabe, e = {};
    e.ohneCode = !JSON.stringify(t).includes(codes[0]) && k.marken[0].pruef.length === 64;
    e.link = M.codeAus(M.link(codes[0])) === codes[0];
    const z = () => fr.konto.zielSek;
    let v = z(); e.nachlass = (await L.markeEinloesen(t, codes[0])).sekunden; e.nachlassKonto = z() - v;
    e.verbraucht = (await L.markeEinloesen(t, codes[0])).fehler;
    e.fremd = (await L.markeEinloesen(t, M.neuerCode())).fehler;
    const jetzt = Date.now();
    e.bad1 = (await L.markeEinloesen(t, codes[1], jetzt)).sekunden;
    const gesperrt = await L.markeEinloesen(t, codes[1], jetzt + 60000);
    e.gesperrt = gesperrt.fehler + ' ' + Math.round((gesperrt.bis - jetzt) / 60000);
    e.bad2 = (await L.markeEinloesen(t, codes[1], jetzt + 31 * 60000)).sekunden;
    v = z();
    await L.markeEinloesen(t, codes[2], jetzt);
    e.frostAktiv = L.frostAktiv(t, jetzt + 60000);
    L.frostNachziehen(t, jetzt + 200000);
    e.frost = Math.round(z() - v);
    const w = await L.markeEinloesen(t, codes[3]);
    e.wurfOffen = w.wurf === true && L.markeLage(t, k.marken[3]).lage === 'wurf';
    e.nochmalWurf = (await L.markeEinloesen(t, codes[3])).wurf === true;
    e.wurf6 = L.markeWuerfeln(t, k.marken[3], 6).sekunden;
    e.wurfDanach = L.markeLage(t, k.marken[3]).lage;
    e.bewegungen = L.neueBewegungen(t, 0).filter(b => b.art === 'marke').map(b => b.grund + ':' + b.sekunden);
    // Passiv: im Protokoll
    const k2 = L.passivKonfiguration({ minSekunden: 1000, maxSekunden: 3000 }, { modus: 'aus' }, {});
    const c = M.neuerCode();
    k2.marken = await L.markenVorbereiten([{ code: c, name: 'Garten', wirkung: 'nachlass', minuten: 1 }]);
    const t2 = await L.erstellen({ art: 'zahl', teile: ['1'], konfig: k2 });
    await L.markeEinloesen(t2, c);
    const p = t2.freigabe.passiv.protokoll[0];
    e.passiv = p.art + ' ' + p.grund + ' ' + p.sekunden;
    return e;
  });
  pruefe('im Tresor nur der Pruefwert, Link traegt den Code', r.ohneCode && r.link, '');
  pruefe('Nachlass 10 min: -600 s', r.nachlass === -600 && r.nachlassKonto === -600, r.nachlass + ' s');
  pruefe('einmal: danach verbraucht', r.verbraucht === 'verbraucht', r.verbraucht);
  pruefe('fremder Code: nichts', r.fremd === 'fremd', r.fremd);
  pruefe('wiederholt: +5 min, dann 30 min gesperrt, dann wieder', r.bad1 === 300 && r.gesperrt === 'gesperrt 30' && r.bad2 === 300, `${r.bad1} / ${r.gesperrt} / ${r.bad2}`);
  pruefe('Freeze 2 min: steht, dann +120 s', r.frostAktiv && r.frost === 120, r.frost + ' s');
  pruefe('Wurf: ab dem Scan genommen, bleibt offen', r.wurfOffen && r.nochmalWurf, '');
  pruefe('Wurf 6: -2 x 3 min', r.wurf6 === -360 && r.wurfDanach === 'verbraucht', `${r.wurf6} s, ${r.wurfDanach}`);
  pruefe('Bewegungen fuer den Rueckkanal', JSON.stringify(r.bewegungen) === JSON.stringify(['Keller:-600', 'Bad:300', 'Bad:300', 'Flur:-360']), JSON.stringify(r.bewegungen));
  pruefe('Passiv: im Protokoll', r.passiv === 'marke Garten -60', r.passiv);
  await s0.context().close();

  console.log('\nEinrichten und Einloesen ueber die Adresse');
  const s1 = await neu(browser, fehler);
  const felder = await s1.$$('#ziffernfelder .zifferfeld');
  for (let i = 0; i < felder.length; i++) { await felder[i].click(); await felder[i].type('48271'[i]); }
  await s1.$$eval('.dimension-karte input[type=checkbox]', els => els.forEach(e => {
    if (!e.disabled) { e.checked = e.value === 'geduld'; e.dispatchEvent(new Event('change', { bubbles: true })); } }));
  await s1.$eval('#aufgaben-pro-fragment', e => { e.value = '1'; e.dispatchEvent(new Event('input')); });
  pruefe('Rechenzeit: keine Marken', await s1.$eval('#markenkarte-einrichten', e => e.classList.contains('versteckt')), '');
  await s1.selectOption('#sicherheit', 'drand');
  await s1.selectOption('#notausgang-modus', 'aus');
  await s1.evaluate(() => { for (const [id, v] of [['#tresorzeit-min', 600], ['#tresorzeit-max', 1800]]) { const s = document.querySelector(id);
    const o = document.createElement('option'); o.value = String(v); s.appendChild(o); s.value = String(v); s.dispatchEvent(new Event('change')); } });
  await s1.click('#markenkarte-einrichten button:text-is("Marke hinzufügen")');
  await s1.click('#markenkarte-einrichten button:text-is("Marke hinzufügen")');
  const zeilen = await s1.$$('.marken-zeile');
  await (await zeilen[0].$('input[type=text]')).fill('Keller');
  await (await zeilen[1].$('input[type=text]')).fill('Flur');
  await (await zeilen[1].$('select')).selectOption('wurf');
  const links = await s1.$$eval('.marken-qr', els => els.map(e => e.dataset.link));
  pruefe('QR-Codes da, Links mit Code', links.length === 2 && links.every(l => /#marke=[0-9a-f]{24}$/.test(l))
    && (await s1.$$('.marken-qr svg path')).length === 2, links[0]);
  await s1.screenshot({ path: AUSGABE + '/schuss-marken-einrichten.png', fullPage: true });
  await s1.click('#verriegeln');
  await s1.waitForSelector('#markenkarte', { timeout: 60000 });
  const t0 = await gespeichert(s1);
  pruefe('verriegelt: zwei Marken, kein Code im Speicher', t0.konfig.marken.length === 2 && !links.some(l => JSON.stringify(t0).includes(l.split('=')[1])), '');
  // Kamera-App oeffnet den Link: neue Seite mit #marke=...
  await s1.goto(links[0]);
  await s1.waitForSelector('#markenkarte .aufgabe-meldung.ist-gut', { timeout: 15000 });
  const m1 = await s1.textContent('#markenkarte .aufgabe-meldung.ist-gut');
  const t1 = await gespeichert(s1);
  pruefe('per Link eingeloest: Keller -10 min', /„Keller“: −10 min\./.test(m1) && t1.freigabe.konto.zielSek - t0.freigabe.konto.zielSek === -600, m1);
  pruefe('Code aus der Adresse genommen', !(await s1.evaluate(() => location.hash)), await s1.evaluate(() => location.href));
  await s1.reload();
  await s1.waitForSelector('#markenkarte', { timeout: 15000 });
  pruefe('Neuladen loest nicht noch einmal aus', (await gespeichert(s1)).freigabe.konto.zielSek === t1.freigabe.konto.zielSek, '');
  // laufende App: Marke ueber hashchange (z. B. NFC-Link im selben Tab)
  await s1.evaluate(l => { location.hash = l.split('#')[1]; }, links[0]);
  await s1.waitForSelector('#markenkarte .aufgabe-meldung.ist-fehler', { timeout: 10000 });
  pruefe('zweimal: verbraucht', /verbraucht/.test(await s1.textContent('#markenkarte .aufgabe-meldung.ist-fehler')), await s1.textContent('#markenkarte .aufgabe-meldung.ist-fehler'));
  await s1.goto(links[1]);
  await s1.waitForSelector('#markenkarte .wuerfelbox button', { timeout: 15000 });
  await s1.reload();
  await s1.waitForSelector('#markenkarte .wuerfelbox button', { timeout: 15000 });
  pruefe('Wurf bleibt nach Neuladen offen', true, '');
  await s1.click('#markenkarte .wuerfelbox button');
  await s1.waitForSelector('#markenkarte button:text-is("Weiter")', { timeout: 5000 });
  const wurf = await s1.textContent('#markenkarte .wuerfelbox .flaut');
  pruefe('Wurf gewuerfelt und gebucht', /Gewürfelt: \d/.test(wurf), wurf);
  await s1.click('#markenkarte button:text-is("Weiter")');
  const liste = await s1.textContent('#markenkarte .marken-liste');
  pruefe('Liste: beide verbraucht', (liste.match(/verbraucht/g) || []).length === 2, liste);
  pruefe('Pruefung laeuft weiter', !!(await s1.$('#t-bestehen')), '');
  await s1.screenshot({ path: AUSGABE + '/schuss-marken.png', fullPage: true });
  await s1.context().close();

  console.log('\nOhne Tresor');
  const s2 = await neu(browser, fehler);
  await s2.goto(ADRESSE + '#marke=0123456789abcdef01234567');
  await s2.waitForSelector('#ziffernfelder .zifferfeld');
  pruefe('Marke ohne Tresor: Hinweis', /Kein Tresor läuft/.test(await s2.textContent('#buehne')), '');
  await s2.context().close();

  pruefe('keine Seitenfehler', !fehler.length, fehler.join(' | ') || '-');
  console.log(f ? `\nFEHLGESCHLAGEN: ${f}` : '\nAlles gruen.');
  await browser.close(); process.exit(f ? 1 : 0);
})();
