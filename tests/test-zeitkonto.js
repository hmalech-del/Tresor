require('../js/zeitkonto.js');
const Z = globalThis.Tresor.zeitkonto;
let fehler = 0;
function pruefe(name, bedingung, text) {
  console.log(`  [${bedingung ? 'ok  ' : 'FEHL'}] ${name.padEnd(46)} ${text}`);
  if (!bedingung) fehler++;
}
const min = 3600, max = 24*3600;                 // 1 h Tresorzeit, 1 Tag Deckel
const leiter = Z.sekundenLeiter(min, max);

console.log('Leiter');
pruefe('steigt monoton', leiter.every((s,i)=>i===0||s>leiter[i-1]), `${leiter.length} Sprossen`);
pruefe('beginnt bei der Mindestzeit', leiter[0]===min, `${leiter[0]/60} min`);
pruefe('reicht ueber die Hoechstzeit', leiter[leiter.length-1]>=max,
       `oberste ${(leiter[leiter.length-1]/3600).toFixed(2)} h`);
const feinUnten = leiter[1]-leiter[0], grobOben = leiter[leiter.length-1]-leiter[leiter.length-2];
pruefe('unten fein, oben grob', feinUnten===60 && grobOben>=900, `${feinUnten}s unten, ${grobOben}s oben`);

console.log('\nSchrittleiter');
const rate = 116402;                             // Mittelklasse-Handy
const schritte = Z.schritteLeiter(leiter, rate, 250000);
pruefe('keine doppelten Schrittzahlen', new Set(schritte).size===schritte.length,
       `${schritte.length} von ${leiter.length} Sprossen bleiben`);
pruefe('alle auf dem Pruefraster', schritte.every(s=>s%250000===0), '250 000er Raster');
pruefe('unterste entspricht der Mindestzeit', Math.abs(schritte[0]/rate-min)<60,
       `${(schritte[0]/rate/60).toFixed(1)} min statt ${min/60}`);

console.log('\nKonto: Strafen und Gewinne');
let k = new Z.Konto(leiter);
pruefe('startet bei der Mindestzeit', k.zielSekunden()===min, `${k.zielSekunden()/60} min`);
let r = k.verschieben(8*60);
pruefe('Strafe kommt an', r.wirksam===8*60, `+${r.wirksam/60} min -> ${k.zielSekunden()/60} min`);
r = k.verschieben(-5*60);
pruefe('Gewinn kommt an', r.wirksam===-5*60, `${r.wirksam/60} min -> ${k.zielSekunden()/60} min`);

console.log('\nKonto: die beiden Zusagen');
k = new Z.Konto(leiter);
for (let i=0;i<40;i++) k.verschieben(-30*60);
pruefe('kommt nie unter die Mindestzeit', k.zielSekunden()===min,
       `nach 40 Gewinnen immer noch ${k.zielSekunden()/60} min`);
k = new Z.Konto(leiter);
for (let i=0;i<500;i++) k.verschieben(30*60);
pruefe('kommt nie ueber die Hoechstzeit', k.zielSekunden()<=leiter[leiter.length-1],
       `nach 500 Strafen ${(k.zielSekunden()/3600).toFixed(2)} h, Deckel ${(max/3600)} h`);
const letzte = k.verschieben(60*60);
pruefe('am Deckel wirkt keine Strafe mehr', letzte.wirksam===0 && letzte.amDeckel,
       'wirksam 0 - jenseits davon gibt es keinen Schluessel');

console.log('\nKonto: das grobe Raster verschluckt nichts');
k = new Z.Konto(leiter);
k.verschieben(11*3600);                          // hoch ins 900-Sekunden-Raster
const vorher = k.zielSek;
for (let i=0;i<10;i++) k.verschieben(8*60);
pruefe('zehnmal 8 min summieren sich', k.zielSek-vorher===80*60,
       `${(k.zielSek-vorher)/60} min gefordert und gebucht`);
pruefe('die Sprosse folgt grob nach', Math.abs(k.zielSekunden()-k.zielSek)<=450,
       `Wunsch ${(k.zielSek/3600).toFixed(2)} h, Sprosse ${(k.zielSekunden()/3600).toFixed(2)} h`);

console.log('\nKonto: ueberlebt einen Neustart');
k = new Z.Konto(leiter); k.verschieben(37*60);
const wieder = new Z.Konto(leiter, k.stand());
pruefe('Stand kommt zurueck', wieder.zielSekunden()===k.zielSekunden(), `${wieder.zielSekunden()/60} min`);

console.log(fehler ? `\nFEHLGESCHLAGEN: ${fehler}` : '\nAlles gruen.');
process.exit(fehler ? 1 : 0);
