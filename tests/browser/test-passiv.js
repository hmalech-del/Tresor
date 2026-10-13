// Spielart Passiv: Logik (Rahmen, Ereignisse, Wurf, Nachholen) und Oberflaeche (Einrichten, Karte, Freigabe).
const { chromium } = require('./playwright.js');
const AUSGABE = require('path').join(__dirname, 'schuesse');
const schein = require('./scheinkette.js').neu({ period: 1, genesisSek: Math.floor(Date.now() / 1000) - 5000 });
let f = 0;
const pruefe = (n, ok, t) => { console.log(`  [${ok ? 'ok  ' : 'FEHL'}] ${n.padEnd(54)} ${t}`); if (!ok) f++; };

async function neu(browser, fehler) {
  const seite = await (await browser.newContext({ viewport: { width: 390, height: 1000 } })).newPage();
  seite.on('pageerror', e => fehler.push(e.message));
  await seite.exposeFunction('scheinBeacon', r => schein.beacon(r));
  await seite.goto('http://127.0.0.1:8099/index.html');
  await seite.waitForSelector('#ziffernfelder .zifferfeld');
  await seite.evaluate(info => { Tresor.drand.testKette(info, r => window.scheinBeacon(r)); }, schein.info);
  return seite;
}

/* Passiv einrichten; rahmen in Sekunden (eigene Optionen, die Auswahl kennt so kurze nicht). */
async function einrichten(seite, { rahmen, uhr = true, arten }) {
  await seite.evaluate(a => { const L = Tresor.tresorLogik; L.PASSIV.abstandMin = 1; if (a) L.PASSIV.arten = a; }, arten || null);
  const felder = await seite.$$('#ziffernfelder .zifferfeld');
  for (let i = 0; i < felder.length; i++) { await felder[i].click(); await felder[i].type('48271'[i]); }
  await seite.click('#spielart-passiv');
  await seite.evaluate(t => { [['#passiv-min', t[0]], ['#passiv-max', t[1]]].forEach(([id, v]) => { const s = document.querySelector(id);
    const o = document.createElement('option'); o.value = String(v); s.appendChild(o); s.value = String(v); s.dispatchEvent(new Event('change')); }); }, rahmen);
  await seite.selectOption('#passiv-dichte', 'oft');
  if (!uhr) await seite.click('#passiv-uhr');
}

const gespeichert = seite => seite.evaluate(() => JSON.parse(localStorage.getItem('tresor.v1')));

(async () => {
  const browser = await chromium.launch();
  const fehler = [];

  console.log('Logik');
  const s0 = await neu(browser, fehler);
  const r = await s0.evaluate(async () => {
    const L = Tresor.tresorLogik;
    const k = L.passivKonfiguration({ minSekunden: 1000, maxSekunden: 3000 }, { modus: 'aus' }, { dichte: 'mittel', haerte: 1, uhr: true });
    const t = await L.erstellen({ art: 'zahl', teile: ['48271'], konfig: k });
    const f = t.freigabe, p = f.passiv;
    const e = {
      laenge: t.laenge, aufgaben: t.fragmente[0].aufgaben.length, notausgang: t.notausgang,
      leiter: [f.leiter[0], f.leiter[f.leiter.length - 1]], start: f.konto.zielSek, einheit: p.einheit,
      ersterNach: Math.round((p.naechstes - f.start) / 1000), abstand: Math.round(p.abstand)
    };
    e.nachlass = L.passivEreignis(t, Date.now(), 'nachlass').sekunden;
    e.aufschlag = L.passivEreignis(t, Date.now(), 'aufschlag').sekunden;
    e.stille = L.passivEreignis(t, Date.now(), 'stille').sekunden;
    const w = L.passivEreignis(t, Date.now(), 'wurf');
    e.angebot = !!p.angebot && w.offen;
    f.konto.zielSek = 2000;
    e.wurf6 = L.passivWuerfeln(t, 6).sekunden;
    e.zweimal = L.passivWuerfeln(t, 6);
    L.passivEreignis(t, Date.now(), 'wurf');
    L.passivEreignis(t, Date.now(), 'stille');
    e.verfallen = p.protokoll[1].verfallen === true && !p.angebot;
    L.passivEreignis(t, Date.now(), 'wurf');
    e.abgelehnt = L.passivAblehnen(t) && p.protokoll[0].abgelehnt === true && !p.angebot;
    // am Rand: nichts mehr zu holen, kein Stueck ueber den Rahmen hinaus
    f.konto.zielSek = 1000;
    const rand = L.passivEreignis(t, Date.now(), 'nachlass');
    e.boden = { s: rand.sekunden, amBoden: rand.amBoden };
    f.konto.zielSek = 3000;
    const oben = L.passivEreignis(t, Date.now(), 'aufschlag');
    e.deckel = { s: oben.sekunden, ziel: f.konto.zielSek };
    // Nachholen: verpasste Ereignisse der Reihe nach, nur vor der Freigabe
    f.konto.zielSek = 2000;
    p.abstand = 100; p.naechstes = f.start + 1000; p.nr = 0; p.protokoll = []; p.angebot = null;
    const jetzt = f.start + 1500 * 1000;
    const nach = L.passivSchritt(t, jetzt);
    const ziel = L.freigabeZiel(t).zeit;
    e.nachgeholt = { n: nach.length, alleVorher: nach.every(x => x.zeit <= jetzt),
      geordnet: nach.every((x, i) => !i || x.zeit > nach[i - 1].zeit),
      naechstesDanach: p.naechstes > jetzt || L.freigabeZiel(t).zeit <= p.naechstes };
    f.konto.zielSek = 1000;
    const zielFrueh = L.freigabeZiel(t).zeit;
    const spaet = L.passivSchritt(t, f.start + 2900 * 1000);
    e.nachFreigabe = spaet.every(x => x.zeit < zielFrueh);
    e.wurfSumme = L.PASSIV.wurf.reduce((a, b) => a + b, 0);
    const g = Object.fromEntries(L.PASSIV.arten);
    e.symmetrisch = g.nachlass === g.aufschlag + g.stillstand;
    // Mittelwert ueber viele Ereignisse ohne Rand: nahe null
    const k2 = L.passivKonfiguration({ minSekunden: 1000, maxSekunden: 1e7 }, { modus: 'aus' }, { dichte: 'mittel', haerte: 1 });
    const t2 = await L.erstellen({ art: 'zahl', teile: ['1'], konfig: k2 });
    t2.freigabe.konto.zielSek = 5e6;
    let summe = 0, n = 0;
    for (let i = 0; i < 6000; i++) {
      const x = L.passivEreignis(t2, Date.now());
      if (x.art === 'wurf') summe += L.passivWuerfeln(t2, 1 + (i % 6)).sekunden;
      else summe += x.sekunden;            // Stillstand: die geplante Dauer
      n++;
      // jedes Ereignis von derselben Stelle aus, weit weg vom Rand - sonst
      // kappt der Rahmen, und das Mittel misst den Rand statt der Ereignisse
      t2.freigabe.konto.zielSek = 5e6; t2.freigabe.frost = null;
    }
    e.mittel = summe / n / t2.freigabe.passiv.einheit;
    return e;
  });
  pruefe('ein Fragment, keine Pruefung, kein Notausgang', r.laenge === 1 && r.aufgaben === 0 && r.notausgang === null, '');
  pruefe('Leiter endet am Rahmen (1000-3000 s)', r.leiter[0] === 1000 && Math.abs(r.leiter[1] - 3000) < 1, r.leiter.join('-'));
  pruefe('Start in der Mitte (1700-2300 s)', r.start >= 1700 && r.start <= 2300, r.start + ' s');
  pruefe('Einheit = 2000 x 0,22 / Wurzel 12 = 127 s', r.einheit === 127, r.einheit + ' s');
  pruefe('Abstand = Start / 13, erster Eingang darin', r.abstand === Math.round(r.start / 13) && r.ersterNach >= 0.4 * r.abstand - 1 && r.ersterNach <= 1.6 * r.abstand + 1, r.abstand + ' s, erster nach ' + r.ersterNach + ' s');
  pruefe('Nachlass frueher, Aufschlag spaeter, Kontrolle nichts', r.nachlass < 0 && r.aufschlag > 0 && r.stille === 0, `${r.nachlass} / ${r.aufschlag} / ${r.stille}`);
  pruefe('Angebot offen, 6 = -2 Einheiten, nur einmal', r.angebot && r.wurf6 === -254 && r.zweimal === null, r.wurf6 + ' s');
  pruefe('Angebot verfaellt beim naechsten Eingang', r.verfallen, '');
  pruefe('Angebot ausschlagen', r.abgelehnt, '');
  pruefe('am Boden: kein Nachlass mehr', r.boden.s === 0 && r.boden.amBoden, JSON.stringify(r.boden));
  pruefe('am Deckel: kein Aufschlag ueber den Rahmen', r.deckel.s === 0 && r.deckel.ziel === 3000, JSON.stringify(r.deckel));
  pruefe('Nachholen: der Reihe nach, alle vor jetzt', r.nachgeholt.n >= 6 && r.nachgeholt.alleVorher && r.nachgeholt.geordnet && r.nachgeholt.naechstesDanach, JSON.stringify(r.nachgeholt));
  pruefe('nach der Freigabe kommt nichts mehr', r.nachFreigabe, '');
  pruefe('fair: Wurf im Mittel null, Nachlass = Aufschlag + Stillstand', r.wurfSumme === 0 && r.symmetrisch, '');
  pruefe('fair: 6000 Ereignisse, Mittel nahe null', Math.abs(r.mittel) < 0.05, r.mittel.toFixed(3) + ' Einheiten');
  await s0.context().close();

  console.log('\nEinrichten');
  const s1 = await neu(browser, fehler);
  await einrichten(s1, { rahmen: [20, 45], arten: [['wurf', 1]] });
  const sicht = await s1.evaluate(() => {
    const zu = sel => { const e = document.querySelector(sel); return !e || e.closest('.versteckt') !== null; };
    return { passiv: !zu('#passiv-min'), dimension: zu('.dimension-gitter'), willkuer: zu('#blindgang'), zeit: zu('#sicherheit'),
      notausgang: zu('#notausgang-modus'), fein: zu('#aufgaben-pro-fragment'), probe: zu('#probekarte'),
      knopf: !document.querySelector('#verriegeln').disabled, hinweis: document.querySelector('#passiv-hinweis').textContent };
  });
  pruefe('Passiv: nur Geheimnis und Rahmen', sicht.passiv && sicht.dimension && sicht.willkuer && sicht.zeit && sicht.notausgang && sicht.fein && sicht.probe, JSON.stringify(sicht));
  pruefe('verriegelbar ohne Dimension', sicht.knopf, '');
  pruefe('Hinweis nennt Rahmen und Schritt', /Nie vor 20 s, nie nach 45 s/.test(sicht.hinweis), sicht.hinweis);
  await s1.screenshot({ path: AUSGABE + '/schuss-passiv-einrichten.png', fullPage: true });
  await s1.click('#spielart-pruefungen');
  const zurueck = await s1.evaluate(() => ({ dim: !document.querySelector('.dimension-gitter').closest('.versteckt'),
    frist: document.querySelector('#frist-bereich').classList.contains('versteckt') }));
  pruefe('zurueck zu Pruefungen: alles wieder da, Frist bleibt zu', zurueck.dim && zurueck.frist, JSON.stringify(zurueck));
  await s1.click('#spielart-passiv');
  await s1.click('#verriegeln');
  await s1.waitForSelector('.passiv-karte', { timeout: 60000 });

  console.log('\nTresor');
  const ansicht = await s1.evaluate(() => ({ band: !!document.querySelector('.band-karte'), stein: !!document.querySelector('.stein-karte'),
    fahrplan: /Fahrplan/.test(document.body.textContent), uhr: document.querySelector('.passiv-karte .countdown').textContent }));
  pruefe('keine Fragmente, kein Stein, kein Fahrplan', !ansicht.band && !ansicht.stein && !ansicht.fahrplan, JSON.stringify(ansicht));
  pruefe('Uhr laeuft', /^\d+:\d\d$/.test(ansicht.uhr), ansicht.uhr);
  await s1.waitForSelector('.passiv-angebot .wuerfelbox button', { timeout: 15000 });
  const vorWurf = (await gespeichert(s1)).freigabe.konto.zielSek;
  await s1.click('.passiv-angebot .wuerfelbox button');
  await s1.waitForSelector('.passiv-angebot button:text-is("Weiter")', { timeout: 5000 });
  const t1 = await gespeichert(s1);
  const geworfen = t1.freigabe.passiv.protokoll.find(e => e.augen);
  pruefe('Wurf gebucht, Lass-es weg', !!geworfen && !(await s1.$('.passiv-angebot button:text-is("Lass es")')),
    geworfen ? `Augen ${geworfen.augen}, ${geworfen.sekunden} s (Konto ${vorWurf} -> ${t1.freigabe.konto.zielSek})` : '-');
  pruefe('Ergebnis steht beim Wuerfel', /Gewürfelt: \d/.test(await s1.textContent('.passiv-angebot .wuerfelbox')), await s1.textContent('.passiv-angebot .wuerfelbox .flaut'));
  await s1.screenshot({ path: AUSGABE + '/schuss-passiv-angebot.png', fullPage: true });
  // ab jetzt nur Nachlass: die Uhr laeuft auf den Boden zu
  await s1.evaluate(() => { Tresor.tresorLogik.PASSIV.arten = [['nachlass', 1]]; });
  await s1.click('.passiv-angebot button:text-is("Weiter")');
  await s1.waitForSelector('.passiv-karte .gutkasten', { timeout: 15000 });
  const eingang = await s1.textContent('.passiv-karte .gutkasten');
  pruefe('Eingang: Nachlass mit Betrag', /Nachlass · −\d+ s\./.test(eingang), eingang.slice(0, 120));
  await s1.screenshot({ path: AUSGABE + '/schuss-passiv.png', fullPage: true });
  await s1.waitForSelector('.grossezahl', { timeout: 60000 });
  pruefe('Zeit um: das Geheimnis am Stueck', (await s1.textContent('.grossezahl')) === '48271', await s1.textContent('.grossezahl'));
  await s1.context().close();

  console.log('\nOhne Uhr');
  const s2 = await neu(browser, fehler);
  await einrichten(s2, { rahmen: [200, 400], uhr: false, arten: [['aufschlag', 1]] });
  await s2.click('#verriegeln');
  await s2.waitForSelector('.passiv-karte', { timeout: 60000 });
  pruefe('keine Uhr', (await s2.textContent('.passiv-karte .countdown')) === '· · ·', await s2.textContent('.passiv-karte .countdown'));
  await s2.waitForSelector('.passiv-karte .strafkasten', { timeout: 30000 });   // Abstand hier ~12 s, erster nach 5-19 s
  const dunkel = await s2.textContent('.passiv-karte .strafkasten');
  pruefe('Eingang nur mit Richtung, ohne Betrag', /Aufschlag · Später\./.test(dunkel) && !/\d+ s\./.test(dunkel), dunkel.slice(0, 120));
  await s2.click('.passiv-karte .strafkasten button:text-is("Verstanden")');
  pruefe('Verstanden: Kasten weg, Eingaenge im Protokoll', !(await s2.$('.passiv-karte .strafkasten')) && /Eingänge \(\d+\)/.test(await s2.textContent('.passiv-eingaenge summary')), '');
  // Neu laden: Eingaenge waehrend der Abwesenheit werden nachgeholt. Das Init-Skript
  // laeuft nach dem Speichern der alten Seite (pagehide) und vor dem Start der neuen:
  // Es haengt die Testkette ein und legt den naechsten Eingang in die Vergangenheit.
  const vorher = (await gespeichert(s2)).freigabe.passiv.nr;
  await s2.context().addInitScript(info => {
    document.addEventListener('DOMContentLoaded', () => Tresor.drand.testKette(info, r => window.scheinBeacon(r)));
    if (sessionStorage.getItem('nachholen')) return;
    sessionStorage.setItem('nachholen', '1');
    const t = JSON.parse(localStorage.getItem('tresor.v1'));
    t.freigabe.passiv.naechstes = Date.now() - 3000;
    t.freigabe.passiv.abstand = 1;
    localStorage.setItem('tresor.v1', JSON.stringify(t));
  }, schein.info);
  await s2.reload();
  await s2.waitForSelector('.passiv-karte', { timeout: 20000 });
  const danach = (await gespeichert(s2)).freigabe.passiv.nr;
  pruefe('nach dem Neuladen nachgeholt', danach >= vorher + 2, `${vorher} -> ${danach}`);
  await s2.context().close();

  pruefe('keine Seitenfehler', !fehler.length, fehler.join(' | ') || '-');
  console.log(f ? `\nFEHLGESCHLAGEN: ${f}` : '\nAlles gruen.');
  await browser.close(); process.exit(f ? 1 : 0);
})();
