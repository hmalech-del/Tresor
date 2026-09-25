// Der ganze Weg ueber die Oberflaeche: einrichten, verriegeln, scheitern,
// wuerfeln, bestehen, beim Netz abholen, Notausgang. Gegen eine
// Schein-Kette mit einer Sekunde je Runde.
const { chromium } = require('./playwright.js');
const AUSGABE = require('path').join(__dirname, 'schuesse');
const schein = require('./scheinkette.js').neu({ period: 1, genesisSek: Math.floor(Date.now() / 1000) - 5000 });
let f = 0;
const pruefe = (n, ok, t) => { console.log(`  [${ok ? 'ok  ' : 'FEHL'}] ${n.padEnd(50)} ${t}`); if (!ok) f++; };
const warte = ms => new Promise(r => setTimeout(r, ms));

async function vorbereiten(seite) {
  await seite.exposeFunction('scheinBeacon', r => schein.beacon(r));
  await seite.goto('http://127.0.0.1:8099/index.html');
  await seite.waitForSelector('#ziffernfelder .zifferfeld');
  await seite.evaluate(info => {
    Tresor.drand.testKette(info, r => window.netzAus ? Promise.reject(Object.assign(new Error('offline'), { art: 'netz' })) : window.scheinBeacon(r));
    /* Eine Pruefaufgabe, die man gezielt bestehen oder verhauen kann - damit
     * laeuft fehlschlag() in app.js wirklich durch, nicht ein Nachbau. */
    Tresor.herausforderungen.registrieren({
      id: 'probe-knopf', dimension: 'geduld', name: 'Probeknopf', kurz: 'Test',
      erzeuge: () => ({}), schaetzung: () => 10, beschreibe: () => 'Knopf',
      starte: k => {
        const b1 = document.createElement('button'); b1.id = 't-scheitern'; b1.textContent = 'scheitern';
        const b2 = document.createElement('button'); b2.id = 't-bestehen'; b2.textContent = 'bestehen';
        b1.onclick = () => k.fehlschlag('Probe verhauen.'); b2.onclick = () => k.fertig();
        k.wurzel.append(b1, b2);
      }
    });
    // Ausschlag fest und Wurf immer angeboten - sonst waere der Test ein Gluecksspiel
    Tresor.tresorLogik.AUSSCHLAG.normal.stufen = [[1, 1, 1]];
    Tresor.tresorLogik.AUSSCHLAG.normal.angebot = 1;
    const alt = Tresor.herausforderungen.nachDimension;
    Tresor.herausforderungen.nachDimension = d => d === 'geduld' ? [Tresor.herausforderungen.hole('probe-knopf')] : alt(d);
  }, schein.info);
}

async function einrichten(seite, { tz, exit, strafe = '2', gluecksspiel = true }) {
  const felder = await seite.$$('#ziffernfelder .zifferfeld');
  for (let i = 0; i < felder.length; i++) { await felder[i].click(); await felder[i].type('48271'[i]); }
  await seite.$$eval('.dimension-karte input[type=checkbox]', els => els.forEach(e => {
    if (!e.disabled) { e.checked = e.value === 'geduld'; e.dispatchEvent(new Event('change', { bubbles: true })); } }));
  await seite.$eval('#aufgaben-pro-fragment', e => { e.value = '1'; e.dispatchEvent(new Event('input')); });
  await seite.selectOption('#sicherheit', 'drand');
  await seite.selectOption('#strafzeit', strafe);
  await seite.$eval('#gluecksspiel', (e, an) => { e.checked = an; e.dispatchEvent(new Event('change')); }, gluecksspiel);
  await seite.evaluate(({ tz, exit }) => {
    const setze = (id, wert) => { const s = document.querySelector(id); const o = document.createElement('option');
      o.value = String(wert); o.dataset.sekunden = String(wert); o.textContent = wert + ' s'; s.appendChild(o); s.value = String(wert);
      s.dispatchEvent(new Event('change')); };
    setze('#tresorzeit-min', tz[0]); setze('#tresorzeit-max', tz[1]);
    if (exit) { document.querySelector('#notausgang-modus').value = 'fest'; setze('#notausgang-dauer', exit); }
    else { const m = document.querySelector('#notausgang-modus'); m.value = 'aus'; m.dispatchEvent(new Event('change')); }
  }, { tz, exit });
  await seite.click('#verriegeln');
  await seite.waitForSelector('.freigabe-karte', { timeout: 60000 });
}

const lies = seite => seite.evaluate(() => {
  const t = JSON.parse(localStorage.getItem('tresor.v1'));
  const k = document.querySelector('.freigabe-karte');
  return {
    uhr: k && k.querySelector('.countdown').textContent,
    wann: k && k.querySelector('.countdown + p').textContent,
    ziel: Tresor.tresorLogik.freigabeZiel(t) && Tresor.tresorLogik.freigabeZiel(t).zeit,
    strafe: !!document.querySelector('.strafkasten'),
    strafText: (document.querySelector('.strafkasten') || {}).textContent || '',
    wuerfel: !!document.querySelector('.strafkasten .wuerfelbox'),
    band: document.querySelector('.band-karte').textContent,
    status: (document.querySelector('.aufgaben-buehne') || {}).textContent || '',
    z: t.freigabe && t.freigabe.z,
    offen: t.fragmente.filter(x => x.offen).length
  };
});

(async () => {
  const browser = await chromium.launch();
  const fehler = [];
  const neueSeite = async () => { const s = await (await browser.newContext({ viewport: { width: 400, height: 1000 } })).newPage();
    s.on('pageerror', e => fehler.push(e.message)); return s; };

  console.log('Einrichten und verriegeln');
  const seite = await neueSeite();
  await vorbereiten(seite);
  await einrichten(seite, { tz: [20, 40], exit: 90 });
  let l = await lies(seite);
  pruefe('Freigabe-Uhr laeuft', /^00:\d\d$/.test(l.uhr), l.uhr);
  pruefe('nennt den Zeitpunkt', /^Offen heute/.test(l.wann), l.wann);
  const rahmen = (await seite.textContent('.freigabe-karte')).replace(/\s+/g, ' ');
  pruefe('nennt bestenfalls und spaetestens', /Bestenfalls heute .* spätestens heute .*\(Notausgang\)/.test(rahmen), '');
  pruefe('Kopf nennt Pruefung und Gutschrift', /Prüfung 1 von 5/.test(await seite.textContent('.aufgaben-kopf'))
    && /holt ~4 s/.test(await seite.textContent('.aufgaben-kopf')), (await seite.textContent('.aufgaben-kopf')).replace(/\s+/g, ' '));
  const notausgang = (await seite.textContent('.notausgang-karte')).replace(/\s+/g, ' ');
  pruefe('Notausgang am Netz: genau 1 min 30 s, Uhr, Termin', /Genau 1 min 30 s\./.test(notausgang) && /noch:/.test(notausgang) && /Offen ab/.test(notausgang), notausgang.slice(0, 90));
  await seite.screenshot({ path: AUSGABE + '/schuss-drand-tresor.png' });

  console.log('\nScheitern');
  const vorher = l.ziel;
  await seite.click('#t-scheitern');
  await seite.waitForSelector('.strafkasten');
  l = await lies(seite);
  pruefe('Strafe erscheint in der Freigabe-Karte', l.strafe && /Probe verhauen\. Fehlversuch 1\. \+\d+ s/.test(l.strafText), l.strafText.replace(/\s+/g, ' ').slice(0, 90));
  pruefe('Freigabe rueckt nach hinten', l.ziel > vorher, `+${Math.round((l.ziel - vorher) / 1000)} s`);
  pruefe('Aufgabe ist nicht gesperrt, sondern neu', /scheitern/.test(l.status), l.status.slice(0, 40));
  pruefe('Wuerfel wird angeboten, mit Strafregel', l.wuerfel && /diese Strafe fällt weg/.test(l.strafText), '');
  await seite.screenshot({ path: AUSGABE + '/schuss-drand-strafe.png' });

  console.log('\nWuerfeln');
  const vorWurf = l.ziel;
  await seite.click('.strafkasten .wuerfelbox button');
  await seite.waitForSelector('.wuerfel.ist-gewonnen, .wuerfel.ist-verloren', { timeout: 5000 });
  const gewonnen = await seite.$('.wuerfel.ist-gewonnen') !== null;
  l = await lies(seite);
  const d = Math.round((l.ziel - vorWurf) / 1000);
  pruefe('Wurf wirkt auf die Freigabe', gewonnen ? d < 0 : d >= 0, (gewonnen ? 'gewonnen: ' : 'verloren: ') + (d >= 0 ? '+' : '') + d + ' s');
  const nochmal = await seite.$eval('.strafkasten .wuerfelbox button', b => b.disabled);
  pruefe('nur ein Wurf', nochmal, 'Knopf gesperrt');
  await seite.click('.strafkasten button.knopf:not(.wuerfelbox button)');
  pruefe('Strafe laesst sich wegklicken', !(await seite.$('.strafkasten')), '');

  console.log('\nBestehen');
  const vorGut = (await lies(seite)).ziel;
  await seite.click('#t-bestehen');
  await seite.waitForSelector('.gutkasten');
  const gut = (await seite.textContent('.gutkasten')).replace(/\s+/g, ' ');
  const nachGut = (await lies(seite)).ziel;
  pruefe('Gutschrift erscheint', /Gutschrift.*−4 s\./.test(gut), gut.slice(0, 80));
  pruefe('Freigabe rueckt nach vorn', nachGut < vorGut, `${Math.round((nachGut - vorGut) / 1000)} s`);
  pruefe('Wurf auf die Gutschrift wird angeboten', /die Gutschrift verdoppelt sich/.test(gut), '');
  const vorGutWurf = (await lies(seite)).ziel;
  await seite.click('.gutkasten .wuerfelbox button');
  await seite.waitForSelector('.gutkasten .wuerfel.ist-gewonnen, .gutkasten .wuerfel.ist-verloren', { timeout: 5000 });
  const gutGewonnen = await seite.$('.gutkasten .wuerfel.ist-gewonnen') !== null;
  const nachGutWurf = (await lies(seite)).ziel;
  const dg = Math.round((nachGutWurf - vorGutWurf) / 1000);
  pruefe('Gutschrift-Wurf wirkt', gutGewonnen ? dg <= 0 : dg >= 0, (gutGewonnen ? 'gewonnen: ' : 'verloren: ') + dg + ' s');
  await seite.click('.gutkasten > button.knopf');
  const naechste = await seite.textContent('.aufgaben-kopf');
  pruefe('naechste Pruefung sofort, aus Fragment 2', /Prüfung 2 von 5/.test(naechste), naechste.replace(/\s+/g, ' '));
  for (let i = 0; i < 6; i++) {
    if (!(await seite.$('#t-bestehen'))) break;
    await seite.click('#t-bestehen');
    await warte(200);
  }
  l = await lies(seite);
  pruefe('alle abgelegt: jetzt haelt ihn nur noch die Zeit', /nur noch die Zeit/.test(l.status) && l.offen === 0, l.status.slice(0, 60));
  const plan = (await seite.textContent('.fragmentliste')).replace(/\s+/g, ' ');
  pruefe('Fahrplan: abgelegt, nicht "verriegelt"', /abgelegt, wartet auf die Zeit/.test(plan) && !/verriegelt/.test(plan), '');
  const bis = Math.max(0, l.ziel - Date.now());
  pruefe('Freigabe-Uhr zaehlt weiter, waehrend das Fragment wartet', /^00:\d\d$/.test(l.uhr), l.uhr);
  await warte(bis + 2500);
  // Das erste Fragment holt Z beim Netz; danach geht jedes sofort auf, sobald seine Aufgabe erledigt ist.
  const ende = Date.now() + 20000; let abgeholt = 0;
  while (Date.now() < ende && !(await seite.$('.grossezahl'))) {
    if (await seite.$('#t-bestehen')) { await seite.click('#t-bestehen'); abgeholt++; }
    await warte(300);
  }
  const zahl = await seite.textContent('.grossezahl').catch(() => '');
  pruefe('nach der Zeit: beim Netz abgeholt, ganze Zahl frei', zahl === '48271', zahl);

  console.log('\nTakt (gestaucht: ab 10 s Rahmen, alle 4 s eine Pruefung)');
  const s3 = await neueSeite();
  await vorbereiten(s3);
  await s3.evaluate(() => { Tresor.tresorLogik.TAKT.ab = 10; Tresor.tresorLogik.TAKT.fensterMin = 3; });
  await einrichten(s3, { tz: [20, 40], exit: 90, strafe: '0', gluecksspiel: false });
  const k1 = (await s3.textContent('.aufgaben-kopf')).replace(/\s+/g, ' ');
  pruefe('Kopf nennt die Puenktlichkeitsgrenze', /Prüfung 1 von 5.*holt ~4 s · pünktlich bis heute/.test(k1), k1);
  await s3.click('#t-bestehen');
  await s3.waitForSelector('.aufgaben-buehne .countdown');
  const warten = (await s3.textContent('.aufgaben-buehne')).replace(/\s+/g, ' ');
  pruefe('danach: die naechste Pruefung kommt erst', /Die nächste Prüfung kommt/.test(warten) && /Ab heute/.test(warten), warten.slice(0, 70));
  const plan3 = (await s3.textContent('.fragmentliste')).replace(/\s+/g, ' ');
  pruefe('Fahrplan zeigt, ab wann', (plan3.match(/kommt heute/g) || []).length === 4, (plan3.match(/kommt heute/g) || []).length + '× "kommt"');
  await s3.waitForSelector('#t-bestehen', { timeout: 8000 }).catch(() => {});
  const k2 = (await s3.textContent('.aufgaben-kopf')).replace(/\s+/g, ' ');
  pruefe('nach dem Takt kommt Pruefung 2 von selbst', /Prüfung 2 von 5/.test(k2), k2);

  console.log('\nOhne Netz (echte drand-Zugaenge, aus der Sandbox gesperrt)');
  const s2 = await neueSeite();
  await vorbereiten(s2);
  await einrichten(s2, { tz: [5, 5], exit: 0, strafe: '0' });
  for (let i = 0; i < 5; i++) { await s2.waitForSelector('#t-bestehen'); await s2.click('#t-bestehen'); await warte(150); }
  // Ab jetzt die echte Kette: Die Zugaenge sind hier gesperrt - genau wie ohne Internet.
  await s2.evaluate(() => Tresor.drand.testKette(null, null));
  await s2.waitForFunction(() => /Das Netz antwortet nicht/.test((document.querySelector('.aufgaben-buehne') || {}).textContent || ''), null, { timeout: 40000 }).catch(() => {});
  const offline = (await s2.textContent('.aufgaben-buehne')).replace(/\s+/g, ' ');
  pruefe('ohne Netz: klare Meldung', /Das Netz antwortet nicht/.test(offline), offline.slice(offline.indexOf('Beim'), offline.indexOf('Beim') + 90));
  const knopfFrei = await s2.$eval('.aufgaben-buehne .knopf.haupt', b => !b.disabled);
  pruefe('Knopf fuer den naechsten Versuch ist frei', knopfFrei, '');
  const zu = await s2.evaluate(() => JSON.parse(localStorage.getItem('tresor.v1')).fragmente.filter(x => x.offen).length);
  pruefe('ohne Netz bleibt er zu', zu === 0, zu + ' offen');
  await s2.screenshot({ path: AUSGABE + '/schuss-drand-offline.png' });

  pruefe('keine Seitenfehler', !fehler.length, fehler.join(' | ') || '-');
  console.log(f ? `\nFEHLGESCHLAGEN: ${f}` : '\nAlles gruen.');
  await browser.close(); process.exit(f ? 1 : 0);
})();
