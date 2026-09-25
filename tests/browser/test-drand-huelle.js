// drand.js + worker-drand.js im echten Browser, gegen eine Schein-Kette.
const { chromium } = require('./playwright.js');
const schein = require('./scheinkette.js').neu();
(async () => {
  const browser = await chromium.launch();
  const seite = await (await browser.newContext()).newPage();
  const fehler = [];
  seite.on('pageerror', e => fehler.push(e.message));
  await seite.goto('http://127.0.0.1:8099/index.html');
  await seite.waitForFunction(() => window.Tresor && Tresor.drand);

  const jetzt = Date.now();
  const rVergangen = schein.rundeZu(jetzt - 60e3), rZukunft = schein.rundeZu(jetzt + 7 * 86400e3);
  const beacons = { [rVergangen]: schein.beacon(rVergangen) };
  const falsch = { [rVergangen]: schein.gefaelscht(rVergangen) };

  const erg = await seite.evaluate(async ({ info, beacons, falsch, rV, rZ }) => {
    const D = Tresor.drand, z = 'c0ffee'.repeat(10) + 'beef';
    const art = async f => { try { return 'offen:' + (await f()); } catch (e) { return e.art || e.message; } };
    D.testKette(info, async r => { if (beacons[r]) return beacons[r]; const e = new Error('fehlt'); e.art = 'netz'; throw e; });
    const schritte = [];
    const t0 = performance.now();
    const pakete = await D.verschliessen([rV, rZ], z, (f, v) => schritte.push(f + '/' + v));
    const ms = performance.now() - t0;
    const r = {
      ms: Math.round(ms), schritte: schritte.join(' '),
      zweiPakete: pakete.length === 2 && pakete[0] !== pakete[1],
      vergangen: await art(() => D.oeffnen(rV, pakete[0])),
      zukunft: await art(() => D.oeffnen(rZ, pakete[1])),
      falschePaarung: await art(() => D.oeffnen(rV, pakete[1])),
      z
    };
    D.testKette(info, async r2 => falsch[r2]);
    r.gefaelscht = await art(() => D.oeffnen(rV, pakete[0]));
    D.testKette(info, async () => { throw new Error('Failed to fetch'); });
    r.ohneNetz = await art(() => D.oeffnen(rV, pakete[0]));
    D.testKette(null, null);
    r.zurueck = D.kette().metadata.beaconID;
    return r;
  }, { info: schein.info, beacons, falsch, rV: rVergangen, rZ: rZukunft });

  let f = 0;
  const pruefe = (n, ok, t) => { console.log(`  [${ok ? 'ok  ' : 'FEHL'}] ${n.padEnd(44)} ${t}`); if (!ok) f++; };
  pruefe('Worker verschluesselt zwei Sprossen', erg.zweiPakete, `${erg.ms} ms, Fortschritt ${erg.schritte}`);
  pruefe('vergangene Runde oeffnet', erg.vergangen === 'offen:' + erg.z, erg.vergangen.slice(0, 20) + '...');
  pruefe('kuenftige Runde: zu frueh', erg.zukunft === 'zufrueh', erg.zukunft);
  pruefe('Paket der Zukunft mit altem Beacon: nein', erg.falschePaarung !== 'offen:' + erg.z, erg.falschePaarung.slice(0, 60));
  pruefe('gefaelschter Beacon: ungueltig', erg.gefaelscht === 'ungueltig', erg.gefaelscht);
  pruefe('kein Netz: sauber gemeldet', erg.ohneNetz === 'netz', erg.ohneNetz);
  pruefe('Testnaht setzt zurueck auf quicknet', erg.zurueck === 'quicknet', erg.zurueck);
  pruefe('keine Seitenfehler', !fehler.length, fehler.join(' | ') || '-');
  console.log(f ? `FEHLGESCHLAGEN: ${f}` : 'Alles gruen.');
  await browser.close(); process.exit(f ? 1 : 0);
})();
