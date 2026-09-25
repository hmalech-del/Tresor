// Verriegeln, Strafen, Freigabe und Notausgang im drand-Modus - gegen eine
// Schein-Kette mit einer Sekunde je Runde, damit der Test in Sekunden laeuft.
const { chromium } = require('./playwright.js');
const schein = require('./scheinkette.js').neu({ period: 1, genesisSek: Math.floor(Date.now() / 1000) - 5000 });
let f = 0;
const pruefe = (n, ok, t) => { console.log(`  [${ok ? 'ok  ' : 'FEHL'}] ${n.padEnd(50)} ${t}`); if (!ok) f++; };
(async () => {
  const browser = await chromium.launch();
  const seite = await (await browser.newContext()).newPage();
  const fehler = [];
  seite.on('pageerror', e => fehler.push(e.message));
  await seite.exposeFunction('scheinBeacon', r => schein.beacon(r));
  await seite.goto('http://127.0.0.1:8099/index.html');
  await seite.waitForFunction(() => window.Tresor && Tresor.drand && Tresor.tresorLogik);
  await seite.evaluate(info => Tresor.drand.testKette(info, r => window.scheinBeacon(r)), schein.info);

  console.log('Verriegeln');
  const a = await seite.evaluate(async () => {
    const L = Tresor.tresorLogik, k = L.standardKonfiguration();
    Object.assign(k, { dimensionen: ['geduld'], stufen: { geduld: 1 }, aufgabenProFragment: 1,
      sicherheit: 'drand', tresorzeit: { minSekunden: 10, maxSekunden: 12 }, strafe: 2,
      notausgang: { modus: 'fest', sekunden: 40 } });
    const phasen = [];
    const t0 = performance.now();
    const t = await L.erstellen({ art: 'zahl', teile: ['4', '8', '2', '7'], konfig: k,
      beiFortschritt: m => phasen.push(m.text) });
    window.__t = t;
    const roh = JSON.stringify(t);
    return {
      ms: Math.round(performance.now() - t0),
      sprossen: t.freigabe.leiter.length, leiter: t.freigabe.leiter,
      tresorzeit: t.freigabe.tresorzeit, deckel: t.freigabe.deckel,
      zGespeichert: t.freigabe.z, fragmenteDrand: t.fragmente.every(x => x.drand && !x.schluessel && !x.schloss),
      exitArt: t.notausgang.art, exitRundeZeit: Tresor.drand.zeitVon(t.notausgang.runde) - t.freigabe.start,
      obersteZeit: Tresor.drand.zeitVon(t.freigabe.runden[t.freigabe.runden.length - 1]) - t.freigabe.start,
      keinKlartext: !/"4"|"8"|"2"|"7"/.test(JSON.stringify(t.fragmente.map(x => x.paket))),
      bindenGemeldet: phasen.some(p => /Netz binden/.test(p)),
      groesseKiB: +(roh.length / 1024).toFixed(1)
    };
  });
  pruefe('verriegelt ohne Fehler', a.sprossen > 1, `${a.ms} ms, ${a.sprossen} Sprossen, ${a.groesseKiB} KiB`);
  pruefe('Tresorzeit liegt in der Spanne', a.tresorzeit >= 10 && a.tresorzeit <= 12, `${a.tresorzeit} s`);
  pruefe('Leiter endet am Notausgang', a.deckel === 40 && a.leiter[a.leiter.length - 1] === 40, `Deckel ${a.deckel} s`);
  pruefe('oberste Sprosse = Notausgangsrunde', Math.abs(a.obersteZeit - a.exitRundeZeit) < 1000,
    `${a.obersteZeit} ms / ${a.exitRundeZeit} ms nach Start`);
  pruefe('Zeitschluessel NICHT gespeichert', a.zGespeichert === null, String(a.zGespeichert));
  pruefe('Fragmente haengen am Netz, nicht am Speicher', a.fragmenteDrand, 'drand:true, kein Schluessel, kein Puzzle');
  pruefe('Notausgang laeuft ueber das Netz', a.exitArt === 'drand', a.exitArt);
  pruefe('Fortschritt wird gemeldet', a.bindenGemeldet, 'Freigabe an das Netz binden ...');

  console.log('\nVor der Zeit');
  const b = await seite.evaluate(async () => {
    const L = Tresor.tresorLogik, t = window.__t;
    let versuch; try { await L.freigabeHolen(t); versuch = 'offen'; } catch (e) { versuch = e.art; }
    return { erreicht: L.freigabeErreicht(t), versuch };
  });
  pruefe('Freigabe noch nicht erreicht', !b.erreicht, String(b.erreicht));
  pruefe('Holen scheitert: zu frueh', b.versuch === 'zufrueh', b.versuch);

  console.log('\nStrafen');
  const c = await seite.evaluate(() => {
    const L = Tresor.tresorLogik, t = window.__t;
    const vorher = L.freigabeZiel(t).zeit, r = [];
    for (let n = 1; n <= 3; n++) r.push(L.strafeBuchen(t, n));
    const nachher = L.freigabeZiel(t).zeit;
    let deckel; for (let n = 4; n <= 30; n++) deckel = L.strafeBuchen(t, n) || deckel;
    return { gewuenscht: r.map(x => x.gewuenscht), wirksam: r.map(x => x.wirksam),
      vorher, nachher, amDeckel: L.freigabeZiel(t).sekunden, letzte: deckel };
  });
  const summe = c.gewuenscht.reduce((s, x) => s + x, 0);
  // Wachstum in echter Groesse pruefen: bei 11 s Tresorzeit frisst das Runden auf ganze Sekunden die Stufen.
  const echt = await seite.evaluate(() => {
    const L = Tresor.tresorLogik, k = { strafe: 1 }, h = { strafe: 2 }, tag = 2 * 86400;
    return { mild: [1, 2, 3].map(n => L.drandStrafe(k, n, 3600)), hart: [1, 2, 3].map(n => L.drandStrafe(h, n, 3600)),
      tage: [1, 2, 3].map(n => L.drandStrafe(h, n, tag)), deckel: L.drandStrafe(h, 20, 3600), aus: L.drandStrafe({ strafe: 0 }, 3, 3600) };
  });
  const min = a => a.map(x => (x / 60).toFixed(1)).join(' < ');
  pruefe('Strafen wachsen (1 h, mild)', echt.mild[0] < echt.mild[1] && echt.mild[1] < echt.mild[2], min(echt.mild) + ' min');
  pruefe('Strafen wachsen (1 h, hart)', echt.hart[0] < echt.hart[1] && echt.hart[1] < echt.hart[2], min(echt.hart) + ' min');
  pruefe('skaliert mit dem oberen Wert (2 Tage, hart: 8 %)', echt.tage[0] === Math.round(2 * 86400 * 0.08),
    echt.tage.map(x => (x / 3600).toFixed(1)).join(' < ') + ' h');
  pruefe('eine Strafe hoechstens ein Viertel des oberen Werts', echt.deckel === 900, echt.deckel + ' s');
  pruefe('Strafe aus heisst aus', echt.aus === 0, String(echt.aus));
  pruefe('Freigabe rueckt nach hinten', c.nachher > c.vorher, `+${((c.nachher - c.vorher) / 1000).toFixed(0)} s (gefordert ${summe} s)`);
  pruefe('ueber den Deckel geht es nicht', c.amDeckel === 40 && c.letzte.amDeckel && c.letzte.wirksam === 0,
    `Ziel ${c.amDeckel} s, letzte Strafe wirksam ${c.letzte.wirksam}`);

  // zurueck auf eine erreichbare Sprosse, damit der Test nicht 40 s wartet
  await seite.evaluate(() => { window.__t.freigabe.konto.zielSek = window.__t.freigabe.leiter[2]; });

  console.log('\nFreigabe');
  const ziel = await seite.evaluate(() => Tresor.tresorLogik.freigabeZiel(window.__t).zeit);
  await new Promise(r => setTimeout(r, Math.max(0, ziel - Date.now()) + 1500));
  const d = await seite.evaluate(async () => {
    const L = Tresor.tresorLogik, t = window.__t;
    t.fragmente.forEach(fr => fr.aufgaben.forEach(x => { x.erledigt = true; }));
    const z = await L.freigabeHolen(t);
    const inhalte = [];
    for (const fr of t.fragmente) inhalte[fr.position] = await L.fragmentOeffnen(t, fr, z, null);
    return { erreicht: L.freigabeErreicht(t), inhalte: inhalte.join(''), zJetztGespeichert: !!t.freigabe.z };
  });
  pruefe('nach der Zeit: Freigabe erreicht', d.erreicht, String(d.erreicht));
  pruefe('alle Fragmente oeffnen mit dem Netz-Schluessel', d.inhalte === '4827', d.inhalte);
  pruefe('Schluessel bleibt fuer offline gespeichert', d.zJetztGespeichert, '');
  const e = await seite.evaluate(() => Tresor.tresorLogik.strafeBuchen(window.__t, 1));
  pruefe('nach der Freigabe wirkt keine Strafe mehr', e === null, String(e));

  console.log('\nNotausgang');
  const g = await seite.evaluate(async () => {
    const t = window.__t;
    t.fragmente.forEach(fr => { fr.offen = false; fr.inhalt = null; });
    let frueh; try { await Tresor.tresorLogik.notausgangUeberNetz(t, null); frueh = 'offen'; } catch (err) { frueh = err.art; }
    return { frueh, frei: t.notausgang.frei };
  });
  pruefe('Notausgang vor der Zeit: zu frueh', g.frueh === 'zufrueh', g.frueh);
  await new Promise(r => setTimeout(r, Math.max(0, g.frei - Date.now()) + 1500));
  const h = await seite.evaluate(async () => {
    const t = window.__t;
    const teile = await Tresor.tresorLogik.notausgangUeberNetz(t, null);
    return { teile: teile.join(''), benutzt: t.notausgang.benutzt };
  });
  pruefe('Notausgang nach der Zeit: ganzes Geheimnis', h.teile === '4827' && h.benutzt, h.teile);
  pruefe('keine Seitenfehler', !fehler.length, fehler.join(' | ') || '-');
  console.log(f ? `\nFEHLGESCHLAGEN: ${f}` : '\nAlles gruen.');
  await browser.close(); process.exit(f ? 1 : 0);
})();
