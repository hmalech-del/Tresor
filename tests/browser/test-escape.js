// Escape Room: eine Kette versteckter Posten in einer Reihenfolge, die nur
// die App kennt. Je Runde eine angesagte Regel fuer Fehler.
const { chromium } = require('./playwright.js');
const AUSGABE = require('path').join(__dirname, 'schuesse');
const schein = require('./scheinkette.js').neu({ period: 1, genesisSek: Math.floor(Date.now() / 1000) - 5000 });
let f = 0;
const pruefe = (n, ok, t) => { console.log(`  [${ok ? 'ok  ' : 'FEHL'}] ${n.padEnd(56)} ${t}`); if (!ok) f++; };
const ADRESSE = 'http://127.0.0.1:8099/index.html';

async function neu(browser, fehler, regeln) {
  const seite = await (await browser.newContext({ viewport: { width: 390, height: 1000 } })).newPage();
  seite.on('pageerror', e => fehler.push(e.message));
  await seite.exposeFunction('scheinBeacon', r => schein.beacon(r));
  await seite.context().addInitScript(([info, regeln]) => {
    document.addEventListener('DOMContentLoaded', () => {
      Tresor.drand.testKette(info, r => window.scheinBeacon(r));
      if (regeln) { Tresor.tresorLogik.ESCAPE.regeln = regeln; Tresor.tresorLogik.ESCAPE.hinweisChance = 1; }
    });
  }, [schein.info, regeln || null]);
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
    const L = Tresor.tresorLogik, M = Tresor.marken, K = Tresor.krypto;
    const posten = ['Keller', 'Bad', 'Flur', 'Küche'].map(name => ({ name, code: M.neuerCode() }));
    const k = L.escapeKonfiguration({ minSekunden: 1000, maxSekunden: 5000 });
    k.kette = await L.ketteVorbereiten(posten);
    const t = await L.erstellen({ art: 'zahl', teile: ['48271'], konfig: k });
    const fr = t.freigabe, kt = fr.kette, e = {};
    e.anfang = { laenge: kt.laenge, stand: kt.stand, runde: kt.runde, regel: !!kt.regel, ziel: fr.konto.zielSek, oben: fr.leiter[fr.leiter.length - 1] };
    e.ohneCode = !posten.some(p => JSON.stringify(t).includes(p.code));
    // Reihenfolge aus den Pruefwerten zurueckrechnen (das kann nur, wer die Codes hat)
    const folge = [];
    for (let i = 0; i < 4; i++) for (const p of posten) if (k.kette.pos[i] === await K.pruefwert('tresor-kette:' + i + ':' + p.code)) folge.push(p);
    e.folgeVollstaendig = new Set(folge).size === 4;
    const falsch = posten.find(p => p !== folge[1] && p !== folge[0]);
    const jetzt = Date.now();
    const r1 = await L.ketteScan(t, folge[0].code, jetzt);
    e.erster = r1.richtig && r1.stand === 1;
    e.doppelt = (await L.ketteScan(t, folge[0].code, jetzt + 2000)).doppelt === true;
    e.fremd = await L.ketteScan(t, M.neuerCode(), jetzt);
    kt.regel = 'sperre';
    const r2 = await L.ketteScan(t, falsch.code, jetzt + 20000);
    e.sperre = { falsch: r2.falsch, regel: r2.regel, min: Math.round((r2.bis - jetzt - 20000) / 60000), stand: kt.stand, runde: kt.runde };
    e.gesperrt = (await L.ketteScan(t, folge[1].code, jetzt + 60000)).gesperrt === true;
    kt.regel = 'sperre';
    const r3 = await L.ketteScan(t, falsch.code, jetzt + 7 * 60000);
    e.sperre2 = Math.round((r3.bis - jetzt - 7 * 60000) / 60000);
    kt.sperreBis = 0;
    kt.regel = 'strafe';
    const r4 = await L.ketteScan(t, falsch.code, jetzt + 30 * 60000);
    e.strafe = { s: r4.sekunden, summe: kt.strafeSek, stand: kt.stand };
    kt.regel = 'neustart';
    await L.ketteScan(t, falsch.code, jetzt + 31 * 60000);
    e.neustart = { stand: kt.stand, gefunden: kt.gefunden.length };
    kt.regel = 'gnade';
    let letzte;
    for (let i = 0; i < 4; i++) letzte = await L.ketteScan(t, folge[i].code, jetzt + (40 + i) * 60000);
    e.geloest = { geloest: letzte.geloest, ziel: fr.konto.zielSek };
    e.danach = (await L.ketteScan(t, folge[0].code, jetzt + 50 * 60000)).schon === true;
    e.bewegungen = L.neueBewegungen(t, 0).map(b => b.art + (b.art === 'posten' ? (b.richtig ? '+' : '-' + b.regel) : '')).join(' ');

    // Koeder und Hinweise: sechs Posten, Hinweis nach jedem Fehler
    L.ESCAPE.hinweisChance = 1;
    const namen = ['Keller', 'Bad', 'Flur', 'Küche', 'Garten', 'Dach'];
    const p6 = namen.map(name => ({ name, code: M.neuerCode() }));
    const k6 = L.escapeKonfiguration({ minSekunden: 1000, maxSekunden: 5000 }, { koeder: true });
    k6.kette = await L.ketteVorbereiten(p6, k6);
    const t6 = await L.erstellen({ art: 'zahl', teile: ['1'], konfig: k6 });
    const kd = k6.kette, k6s = t6.freigabe.kette;
    e.koeder = { laenge: kd.pos.length, verborgen: kd.verborgen, hinweise: kd.hinweise.length,
      lesbar: /kommt vor|kommt direkt|Hälfte|gehört nicht|gehören zur|nicht der/.test(JSON.stringify(t6)) };
    // Wahrheit pruefen: Stelle jedes Postens aus den Pruefwerten
    const stelle = [];
    for (const p of p6) { let s = -1; for (let i = 0; i < kd.pos.length; i++) if (kd.pos[i] === await K.pruefwert('tresor-kette:' + i + ':' + p.code)) s = i; stelle.push(s); }
    const n = x => namen.indexOf(x);
    const wahr = h => {
      let m;
      if ((m = /^„(.+)“ kommt direkt nach „(.+)“\.$/.exec(h))) return stelle[n(m[1])] === stelle[n(m[2])] + 1 && stelle[n(m[2])] >= 0;
      if ((m = /^„(.+)“ kommt vor „(.+)“\.$/.exec(h))) return stelle[n(m[1])] >= 0 && stelle[n(m[1])] < stelle[n(m[2])];
      if ((m = /^Weder „(.+)“ noch „(.+)“ gehören zur Kette\.$/.exec(h))) return stelle[n(m[1])] < 0 && stelle[n(m[2])] < 0;
      if ((m = /^„(.+)“ gehört nicht zur Kette - „(.+)“ schon\.$/.exec(h))) return stelle[n(m[1])] < 0 && stelle[n(m[2])] >= 0;
      if ((m = /^„(.+)“ ist nicht der erste Posten\.$/.exec(h))) return stelle[n(m[1])] !== 0;
      if ((m = /^„(.+)“ ist nicht der letzte\.$/.exec(h))) return stelle[n(m[1])] !== kd.pos.length - 1;
      if ((m = /^„(.+)“ liegt in der ersten Hälfte\.$/.exec(h))) return stelle[n(m[1])] >= 0 && stelle[n(m[1])] < kd.pos.length / 2;
      if ((m = /^„(.+)“ liegt in der zweiten Hälfte\.$/.exec(h))) return stelle[n(m[1])] >= kd.pos.length / 2;
      return false;
    };
    // Fehler um Fehler - jeweils ein Posten, der an Stelle 0 nicht stimmt
    const falsche = p6.filter((_, i) => stelle[i] !== 0);
    const gezogen = [];
    let zeit = Date.now();
    for (let runde = 0; runde < 12; runde++) {
      const p = falsche[runde % falsche.length];
      k6s.regel = 'gnade'; k6s.sperreBis = 0; zeit += 60000;
      const r = await L.ketteScan(t6, p.code, zeit);
      if (runde === 0) e.ersterHinweis = { text: r.hinweis, ueberIhn: !!r.hinweis && r.hinweis.includes('„' + p.name + '“'),
        einzeln: !!r.hinweis && !/kommt|Weder/.test(r.hinweis) };
      if (r.hinweis) gezogen.push(r.hinweis);
    }
    e.hinweise = { anzahl: gezogen.length, alleWahr: gezogen.every(wahr), falsch: gezogen.filter(h => !wahr(h)),
      gespeichert: k6s.hinweise.length, doppelt: new Set(gezogen).size !== gezogen.length, beispiel: gezogen.slice(0, 3) };
    e.verborgen = (await L.ketteScan(t6, p6[stelle.indexOf(0)].code, zeit + 60000)).laenge;
    return e;
  });
  pruefe('Anfang: Uhr auf "sonst", Leiter endet dort', r.anfang.laenge === 4 && r.anfang.stand === 0 && r.anfang.regel && r.anfang.ziel === 5000 && r.anfang.oben === 5000, JSON.stringify(r.anfang));
  pruefe('kein Code im Tresor, Reihenfolge nur mit Codes ablesbar', r.ohneCode && r.folgeVollstaendig, '');
  pruefe('richtiger erster Posten: 1 von 4', r.erster, '');
  pruefe('gleich nochmal gescannt: kein Fehler', r.doppelt, '');
  pruefe('fremder Code: gehoert nicht zur Kette', r.fremd === null, String(r.fremd));
  pruefe('Sperre: 5 min, Stand bleibt, naechste Runde', r.sperre.falsch && r.sperre.min === 5 && r.sperre.stand === 1 && r.sperre.runde === 2, JSON.stringify(r.sperre));
  pruefe('waehrend der Sperre zaehlt nichts', r.gesperrt, '');
  pruefe('zweite Sperre: doppelt so lang', r.sperre2 === 10, r.sperre2 + ' min');
  pruefe('Zeitstrafe: 5 % der Spanne (200 s)', r.strafe.s === 200 && r.strafe.summe === 200 && r.strafe.stand === 1, JSON.stringify(r.strafe));
  pruefe('Neustart: zurueck auf Anfang', r.neustart.stand === 0 && r.neustart.gefunden === 0, JSON.stringify(r.neustart));
  pruefe('geloest: Freigabe auf fruehestens plus Strafen', r.geloest.geloest && r.geloest.ziel === 1200, JSON.stringify(r.geloest));
  pruefe('danach: schon geloest', r.danach, '');
  pruefe('Koeder: Kette kuerzer, Laenge verborgen, Hinweise verschluesselt', r.koeder.laenge >= 4 && r.koeder.laenge <= 5
    && r.koeder.verborgen && r.koeder.hinweise === 21 && !r.koeder.lesbar, JSON.stringify(r.koeder));
  pruefe('erster Fehler: nur ein Hinweis ueber diesen Posten lesbar', r.ersterHinweis.ueberIhn && r.ersterHinweis.einzeln, r.ersterHinweis.text);
  pruefe('alle Hinweise wahr, keiner doppelt', r.hinweise.anzahl >= 8 && r.hinweise.alleWahr && !r.hinweise.doppelt
    && r.hinweise.gespeichert === r.hinweise.anzahl, JSON.stringify(r.hinweise));
  pruefe('mit Koedern: "x von y" bleibt verborgen', r.verborgen === null, String(r.verborgen));
  pruefe('Bewegungen fuer den Rueckkanal', r.bewegungen === 'posten+ posten-sperre posten-sperre posten-strafe posten-neustart posten+ posten+ posten+ posten+ kette', r.bewegungen);
  await s0.context().close();

  console.log('\nOberflaeche');
  const s1 = await neu(browser, fehler, [['gnade', 1]]);
  const felder = await s1.$$('#ziffernfelder .zifferfeld');
  for (let i = 0; i < felder.length; i++) { await felder[i].click(); await felder[i].type('48271'[i]); }
  await s1.click('#spielart-escape');
  await s1.evaluate(() => { for (const [id, v] of [['#escape-min', 15], ['#escape-max', 3600]]) { const s = document.querySelector(id);
    const o = document.createElement('option'); o.value = String(v); o.textContent = v + ' s'; s.appendChild(o); s.value = String(v); s.dispatchEvent(new Event('change')); } });
  const sicht = await s1.evaluate(() => ({ escape: !document.querySelector('#escapekarte').classList.contains('versteckt'),
    passiv: document.querySelector('#passivkarte').classList.contains('versteckt'),
    dim: !!document.querySelector('.dimension-gitter').closest('.versteckt') }));
  pruefe('Escape: Kette sichtbar, Passiv und Pruefungen weg', sicht.escape && sicht.passiv && sicht.dim, JSON.stringify(sicht));
  for (const name of ['Keller', 'Bad']) {
    await s1.click('#escapekarte button:text-is("Posten hinzufügen")');
    const z = await s1.$$('#escapekarte .marken-zeile');
    await (await z[z.length - 1].$('input[type=text]')).fill(name);
  }
  pruefe('zwei Posten: noch nicht verriegelbar', await s1.$eval('#verriegeln', b => b.disabled), await s1.textContent('#bereit-hinweis'));
  await s1.click('#escapekarte button:text-is("Posten hinzufügen")');
  await (await (await s1.$$('#escapekarte .marken-zeile'))[2].$('input[type=text]')).fill('Flur');
  const hinweis = await s1.textContent('#escape-hinweis');
  pruefe('drei Posten: verriegelbar, 6 Reihenfolgen angesagt', !(await s1.$eval('#verriegeln', b => b.disabled)) && /3 Posten - 6 mögliche/.test(hinweis), hinweis);
  const links = await s1.$$eval('#escapekarte .marken-qr', els => els.map(e => e.dataset.link));
  await s1.screenshot({ path: AUSGABE + '/schuss-escape-einrichten.png', fullPage: true });
  await s1.click('#verriegeln');
  await s1.waitForSelector('#escapekarte-tresor', { timeout: 60000 });
  pruefe('Tresor: Runde 1 mit angesagter Regel', /Runde 1/.test(await s1.textContent('#escapekarte-tresor'))
    && /Diese Runde: Ein Fehler kostet nichts/.test(await s1.textContent('#escapekarte-tresor')), '');
  const folge = await s1.evaluate(async links => {
    const t = JSON.parse(localStorage.getItem('tresor.v1'));
    const out = [];
    for (let i = 0; i < t.konfig.kette.pos.length; i++) for (const l of links) {
      const code = l.split('=')[1];
      if (t.konfig.kette.pos[i] === await Tresor.krypto.pruefwert('tresor-kette:' + i + ':' + code)) out.push(l);
    }
    return out;
  }, links);
  await s1.goto(folge[0]);
  await s1.waitForSelector('#escapekarte-tresor .gutkasten', { timeout: 15000 });
  pruefe('erster Posten per Link: richtig, 1 von 3', /1 von 3/.test(await s1.textContent('#escapekarte-tresor .gutkasten')), await s1.textContent('#escapekarte-tresor .gutkasten'));
  await s1.goto(folge[2]);
  await s1.waitForSelector('#escapekarte-tresor .strafkasten', { timeout: 15000 });
  const falsch = await s1.textContent('#escapekarte-tresor .strafkasten');
  pruefe('falscher Posten: Runde vorbei, Gnade', /Diesmal kostet es nichts/.test(falsch) && /Runde 2/.test(await s1.textContent('#escapekarte-tresor')), falsch);
  pruefe('mit Hinweis, und unter "Was du weißt"', /Ein Hinweis: „/.test(falsch) && !!(await s1.$('#escapekarte-tresor .escape-wissen li')),
    await s1.textContent('#escapekarte-tresor .escape-neuer-hinweis').catch(() => '-'));
  await s1.screenshot({ path: AUSGABE + '/schuss-escape.png', fullPage: true });
  await s1.goto(folge[1]);
  await s1.waitForSelector('#escapekarte-tresor .gutkasten', { timeout: 15000 });
  await s1.goto(folge[2]);
  await s1.waitForSelector('.grossezahl, #escapekarte-tresor h2', { timeout: 15000 });
  const t2 = await gespeichert(s1);
  pruefe('Kette geschlossen: Freigabe auf fruehestens', t2.freigabe.kette.geloest && t2.freigabe.konto.zielSek === 15, String(t2.freigabe.konto.zielSek));
  await s1.waitForSelector('.grossezahl', { timeout: 40000 });
  pruefe('und auf: das Geheimnis am Stueck', (await s1.textContent('.grossezahl')) === '48271', await s1.textContent('.grossezahl'));
  await s1.context().close();

  pruefe('keine Seitenfehler', !fehler.length, fehler.join(' | ') || '-');
  console.log(f ? `\nFEHLGESCHLAGEN: ${f}` : '\nAlles gruen.');
  await browser.close(); process.exit(f ? 1 : 0);
})();
