// Rueckkanal und Einbahnstrasse: Die App meldet jede Bewegung der Uhr per
// Webhook an Home Assistant; von aussen darf auf Wunsch nur Zeit dazukommen.
// Home Assistant ist gefaelscht: WebSocket ueber page.routeWebSocket, die
// Webhooks faengt page.route ab.
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
  ha.meldungen = [];
  await seite.route('**/api/webhook/**', route => {
    const req = route.request();
    ha.meldungen.push(Object.assign({ _pfad: new URL(req.url()).pathname }, Object.fromEntries(new URLSearchParams(req.postData() || ''))));
    route.fulfill({ status: 200, body: '' });
  });
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


const warteAuf = async (ha, pruef, ms = 8000) => {
  const ende = Date.now() + ms;
  while (Date.now() < ende) { const m = ha.meldungen.find(pruef); if (m) return m; await new Promise(r => setTimeout(r, 100)); }
  return null;
};

(async () => {
  const browser = await chromium.launch();
  const fehler = [];

  console.log('Logik');
  const { seite: s0 } = await neu(browser, fehler);
  const r = await s0.evaluate(async () => {
    const L = Tresor.tresorLogik;
    const k = Object.assign(L.standardKonfiguration(), { dimensionen: ['geduld'], stufen: { geduld: 1 }, aufgabenProFragment: 1,
      sicherheit: 'drand', tresorzeit: { minSekunden: 1000, maxSekunden: 3000 }, notausgang: { modus: 'aus' },
      extern: true, externNurDazu: true });
    const t = await L.erstellen({ art: 'zahl', teile: ['1', '2'], konfig: k });
    const f = t.freigabe;
    L.externBuchen(t, 10, '', Date.now());
    const runter = L.externBuchen(t, 4, 'Schummeln', Date.now());
    const e = { runter: { ab: runter.abgewiesen, s: runter.sekunden, konto: f.konto.zielSek, basis: f.extern.basis } };
    const hoch = L.externBuchen(t, 6, 'Tür', Date.now());
    e.hoch = hoch.sekunden;
    L.zeitkontoVerschieben(t, -50, 'wurf');
    e.bewegungen = L.neueBewegungen(t, 0).map(b => [b.nr, b.art, b.sekunden, !!b.abgewiesen]);
    e.seit2 = L.neueBewegungen(t, 2).length;
    return e;
  });
  pruefe('Einbahnstrasse: Nachlass abgewiesen, Nullpunkt zieht nach', r.runter.ab && r.runter.s === 0 && r.runter.konto === 3000 && r.runter.basis === 4, JSON.stringify(r.runter));
  pruefe('danach zaehlt der Anstieg vom neuen Nullpunkt (+2 min)', r.hoch === 120, r.hoch + ' s');
  pruefe('Bewegungen durchnummeriert, mit Art', JSON.stringify(r.bewegungen) === JSON.stringify([[1, 'extern', 0, true], [2, 'extern', 120, false], [3, 'wurf', -50, false]]), JSON.stringify(r.bewegungen));
  pruefe('neueBewegungen ab Nummer', r.seit2 === 1, '');
  await s0.context().close();

  console.log('\nNetz mit Einbahnstrasse und Rueckkanal');
  const { seite: s1, ha } = await neu(browser, fehler);
  await ziffern(s1);
  await s1.$$eval('.dimension-karte input[type=checkbox]', els => els.forEach(e => {
    if (!e.disabled) { e.checked = e.value === 'geduld'; e.dispatchEvent(new Event('change', { bubbles: true })); } }));
  await s1.$eval('#aufgaben-pro-fragment', e => { e.value = '1'; e.dispatchEvent(new Event('input')); });
  await s1.selectOption('#sicherheit', 'drand');
  await s1.selectOption('#notausgang-modus', 'aus');
  await rahmen(s1, ['#tresorzeit-min', '#tresorzeit-max'], [600, 1800]);
  await s1.click('#extern-aktiv');
  await s1.selectOption('#extern-richtung', 'dazu');
  await zugang(s1, TOKEN);
  await s1.fill('#ha-rueck', 'tresor-rueck-123');
  await s1.$eval('#ha-rueck', e => e.dispatchEvent(new Event('change', { bubbles: true })));
  await s1.click('#ha-rueck-pruefen');
  const probe = await warteAuf(ha, m => m.art === 'test');
  pruefe('Rueckkanal testen: Probe kommt an', !!probe && probe._pfad === '/api/webhook/tresor-rueck-123', JSON.stringify(probe));
  ha.wert = 10;
  await s1.click('#verriegeln');
  await s1.waitForSelector('#t-bestehen', { timeout: 60000 });
  const verr = await warteAuf(ha, m => m.art === 'verriegelt');
  pruefe('verriegelt: gemeldet, mit Freigabezeit', !!verr && +verr.freigabe_ts > Date.now() / 1000 && +verr.rest_sekunden > 1700, JSON.stringify(verr));
  const t0 = await gespeichert(s1);
  pruefe('Einbahnstrasse steht in der Konfiguration', t0.konfig.externNurDazu === true, '');
  await s1.waitForSelector('.ha-status.ist-verbunden', { timeout: 15000 });

  ha.aendern(20, 'Tür offen');
  const plus = await warteAuf(ha, m => m.art === 'extern' && m.richtung === 'spaeter');
  pruefe('+10 von aussen: gemeldet mit Grund und Betrag', !!plus && plus.sekunden === '600' && plus.grund === 'Tür offen'
    && /Tür offen\. .* 10 Minuten später\./.test(plus.text), plus ? plus.text : '-');
  ha.aendern(5, 'Schummeln');
  await s1.waitForFunction(() => /Nachlass abgewiesen/.test((document.querySelector('.extern-zeile') || {}).textContent || ''), null, { timeout: 5000 }).catch(() => {});
  const zeile = await s1.textContent('.extern-zeile');
  const t1 = await gespeichert(s1);
  pruefe('-15 von aussen: abgewiesen, Uhr bleibt', /Schummeln: Nachlass abgewiesen\./.test(zeile) && t1.freigabe.konto.zielSek === 2400, zeile + ' / ' + t1.freigabe.konto.zielSek);
  const ab = await warteAuf(ha, m => m.richtung === 'abgewiesen');
  pruefe('abgewiesen: auch gemeldet', !!ab && ab.sekunden === '0' && /^Schummeln\. /.test(ab.text) && !/Kontrolle/.test(ab.text), ab ? ab.text : '-');
  await s1.click('#t-bestehen');
  const gut = await warteAuf(ha, m => m.art === 'gutschrift');
  pruefe('Gutschrift: gemeldet, frueher', !!gut && gut.richtung === 'frueher' && +gut.sekunden < 0, gut ? gut.text : '-');
  const zaehl = ha.meldungen.filter(m => m.art !== 'test').map(m => m.art).join(',');
  pruefe('nichts doppelt', zaehl === 'verriegelt,extern,extern,gutschrift', zaehl);
  await s1.reload();
  await s1.waitForSelector('.ha-status.ist-verbunden', { timeout: 15000 });
  await s1.waitForTimeout(800);
  pruefe('nach dem Neuladen: nichts doppelt', ha.meldungen.filter(m => m.art !== 'test').length === 4, String(ha.meldungen.length));
  await s1.context().close();

  console.log('\nPassiv ohne Uhr');
  const { seite: s2, ha: ha2 } = await neu(browser, fehler);
  await s2.evaluate(t => localStorage.setItem('tresor.ha', JSON.stringify({ url: 'https://ha.test', token: t,
    zahl: 'input_number.tresor_minuten', grund: 'input_text.tresor_grund', rueck: 'tresor-rueck-123' })), TOKEN);
  await s2.reload();
  await s2.waitForSelector('#ziffernfelder .zifferfeld');
  await s2.evaluate(() => { const L = Tresor.tresorLogik; L.PASSIV.abstandMin = 1; L.PASSIV.arten = [['wurf', 1]]; });
  await ziffern(s2);
  await s2.click('#spielart-passiv');
  await rahmen(s2, ['#passiv-min', '#passiv-max'], [600, 1200]);
  await s2.selectOption('#passiv-dichte', 'oft');
  await s2.click('#passiv-uhr');
  await s2.click('#verriegeln');
  await s2.waitForSelector('.passiv-karte', { timeout: 60000 });
  const v2 = await warteAuf(ha2, m => m.art === 'verriegelt');
  pruefe('ohne Uhr: keine Freigabezeit nach draussen', !!v2 && v2.spielart === 'passiv' && v2.freigabe_ts === undefined && v2.rest_sekunden === undefined, JSON.stringify(v2));
  const ang = await warteAuf(ha2, m => m.art === 'angebot', 40000);
  pruefe('Wurfangebot: gemeldet', !!ang && ang.text.length > 5, ang ? ang.text : '-');
  await s2.waitForSelector('.passiv-angebot .wuerfelbox button', { timeout: 10000 });
  await s2.click('.passiv-angebot .wuerfelbox button');
  const w = await warteAuf(ha2, m => m.art === 'wurf');
  pruefe('Wurf: nur Richtung, kein Betrag', !!w && w.sekunden === undefined && ['frueher', 'spaeter', 'gleich'].includes(w.richtung)
    && !/Minute|Sekunde/.test(w.text), w ? `${w.richtung} · ${w.text}` : '-');
  await s2.context().close();

  pruefe('keine Seitenfehler', !fehler.length, fehler.join(' | ') || '-');
  console.log(f ? `\nFEHLGESCHLAGEN: ${f}` : '\nAlles gruen.');
  await browser.close(); process.exit(f ? 1 : 0);
})();
