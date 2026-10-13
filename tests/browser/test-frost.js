// Freeze, "eigentlich offen nach" und drakonische Verdopplung. Der Freeze
// kommt aus dem Passiv-Eingang "Stillstand" oder aus Home Assistant
// (input_boolean.tresor_freeze) - Home Assistant ist hier gefaelscht.
const { chromium } = require('./playwright.js');
const AUSGABE = require('path').join(__dirname, 'schuesse');
const schein = require('./scheinkette.js').neu({ period: 1, genesisSek: Math.floor(Date.now() / 1000) - 5000 });
let f = 0;
const pruefe = (n, ok, t) => { console.log(`  [${ok ? 'ok  ' : 'FEHL'}] ${n.padEnd(56)} ${t}`); if (!ok) f++; };
const TOKEN = 'geheimes-token-4711';
const ZAHL = 'input_number.tresor_minuten', GRUND = 'input_text.tresor_grund', FROST = 'input_boolean.tresor_freeze';

/* Ein Home Assistant je Seite: Stand der Zahl, Grund, offene Verbindungen. */
async function neu(browser, fehler) {
  const seite = await (await browser.newContext({ viewport: { width: 390, height: 1000 } })).newPage();
  seite.on('pageerror', e => fehler.push(e.message));
  const ha = { wert: 0, grund: 'unknown', frost: 'off', offen: [], anmeldungen: 0 };
  ha.frieren = an => {
    ha.frost = an ? 'on' : 'off';
    const c = { [FROST]: { '+': { s: ha.frost, lc: Date.now() / 1000 } } };
    ha.offen.forEach(w => w.send(JSON.stringify({ id: 1, type: 'event', event: { c } })));
  };
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
        const a = { [ZAHL]: { s: String(ha.wert), a: {}, lc: Date.now() / 1000 - 60 }, [GRUND]: { s: ha.grund, a: {} }, [FROST]: { s: ha.frost, a: {} } };
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
    const e = {};
    // eigentlich 30 min, hoechstens 3 Tage, frueherstens 10 min
    const k = L.passivKonfiguration({ minSekunden: 600, maxSekunden: 259200 }, { modus: 'aus' },
      { dichte: 'mittel', haerte: 1, gedacht: 1800, drakonisch: true });
    k.extern = true; k.externNurDazu = true;
    const t = await L.erstellen({ art: 'zahl', teile: ['1'], konfig: k });
    const f = t.freigabe, p = f.passiv;
    e.start = { ziel: f.konto.zielSek, einheit: p.einheit, oben: f.leiter[f.leiter.length - 1] };
    // Stillstand: steht 60 s, nach 30 s sind 30 s gebucht, der Rest steht still
    const jetzt = Date.now();
    L.frostStarten(t, 'passiv', jetzt, jetzt + 60000);
    const rest0 = L.frostRest(t);
    const z0 = f.konto.zielSek;
    L.frostNachziehen(t, jetzt + 30000);
    e.halb = { plus: Math.round(f.konto.zielSek - z0), aktiv: L.frostAktiv(t, jetzt + 30000), rest: Math.abs(L.frostRest(t) - rest0) < 0.01,
      gesperrt: !L.freigabeErreicht(t) };
    L.frostNachziehen(t, jetzt + 90000);
    e.ende = { plus: Math.round(f.konto.zielSek - z0), offen: f.frost === null,
      bew: L.neueBewegungen(t, 0).filter(b => b.art === 'frost').map(b => [b.an, b.sekunden]) };
    // Home Assistant und Stillstand ueberlappen: es steht, bis beide vorbei sind
    const z1 = f.konto.zielSek, j2 = jetzt + 100000;
    e.einbahnFrost = L.externFrost(t, true, j2);
    L.frostStarten(t, 'passiv', j2 + 5000, j2 + 20000);
    L.externFrost(t, false, j2 + 10000);
    e.ueberlapp = { nochAktiv: L.frostAktiv(t, j2 + 15000) };
    L.frostNachziehen(t, j2 + 30000);
    e.ueberlapp.plus = Math.round(f.konto.zielSek - z1);
    e.ueberlapp.zu = f.frost === null;
    // Hoechstmass je Freeze von aussen: 60 s, auch wenn der Schalter an bleibt
    t.konfig.frostMax = 60;
    const z2 = f.konto.zielSek, j3 = j2 + 35000;
    L.externFrost(t, true, j3);
    L.frostNachziehen(t, j3 + 120000);
    e.deckelJeFreeze = { plus: Math.round(f.konto.zielSek - z2), zu: f.frost === null,
      nochmal: L.externFrost(t, true, j3) };
    L.externFrost(t, false, j3 + 130000);
    t.konfig.frostMax = 0;
    // am Deckel: nur bis dorthin, dann laeuft die Uhr wieder
    f.konto.zielSek = e.start.oben - 10;
    L.frostStarten(t, 'passiv', j2 + 300000, j2 + 400000);
    L.frostNachziehen(t, j2 + 320000);
    e.deckel = { ziel: f.konto.zielSek, aktiv: L.frostAktiv(t, j2 + 320000) };
    L.frostNachziehen(t, j2 + 500000);
    // Verdopplung: Rest 1000 s -> 2000 s
    f.konto.zielSek = (Date.now() - f.start) / 1000 + 1000;
    const v = L.passivEreignis(t, Date.now(), 'verdoppelt');
    e.verdoppelt = v.sekunden;
    // Abstand waechst mit der Uhr
    f.konto.zielSek = 4 * p.startSek;
    p.naechstes = Date.now() - 1;
    L.passivSchritt(t, Date.now());
    e.abstand = { neu: (p.naechstes - Date.now()) / 1000, basis: p.abstand };
    // drakonisch: Verdopplung kommt vor, sonst nie
    const zaehlen = async drak => {
      const k2 = L.passivKonfiguration({ minSekunden: 600, maxSekunden: 1e7 }, { modus: 'aus' }, { gedacht: 5e6, drakonisch: drak });
      const t2 = await L.erstellen({ art: 'zahl', teile: ['1'], konfig: k2 });
      let n = 0;
      for (let i = 0; i < 2400; i++) { if (L.passivEreignis(t2, Date.now()).art === 'verdoppelt') n++; t2.freigabe.konto.zielSek = 5e6; t2.freigabe.frost = null; }
      return n;
    };
    e.drakonisch = await zaehlen(true);
    e.mild = await zaehlen(false);
    return e;
  });
  pruefe('Start bei "eigentlich 30 min", Leiter bis 3 Tage', r.start.ziel === 1800 && r.start.oben === 259200, JSON.stringify(r.start));
  pruefe('Schritt nach dem Weg bis 30 min: 2400 x 0,22 / Wurzel 12 = 152 s', r.start.einheit === 152, r.start.einheit + ' s');
  pruefe('Stillstand halb vorbei: +30 s, Rest steht, Freigabe gesperrt', r.halb.plus === 30 && r.halb.aktiv && r.halb.rest && r.halb.gesperrt, JSON.stringify(r.halb));
  pruefe('Stillstand vorbei: +60 s, gemeldet an/aus', r.ende.plus === 60 && r.ende.offen && JSON.stringify(r.ende.bew) === '[[true,0],[false,60]]', JSON.stringify(r.ende));
  pruefe('Freeze von aussen auch unter Einbahnstrasse', r.einbahnFrost === true, '');
  pruefe('ueberlappend: steht, bis beide vorbei sind (+20 s)', r.ueberlapp.nochAktiv && r.ueberlapp.plus === 20 && r.ueberlapp.zu, JSON.stringify(r.ueberlapp));
  pruefe('von aussen hoechstens 60 s je Freeze, kein Neustart', r.deckelJeFreeze.plus === 60 && r.deckelJeFreeze.zu && r.deckelJeFreeze.nochmal === false, JSON.stringify(r.deckelJeFreeze));
  pruefe('am Deckel: nur bis dorthin, dann laeuft sie wieder', r.deckel.ziel === 259200 && !r.deckel.aktiv, JSON.stringify(r.deckel));
  pruefe('Verdopplung: Rest 1000 s -> +1000 s', Math.abs(r.verdoppelt - 1000) <= 1, r.verdoppelt + ' s');
  pruefe('Abstand waechst mit der Uhr (x4)', r.abstand.neu >= 0.4 * 4 * r.abstand.basis - 1, JSON.stringify(r.abstand));
  pruefe('drakonisch: etwa jedes 12. Mal verdoppelt, sonst nie', r.drakonisch > 130 && r.drakonisch < 270 && r.mild === 0, `${r.drakonisch} / ${r.mild} von 2400`);
  await s0.context().close();

  console.log('\nPassiv: eigentlich kurz, Stillstand auf der Uhr');
  const { seite: s1 } = await neu(browser, fehler);
  await s1.evaluate(() => { const L = Tresor.tresorLogik; L.PASSIV.abstandMin = 1; L.PASSIV.arten = [['stillstand', 1]]; });
  await ziffern(s1);
  await s1.click('#spielart-passiv');
  await rahmen(s1, ['#passiv-min', '#passiv-gedacht', '#passiv-max'], [20, 60, 600]);
  await s1.selectOption('#passiv-dichte', 'oft');
  await s1.click('#passiv-drakonisch');
  const hinweis = await s1.textContent('#passiv-hinweis');
  pruefe('Hinweis: Start bei 60 s, Verdopplung angesagt', /Die Uhr startet bei 1 min\./.test(hinweis) && /Verdopplung/.test(hinweis), hinweis);
  // ab hier nur Stillstand - eine Verdopplung mitten im Test liesse die Uhr springen
  await s1.evaluate(() => { Tresor.tresorLogik.PASSIV.verdoppeln = 0; });
  await s1.click('#verriegeln');
  await s1.waitForSelector('.passiv-karte .countdown.ist-gefroren', { timeout: 30000 });
  const a = await s1.textContent('.passiv-karte .countdown');
  await s1.waitForTimeout(2200);
  const b = (await s1.$('.passiv-karte .countdown.ist-gefroren')) ? await s1.textContent('.passiv-karte .countdown') : '';
  pruefe('Stillstand: Uhr steht sichtbar', a === b && /Die Uhr steht/.test(await s1.textContent('.passiv-karte')), `${a} / ${b}`);
  await s1.screenshot({ path: AUSGABE + '/schuss-frost-passiv.png', fullPage: true });
  await s1.context().close();

  console.log('\nNetz: Freeze aus Home Assistant');
  const { seite: s2, ha } = await neu(browser, fehler);
  await ziffern(s2);
  await s2.$$eval('.dimension-karte input[type=checkbox]', els => els.forEach(e => {
    if (!e.disabled) { e.checked = e.value === 'geduld'; e.dispatchEvent(new Event('change', { bubbles: true })); } }));
  await s2.$eval('#aufgaben-pro-fragment', e => { e.value = '1'; e.dispatchEvent(new Event('input')); });
  await s2.selectOption('#sicherheit', 'drand');
  await s2.selectOption('#notausgang-modus', 'aus');
  await rahmen(s2, ['#tresorzeit-min', '#tresorzeit-max'], [600, 1800]);
  await s2.click('#extern-aktiv');
  await s2.selectOption('#extern-richtung', 'dazu');
  await zugang(s2, TOKEN);
  await s2.fill('#ha-rueck', 'tresor-rueck-123');
  await s2.$eval('#ha-rueck', e => e.dispatchEvent(new Event('change', { bubbles: true })));
  await s2.click('#verriegeln');
  await s2.waitForSelector('#t-bestehen', { timeout: 60000 });
  await s2.waitForSelector('.ha-status.ist-verbunden', { timeout: 15000 });
  const z0 = (await gespeichert(s2)).freigabe.konto.zielSek;
  ha.frieren(true);
  await s2.waitForSelector('.freigabe-karte .countdown.ist-gefroren', { timeout: 5000 }).catch(() => {});
  pruefe('Schalter an: Uhr steht', !!(await s2.$('.freigabe-karte .countdown.ist-gefroren')), await s2.textContent('.freigabe-karte'));
  const an = await warteAuf(ha, m => m.art === 'frost' && m.frost === 'an');
  pruefe('Rueckkanal: frost an', !!an && /steht|Angehalten|Eingefroren/.test(an.text), an ? an.text : '-');
  await s2.waitForTimeout(3000);
  ha.frieren(false);
  await s2.waitForFunction(() => !document.querySelector('.freigabe-karte .countdown.ist-gefroren'), null, { timeout: 5000 }).catch(() => {});
  const z1 = (await gespeichert(s2)).freigabe.konto.zielSek;
  pruefe('Schalter aus: Uhr laeuft, ~3 s spaeter', !(await s2.$('.freigabe-karte .countdown.ist-gefroren')) && z1 - z0 >= 2.5 && z1 - z0 <= 5, `+${(z1 - z0).toFixed(1)} s`);
  const aus = await warteAuf(ha, m => m.art === 'frost' && m.frost === 'aus');
  pruefe('Rueckkanal: frost aus, mit Dauer', !!aus && +aus.sekunden >= 2 && /später/.test(aus.text), aus ? aus.text : '-');
  await s2.context().close();

  pruefe('keine Seitenfehler', !fehler.length, fehler.join(' | ') || '-');
  console.log(f ? `\nFEHLGESCHLAGEN: ${f}` : '\nAlles gruen.');
  await browser.close(); process.exit(f ? 1 : 0);
})();
