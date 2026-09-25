// Der Stein: Logik (Bissen, Gewicht, Boden, Wartezeit) und Buehne (Wechsel, Zurueckrollen, Gipfel).
const { chromium } = require('./playwright.js');
const AUSGABE = require('path').join(__dirname, 'schuesse');
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
    H.registrieren({ id: 'probe-knopf', dimension: 'geduld', name: 'Probeknopf', kurz: 'Test',
      erzeuge: () => ({}), schaetzung: () => 10, beschreibe: () => 'Knopf',
      starte: k => { const b = document.createElement('button'); b.id = 't-bestehen'; b.textContent = 'bestehen';
        b.onclick = () => k.fertig(); k.wurzel.append(b); } });
    H.nachDimension = () => [H.hole('probe-knopf')];
    const L = Tresor.tresorLogik;
    L.STEIN.stoesse = 6; L.STEIN.wartenBissen = 20;
    L.AUSSCHLAG.normal.stufen = [[1, 1, 1]]; L.AUSSCHLAG.normal.angebot = 0;
    L.TAKT.ab = 10; L.TAKT.fensterMin = 2;
    L.KAPITULATION.wartenMin = 120; L.KAPITULATION.wartenFaktor = 0;
    L.RECHENZEIT_STUFEN[0] = 2;
  }, schein.info);
  return seite;
}

async function einrichten(seite, { zeitschloss, tz }) {
  const felder = await seite.$$('#ziffernfelder .zifferfeld');
  for (let i = 0; i < felder.length; i++) { await felder[i].click(); await felder[i].type('48271'[i]); }
  await seite.$$eval('.dimension-karte input[type=checkbox]', els => els.forEach(e => {
    if (!e.disabled) { e.checked = e.value === 'geduld'; e.dispatchEvent(new Event('change', { bubbles: true })); } }));
  await seite.$eval('#aufgaben-pro-fragment', e => { e.value = '1'; e.dispatchEvent(new Event('input')); });
  await seite.$eval('#rechenzeit', e => { e.value = '1'; e.dispatchEvent(new Event('input')); });
  await seite.selectOption('#sicherheit', zeitschloss);
  if (tz) await seite.evaluate(t => { [['#tresorzeit-min', t[0]], ['#tresorzeit-max', t[1]]].forEach(([id, v]) => { const s = document.querySelector(id);
    const o = document.createElement('option'); o.value = String(v); s.appendChild(o); s.value = String(v); s.dispatchEvent(new Event('change')); }); }, tz);
  await seite.click('#verriegeln');
  await seite.waitForSelector('.aufgaben-kopf', { timeout: 60000 });
}

const gespeichert = seite => seite.evaluate(() => JSON.parse(localStorage.getItem('tresor.v1')));

async function stossen(seite, folge) {
  for (const h of folge) { await seite.click(`.stein-haende button:text-is("${h}")`); await warte(130); }
}

(async () => {
  const browser = await chromium.launch();
  const fehler = [];

  console.log('Logik');
  const s0 = await neu(browser, fehler);
  const r = await s0.evaluate(async () => {
    const L = Tresor.tresorLogik;
    const bauen = async (sicherheit, tz) => {
      const k = L.standardKonfiguration();
      Object.assign(k, { dimensionen: ['geduld'], stufen: { geduld: 1 }, aufgabenProFragment: 1, sicherheit,
        tresorzeit: { minSekunden: tz[0], maxSekunden: tz[1] }, strafe: 1, notausgang: { modus: 'fest', sekunden: 20000 } });
      L.TAKT.ab = 1e9;
      const t = await L.erstellen({ art: 'zahl', teile: ['1', '2', '3', '4', '5'], konfig: k });
      L.TAKT.ab = 10;
      return t;
    };
    const t = await bauen('drand', [2000, 12000]);
    const e = { art: L.steinArt(t), bissen: L.steinBissen(t), start: t.freigabe.konto.zielSek, folge: [] };
    for (let i = 0; i < 5; i++) e.folge.push(L.steinGipfel(t).sekunden);
    e.nach5 = t.freigabe.konto.zielSek;
    let letzter; for (let i = 0; i < 2000; i++) letzter = L.steinGipfel(t);
    e.boden = { ziel: t.freigabe.konto.zielSek, unten: t.freigabe.leiter[0], letzter: letzter.sekunden, amBoden: L.steinAmBoden(t) };
    e.zaehler = { gipfel: t.steinGipfel, summe: t.steinSumme };
    t.freigabe.z = 'ab'; e.nachFreigabe = L.steinArt(t);
    const fest = await bauen('drand', [3000, 3000]); e.ohneSpielraum = L.steinArt(fest);
    // Willkuer: gezogen
    const w = await bauen('drand', [2000, 12000]); w.konfig.blind = true;
    const z = []; for (let i = 0; i < 30; i++) z.push(L.steinGipfel(w).sekunden);
    e.willkuer = { min: Math.min(...z), max: Math.max(...z) };
    let rr = 0; for (let i = 0; i < 4000; i++) if (L.steinRutscht(w.konfig)) rr++;
    e.rutscht = rr / 4000; e.rutschtNormal = L.steinRutscht({});
    // Vorrat ohne Netz
    const v = await bauen('ohne-rechenzeit', [0, 0]);
    e.vArt = L.steinArt(v);
    const g1 = L.steinGipfel(v), g2 = L.steinGipfel(v);
    e.vorrat = v.steinVorrat; e.vEingeloest = g1.eingeloest + g2.eingeloest;
    const a = v.fragmente[0].aufgaben[0];
    a.zustand.strafeBis = Date.now() + 100000;
    const bis0 = a.zustand.strafeBis;
    e.einloesen = L.steinVorratEinloesen(v, a); e.nachEinloesen = v.steinVorrat; e.kuerzer = (bis0 - a.zustand.strafeBis) / 1000;
    const g3 = L.steinGipfel(v); e.sofort = { eingeloest: g3.eingeloest, vorrat: v.steinVorrat, kuerzer: (bis0 - a.zustand.strafeBis) / 1000 };
    a.zustand.strafeBis = Date.now() + 5000; v.steinVorrat = 100;
    e.nieMehrAlsRest = Math.round(L.steinVorratEinloesen(v, a)); e.restVorrat = Math.round(v.steinVorrat);
    return e;
  });
  pruefe('am Netz: Bissen = 1,5/1000 des Rahmens', r.art === 'netz' && r.bissen === 15, r.bissen + ' s');
  pruefe('jeder Gipfel gleich viel', r.folge.every(x => x === 15) && r.nach5 === r.start - 75, r.folge.join(', '));
  pruefe('beliebig oft - bis zur unteren Grenze, nicht darunter', r.boden.ziel === r.boden.unten && r.boden.letzter === 0 && r.boden.amBoden, `${r.boden.ziel} / ${r.boden.unten}`);
  pruefe('Bilanz zaehlt Gipfel und Zeit', r.zaehler.gipfel === 2005 && r.zaehler.summe === 10000, `${r.zaehler.gipfel} Gipfel, ${r.zaehler.summe} s`);
  pruefe('nach der Freigabe / ohne Spielraum: kein Stein', r.nachFreigabe === null && r.ohneSpielraum === null, `${r.nachFreigabe} / ${r.ohneSpielraum}`);
  pruefe('Willkuer: Bissen gezogen', r.willkuer.max > r.willkuer.min, `${r.willkuer.min}..${r.willkuer.max} s`);
  pruefe('Willkuer: rutscht etwa jedes 7. Mal ab, sonst nie', r.rutscht > 0.12 && r.rutscht < 0.18 && !r.rutschtNormal, (r.rutscht * 100).toFixed(1) + ' %');
  pruefe('ohne Netz: Gipfel fuellen den Vorrat', r.vArt === 'vorrat' && r.vorrat === 40 && r.vEingeloest === 0, r.vorrat + ' s');
  pruefe('Vorrat bezahlt die naechste Wartezeit', r.einloesen === 40 && r.nachEinloesen === 0 && r.kuerzer === 40, `-${r.kuerzer} s`);
  pruefe('laeuft eine Wartezeit, wirkt der Gipfel sofort', r.sofort.eingeloest === 20 && r.sofort.vorrat === 0 && r.sofort.kuerzer === 60, `-${r.sofort.kuerzer} s`);
  pruefe('nie mehr als der Rest, der Vorrat bleibt', r.nieMehrAlsRest === 5 && r.restVorrat === 95, `${r.nieMehrAlsRest} s, Vorrat ${r.restVorrat} s`);
  await s0.context().close();

  console.log('\nAm Netz: jederzeit, neben einer offenen Pruefung');
  const s1 = await neu(browser, fehler);
  await einrichten(s1, { zeitschloss: 'drand', tz: [100, 1000] });
  pruefe('Pruefung und Stein zugleich da', !!(await s1.$('#t-bestehen')) && !!(await s1.$('.stein-karte')), '');
  const regel = (await s1.textContent('.stein-karte')).replace(/\s+/g, ' ');
  pruefe('Regel nennt den Bissen', /Jeder Gipfel holt 1 s/.test(regel), regel.slice(regel.indexOf('Jeder'), regel.indexOf('Jeder') + 50));
  const vorher = (await gespeichert(s1)).freigabe.konto.zielSek;
  await s1.click('.stein-karte button:text-is("Den Stein rollen")');
  pruefe('Zaehler zeigt die Stoesse', (await s1.textContent('.stein-zaehler')) === 'Noch 6 Stöße', await s1.textContent('.stein-zaehler'));
  await stossen(s1, ['Links', 'Links']);
  pruefe('zweimal dieselbe Hand zaehlt nicht', (await s1.textContent('.stein-zaehler')) === 'Noch 5 Stöße'
    && (await s1.textContent('.steinbox .aufgabe-meldung')) === 'Im Wechsel.', await s1.textContent('.stein-zaehler'));
  await warte(2200);
  pruefe('wer innehaelt, rollt zurueck', (await s1.textContent('.stein-zaehler')) === 'Noch 6 Stöße'
    && (await s1.textContent('.steinbox .aufgabe-meldung')) === 'Er rollt zurück.', await s1.textContent('.stein-zaehler'));
  for (let runde = 0; runde < 3; runde++) await stossen(s1, ['Links', 'Rechts', 'Links', 'Rechts', 'Links', 'Rechts']);
  const meldung = await s1.textContent('.steinbox .aufgabe-meldung');
  const nachher = (await gespeichert(s1)).freigabe.konto.zielSek;
  pruefe('dreimal oben: Freigabe 3 s frueher, gespeichert', vorher - nachher === 3, `${vorher} -> ${nachher} · ${meldung}`);
  pruefe('danach gleich schwer, nicht schwerer', (await s1.textContent('.stein-zaehler')) === 'Noch 6 Stöße', await s1.textContent('.stein-zaehler'));
  pruefe('Bilanz in der Karte', /3-mal oben gewesen · zusammen −3 s/.test(await s1.textContent('.stein-karte')), '');
  // halber Aufstieg, dann Pruefung loesen: die Ansicht zeichnet neu, der Stein bleibt, wo er war
  await stossen(s1, ['Links', 'Rechts', 'Links']);
  await s1.click('#t-bestehen');
  await warte(400);
  pruefe('Pruefung geloest - der Stein bleibt auf halber Hoehe', (await s1.textContent('.stein-zaehler')) === 'Noch 3 Stöße', await s1.textContent('.stein-zaehler'));
  await s1.click('.stein-karte button:text-is("Aufhören")');
  pruefe('Aufhoeren: zurueck zum Knopf', !!(await s1.$('.stein-karte button:text-is("Den Stein rollen")')), '');
  await s1.context().close();

  console.log('\nOhne Netz: Vorrat und Wartezeit (Rechenzeit, kapituliert)');
  const s2 = await neu(browser, fehler);
  await einrichten(s2, { zeitschloss: 'rechenzeit' });
  await s2.click('.stein-karte button:text-is("Den Stein rollen")');
  await stossen(s2, ['Links', 'Rechts', 'Links', 'Rechts', 'Links', 'Rechts']);
  pruefe('ohne Wartezeit: auf den Vorrat', /\+20 s auf den Vorrat\./.test(await s2.textContent('.steinbox .aufgabe-meldung'))
    && (await gespeichert(s2)).steinVorrat === 20, await s2.textContent('.steinbox .aufgabe-meldung'));
  await s2.click('.kapitulation > button.knopf.flach');
  await s2.click('.kapitulation .wuerfelbox button');
  await s2.waitForSelector('text=Kapituliert', { timeout: 10000 });
  const t2 = await gespeichert(s2);
  pruefe('Vorrat bezahlt die Kapitulation', t2.steinVorrat === 0, 'Vorrat ' + t2.steinVorrat);
  pruefe('der Stein lief durch die Kapitulation hindurch weiter', !!(await s2.$('.stein-haende')), '');
  const bis0 = t2.fragmente[0].aufgaben[0].zustand.strafeBis;
  await stossen(s2, ['Links', 'Rechts', 'Links', 'Rechts', 'Links', 'Rechts']);
  const bis1 = (await gespeichert(s2)).fragmente[0].aufgaben[0].zustand.strafeBis;
  const m2 = await s2.textContent('.steinbox .aufgabe-meldung');
  pruefe('laufende Wartezeit schrumpft sofort um 20 s', bis0 - bis1 === 20000 && /gleich von der Wartezeit ab/.test(m2), `-${(bis0 - bis1) / 1000} s · ${m2}`);
  await s2.screenshot({ path: AUSGABE + '/schuss-stein.png', fullPage: true });
  await s2.context().close();

  pruefe('keine Seitenfehler', !fehler.length, fehler.join(' | ') || '-');
  console.log(f ? `\nFEHLGESCHLAGEN: ${f}` : '\nAlles gruen.');
  await browser.close(); process.exit(f ? 1 : 0);
})();
