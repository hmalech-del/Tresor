// Von aussen: Home Assistant bewegt die Uhr am Netz. Home Assistant ist hier
// gefaelscht (page.routeWebSocket) - es spricht das Anmelden und
// subscribe_entities wie das echte, mehr braucht die App nicht.
const { chromium } = require('./playwright.js');
const AUSGABE = require('path').join(__dirname, 'schuesse');
const schein = require('./scheinkette.js').neu({ period: 1, genesisSek: Math.floor(Date.now() / 1000) - 5000 });
let f = 0;
const pruefe = (n, ok, t) => { console.log(`  [${ok ? 'ok  ' : 'FEHL'}] ${n.padEnd(56)} ${t}`); if (!ok) f++; };
const TOKEN = 'geheimes-token-4711';
const ZAHL = 'input_number.tresor_minuten', GRUND = 'input_text.tresor_grund';

/* Ein Home Assistant je Seite: Stand der Zahl, Grund, offene Verbindungen. */
async function neu(browser, fehler) {
  const seite = await (await browser.newContext({ viewport: { width: 390, height: 1000 } })).newPage();
  seite.on('pageerror', e => fehler.push(e.message));
  const ha = { wert: 0, grund: 'unknown', offen: [], anmeldungen: 0 };
  ha.aendern = (wert, grund) => {
    ha.wert = wert; ha.grund = grund;
    const c = { [GRUND]: { '+': { s: grund } }, [ZAHL]: { '+': { s: String(wert), lc: Date.now() / 1000 } } };
    ha.offen.forEach(w => w.send(JSON.stringify({ id: 1, type: 'event', event: { c } })));
  };
  await seite.routeWebSocket(/\/api\/websocket$/, w => {
    w.send(JSON.stringify({ type: 'auth_required', ha_version: '2026.10.0' }));
    w.onMessage(roh => {
      const m = JSON.parse(roh);
      if (m.type === 'auth') {
        ha.anmeldungen++;
        if (m.access_token !== TOKEN) { w.send(JSON.stringify({ type: 'auth_invalid', message: 'Invalid access token' })); return; }
        w.send(JSON.stringify({ type: 'auth_ok' }));
      } else if (m.type === 'subscribe_entities') {
        ha.offen.push(w);
        w.send(JSON.stringify({ id: m.id, type: 'result', success: true, result: null }));
        const a = { [ZAHL]: { s: String(ha.wert), a: {}, lc: Date.now() / 1000 - 60 }, [GRUND]: { s: ha.grund, a: {} } };
        w.send(JSON.stringify({ id: m.id, type: 'event', event: { a } }));
      }
    });
    w.onClose(() => { ha.offen = ha.offen.filter(x => x !== w); });
  });
  await seite.exposeFunction('scheinBeacon', r => schein.beacon(r));
  // Testkette vor dem Start der App, auch nach einem Neuladen
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
  await seite.goto('http://127.0.0.1:8099/index.html');
  await seite.waitForSelector('#ziffernfelder .zifferfeld');
  return { seite, ha };
}

async function ziffern(seite) {
  const felder = await seite.$$('#ziffernfelder .zifferfeld');
  for (let i = 0; i < felder.length; i++) { await felder[i].click(); await felder[i].type('48271'[i]); }
}

async function rahmen(seite, ids, werte) {
  await seite.evaluate(([ids, werte]) => ids.forEach((id, i) => { const s = document.querySelector(id);
    const o = document.createElement('option'); o.value = String(werte[i]); o.textContent = werte[i] + ' s'; s.appendChild(o);
    s.value = String(werte[i]); s.dispatchEvent(new Event('change')); }), [ids, werte]);
}

async function zugang(seite, token) {
  await seite.fill('#ha-url', 'https://ha.test');
  await seite.fill('#ha-token', token);
  await seite.$eval('#ha-token', e => e.dispatchEvent(new Event('change', { bubbles: true })));
}

const gespeichert = seite => seite.evaluate(() => JSON.parse(localStorage.getItem('tresor.v1')));

(async () => {
  const browser = await chromium.launch();
  const fehler = [];

  console.log('Logik');
  const { seite: s0 } = await neu(browser, fehler);
  const r = await s0.evaluate(async () => {
    const L = Tresor.tresorLogik;
    const k = L.standardKonfiguration();
    Object.assign(k, { dimensionen: ['geduld'], stufen: { geduld: 1 }, aufgabenProFragment: 1, sicherheit: 'drand',
      tresorzeit: { minSekunden: 1000, maxSekunden: 3000 }, notausgang: { modus: 'aus' }, extern: true });
    const t = await L.erstellen({ art: 'zahl', teile: ['1', '2'], konfig: k });
    const e = { start: t.freigabe.konto.zielSek };
    e.erster = L.externBuchen(t, 7, '', Date.now());
    e.basis = t.freigabe.extern.basis;
    const plus = L.externBuchen(t, 17, 'Tür offen', Date.now());
    e.plus = { s: plus.sekunden, grund: plus.grund, konto: t.freigabe.konto.zielSek };
    e.minus = L.externBuchen(t, 12, '', Date.now()).sekunden;
    e.gleich = L.externBuchen(t, 12, '', Date.now());
    e.nachFreigabe = L.externBuchen(t, 40, '', Date.now() + 1e8);
    e.basisDanach = t.freigabe.extern.basis;
    e.unsinn = L.externBuchen(t, NaN, '', Date.now());
    // ohne Erlaubnis beim Verriegeln: nichts
    const k2 = Object.assign(L.standardKonfiguration(), { dimensionen: ['geduld'], stufen: { geduld: 1 }, sicherheit: 'drand',
      tresorzeit: { minSekunden: 1000, maxSekunden: 3000 }, notausgang: { modus: 'aus' } });
    const t2 = await L.erstellen({ art: 'zahl', teile: ['1'], konfig: k2 });
    e.ohne = !t2.freigabe.extern && L.externBuchen(t2, 5, '', Date.now()) === null;
    // Passiv: ins Protokoll
    const k3 = L.passivKonfiguration({ minSekunden: 1000, maxSekunden: 3000 }, { modus: 'aus' }, {});
    k3.extern = true;
    const t3 = await L.erstellen({ art: 'zahl', teile: ['1'], konfig: k3 });
    L.externBuchen(t3, 0, '', Date.now());
    L.externBuchen(t3, -2, 'NFC Küche', Date.now());
    const p = t3.freigabe.passiv;
    e.passiv = { art: p.protokoll[0].art, grund: p.protokoll[0].grund, s: p.protokoll[0].sekunden, nr: p.nr };
    // ganz an den Boden: nie unter den Rahmen
    L.externBuchen(t3, -1000, '', Date.now());
    e.boden = t3.freigabe.konto.zielSek;
    return e;
  });
  pruefe('erster Stand ist der Nullpunkt, bucht nichts', r.erster === null && r.basis === 7 && r.start === 3000, `basis ${r.basis}`);
  pruefe('+10 Minuten: 600 s spaeter, mit Grund', r.plus.s === 600 && r.plus.konto === 3600 && r.plus.grund === 'Tür offen', JSON.stringify(r.plus));
  pruefe('-5 Minuten: 300 s frueher', r.minus === -300, r.minus + ' s');
  pruefe('gleicher Stand: nichts', r.gleich === null, '');
  pruefe('nach der Freigabe: nichts, Nullpunkt zieht nach', r.nachFreigabe === null && r.basisDanach === 40, '');
  pruefe('kaputter Wert: nichts', r.unsinn === null, '');
  pruefe('ohne Erlaubnis beim Verriegeln: nichts', r.ohne, '');
  pruefe('Passiv: Eingang im Protokoll', r.passiv.art === 'extern' && r.passiv.grund === 'NFC Küche' && r.passiv.s === -120 && r.passiv.nr === 1, JSON.stringify(r.passiv));
  pruefe('nie unter den Rahmen', r.boden === 1000, r.boden + ' s');
  await s0.context().close();

  console.log('\nEinrichten');
  const { seite: s1, ha: ha1 } = await neu(browser, fehler);
  await ziffern(s1);
  const sichtbar = () => s1.evaluate(() => !document.querySelector('#externkarte').classList.contains('versteckt'));
  pruefe('Rechenzeit: keine Karte "Von außen"', !(await sichtbar()), '');
  await s1.$$eval('.dimension-karte input[type=checkbox]', els => els.forEach(e => {
    if (!e.disabled) { e.checked = e.value === 'geduld'; e.dispatchEvent(new Event('change', { bubbles: true })); } }));
  await s1.$eval('#aufgaben-pro-fragment', e => { e.value = '1'; e.dispatchEvent(new Event('input')); });
  await s1.selectOption('#sicherheit', 'drand');
  pruefe('am Netz: Karte da', await sichtbar(), '');
  await s1.click('#extern-aktiv');
  await zugang(s1, 'falsches-token');
  await s1.click('#ha-pruefen');
  await s1.waitForFunction(() => /abgewiesen/.test(document.querySelector('#ha-meldung').textContent), null, { timeout: 15000 });
  pruefe('falsches Token: abgewiesen', true, await s1.textContent('#ha-meldung'));
  await zugang(s1, TOKEN);
  ha1.wert = 3;
  await s1.click('#ha-pruefen');
  await s1.waitForFunction(() => /Verbunden/.test(document.querySelector('#ha-meldung').textContent), null, { timeout: 15000 });
  pruefe('richtiges Token: Stand gelesen', /steht auf 3/.test(await s1.textContent('#ha-meldung')), await s1.textContent('#ha-meldung'));
  await s1.screenshot({ path: AUSGABE + '/schuss-ha-einrichten.png', fullPage: true });
  await rahmen(s1, ['#tresorzeit-min', '#tresorzeit-max'], [600, 1800]);
  await s1.selectOption('#notausgang-modus', 'aus');   // sonst ist der Notausgang der Deckel, und +10 min gingen ins Leere
  await s1.click('#verriegeln');
  await s1.waitForSelector('#t-bestehen', { timeout: 60000 });
  await s1.waitForSelector('.ha-status.ist-verbunden', { timeout: 15000 });
  pruefe('nach dem Verriegeln verbunden', true, await s1.textContent('.ha-status'));
  const t0 = await gespeichert(s1);
  pruefe('Token nicht im Tresor', !JSON.stringify(t0).includes(TOKEN) && t0.konfig.extern === true && t0.freigabe.extern.basis === 3, '');

  console.log('\nTresor');
  const vor = t0.freigabe.konto.zielSek;
  ha1.aendern(13, 'Tür offen');
  await s1.waitForFunction(() => /Tür offen: \+10 min/.test((document.querySelector('.extern-zeile') || {}).textContent || ''), null, { timeout: 5000 })
    .catch(() => {});
  const zeile = await s1.textContent('.extern-zeile');
  pruefe('+10: Zeile in der Freigabe, ohne Neuzeichnen', /Tür offen: \+10 min\./.test(zeile) && !!(await s1.$('#t-bestehen')), zeile);
  const t1 = await gespeichert(s1);
  pruefe('Konto 600 s spaeter', t1.freigabe.konto.zielSek - vor === 600, `${vor} -> ${t1.freigabe.konto.zielSek}`);
  await s1.screenshot({ path: AUSGABE + '/schuss-ha-netz.png', fullPage: true });
  // waehrend die App zu ist: Stand in Home Assistant aendert sich
  ha1.wert = 8; ha1.grund = 'Webhook';
  await s1.reload();
  await s1.waitForSelector('.ha-status.ist-verbunden', { timeout: 15000 });
  await s1.waitForTimeout(500);
  const t2 = await gespeichert(s1);
  pruefe('nachgeholt: -5 Minuten', t2.freigabe.konto.zielSek - t1.freigabe.konto.zielSek === -300 && t2.freigabe.extern.basis === 8,
    `${t1.freigabe.konto.zielSek} -> ${t2.freigabe.konto.zielSek}`);
  pruefe('Zugangsdaten unter Verwaltung', !!(await s1.$('details.verwaltung #ha-token')), '');
  await s1.context().close();

  console.log('\nPassiv ohne Uhr');
  const { seite: s2, ha: ha2 } = await neu(browser, fehler);
  await s2.evaluate(t => localStorage.setItem('tresor.ha', JSON.stringify({ url: 'https://ha.test', token: t,
    zahl: 'input_number.tresor_minuten', grund: 'input_text.tresor_grund' })), TOKEN);
  await s2.reload();
  await s2.waitForSelector('#ziffernfelder .zifferfeld');
  await ziffern(s2);
  await s2.click('#spielart-passiv');
  pruefe('Passiv: Karte "Von außen" da, Zugang vorbelegt', !(await s2.$eval('#externkarte', e => e.classList.contains('versteckt')))
    && (await s2.inputValue('#ha-url')) === 'https://ha.test', '');
  await s2.click('#extern-aktiv');
  await rahmen(s2, ['#passiv-min', '#passiv-max'], [3000, 9000]);
  await s2.selectOption('#passiv-dichte', 'selten');
  await s2.click('#passiv-uhr');
  await s2.click('#verriegeln');
  await s2.waitForSelector('.passiv-karte .ha-status.ist-verbunden', { timeout: 60000 });
  ha2.aendern(-4, 'NFC Küche');
  await s2.waitForSelector('.passiv-karte .gutkasten', { timeout: 5000 }).catch(() => {});
  const kasten = (await s2.$('.passiv-karte .gutkasten')) ? await s2.textContent('.passiv-karte .gutkasten') : '';
  pruefe('Eingang mit Grund, nur Richtung', /Eingang · Von außen/.test(kasten) && /NFC Küche: früher\./.test(kasten) && !/min/.test(kasten), kasten.slice(0, 140));
  await s2.screenshot({ path: AUSGABE + '/schuss-ha-passiv.png', fullPage: true });
  await s2.context().close();

  pruefe('keine Seitenfehler', !fehler.length, fehler.join(' | ') || '-');
  console.log(f ? `\nFEHLGESCHLAGEN: ${f}` : '\nAlles gruen.');
  await browser.close(); process.exit(f ? 1 : 0);
})();
