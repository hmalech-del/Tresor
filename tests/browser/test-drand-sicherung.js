// Ein drand-Tresor durch Export und Import - und danach oeffnet er noch.
const { chromium } = require('./playwright.js');
const schein = require('./scheinkette.js').neu({ period: 1, genesisSek: Math.floor(Date.now() / 1000) - 5000 });
let f = 0;
const pruefe = (n, ok, t) => { console.log(`  [${ok ? 'ok  ' : 'FEHL'}] ${n.padEnd(46)} ${t}`); if (!ok) f++; };
(async () => {
  const browser = await chromium.launch();
  const seite = await (await browser.newContext()).newPage();
  const fehler = []; seite.on('pageerror', e => fehler.push(e.message));
  await seite.exposeFunction('scheinBeacon', r => schein.beacon(r));
  await seite.goto('http://127.0.0.1:8099/index.html');
  await seite.waitForFunction(() => window.Tresor && Tresor.sicherung);
  const r = await seite.evaluate(async info => {
    Tresor.drand.testKette(info, r => window.scheinBeacon(r));
    const L = Tresor.tresorLogik, k = L.standardKonfiguration();
    Object.assign(k, { dimensionen: ['geduld'], stufen: { geduld: 1 }, aufgabenProFragment: 1, sicherheit: 'drand',
      tresorzeit: { minSekunden: 4, maxSekunden: 4 }, strafe: 1, notausgang: { modus: 'fest', sekunden: 30 } });
    const t = await L.erstellen({ art: 'zahl', teile: ['9', '1', '3'], konfig: k });
    L.strafeBuchen(t, 1);                                    // Konto soll mitwandern
    const aus = {};
    for (const pass of [null, 'geheim-123']) {
      const datei = await Tresor.sicherung.exportieren({ tresor: t, passphrase: pass });
      const zurueck = (await Tresor.sicherung.importieren(datei, pass)).tresor;
      aus[pass ? 'mit' : 'ohne'] = { gleich: JSON.stringify(zurueck.freigabe) === JSON.stringify(t.freigabe)
        && JSON.stringify(zurueck.notausgang) === JSON.stringify(t.notausgang), zurueck };
    }
    await new Promise(res => setTimeout(res, Math.max(0, L.freigabeZiel(aus.mit.zurueck).zeit - Date.now()) + 1500));
    const w = aus.mit.zurueck;
    w.fragmente.forEach(fr => fr.aufgaben.forEach(a => { a.erledigt = true; }));
    const z = await L.freigabeHolen(w);
    const teile = [];
    for (const fr of w.fragmente) teile[fr.position] = await L.fragmentOeffnen(w, fr, z, null);
    return { ohne: aus.ohne.gleich, mit: aus.mit.gleich, zahl: teile.join(''), konto: w.freigabe.konto.zielSek > 4 };
  }, schein.info);
  pruefe('Sicherung ohne Passphrase: Freigabe unversehrt', r.ohne, '');
  pruefe('Sicherung mit Passphrase: Freigabe unversehrt', r.mit, '');
  pruefe('Strafstand reist mit', r.konto, '');
  pruefe('wiederhergestellter Tresor oeffnet am Netz', r.zahl === '913', r.zahl);
  pruefe('keine Seitenfehler', !fehler.length, fehler.join(' | ') || '-');
  console.log(f ? `\nFEHLGESCHLAGEN: ${f}` : '\nAlles gruen.');
  await browser.close(); process.exit(f ? 1 : 0);
})();
