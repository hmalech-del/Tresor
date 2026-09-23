/* Tresorbox - eine druckbare Kiste, die ein Servo verriegelt.
 *
 * Alle Masse in Millimetern. Gedruckt werden drei Teile: Koerper, Deckel,
 * Riegel. Dazu gekauft: ein ESP32-C3, ein SG90-Servo, ein Kondensator.
 *
 * So haelt der Verschluss:
 *   Am Deckel haengt eine Zunge nach unten - ein flaches Blatt, quer zur
 *   Fahrtrichtung des Riegels. Sie faellt in einen Schlitz im Koerper. Quer
 *   durch diesen Schlitz laeuft die Riegelbohrung. Faehrt der Riegel aus,
 *   steckt er durch das Loch in der Zunge, und der Deckel sitzt fest.
 *
 *   Die Zunge steht quer, nicht laengs. Laege sie in der Fahrtrichtung,
 *   liefe der Riegel an ihr vorbei statt hindurch.
 *
 * Warum das Servo nichts haelt:
 *   Zieht jemand am Deckel, drueckt die Zunge gegen den Riegel und der gegen
 *   die Wand seiner Bohrung. Die Kraft laeuft in den Koerper, nicht ins
 *   Getriebe. Das Servo schiebt den Riegel nur laengs, ueber einen Stift in
 *   einem Querschlitz (Kurbelschleife). Diese Bauart vertraegt Toleranzen -
 *   genau das braucht man bei gedruckten Teilen.
 *
 * Rendern:
 *   openscad -D 'teil="koerper"' -o koerper.stl tresorbox.scad
 *   openscad -D 'teil="deckel"'  -o deckel.stl  tresorbox.scad
 *   openscad -D 'teil="riegel"'  -o riegel.stl  tresorbox.scad
 */

teil = "alles";              // koerper | deckel | riegel | alles
zustand = "zu";              // fuer die Ansicht: zu | offen
$fn = 48;

/* ---------- Was hinein soll ---------- */
innen_x = 120;               // Breite des Innenraums
innen_y = 80;                // Tiefe
innen_z = 45;                // Hoehe
/* Handy flach hinlegen: innen_x = 165, innen_y = 85, innen_z = 30.
   Das ist ein langer Druck - fang mit der kleinen Kiste an. */

/* ---------- Druck ---------- */
wand    = 3;
boden   = 3;
rand_h  = 6;                 // wie tief der Deckelrand in die Kiste faellt
spiel   = 0.35;              // Spiel beweglicher Passungen.
                             // Zu stramm? auf 0.45. Zu wackelig? auf 0.25.

/* ---------- Verschluss ---------- */
zunge_b    = 24;             // Zunge: Breite quer zum Riegel (Y)
zunge_d    = 6;              // Zunge: Dicke in Fahrtrichtung (X)
zunge_l    = 30;             // wie weit sie unter den Deckel reicht.
                             // Muss deutlich unter das Riegelloch reichen -
                             // bei 24 blieben darunter 2,6 mm stehen, und
                             // die waeren abgebrochen.
riegel_b   = 14;             // Riegel: Breite (Y)
riegel_h   = 8;              // Riegel: Hoehe (Z)
riegel_l   = 40;             // Riegel: Laenge (X)

/* ---------- Servo SG90 ---------- */
servo_x = 23.2;
servo_y = 12.4;
servo_z = 23;
servo_flansch_x = 32.5;
servo_achse_versatz = 5.9;   // Achse vom Rand des Rumpfs
stift_radius = 9;            // Lochabstand im Servohorn
stift_d = 3;                 // M3-Schraube als Mitnehmer
schwenk = 45;                // Servoausschlag in beide Richtungen

/* Der Hub ergibt sich aus der Kurbel, nicht umgekehrt. */
riegel_weg = 2 * stift_radius * sin(schwenk);   // 12,7 mm

/* ---------- Elektronik ---------- */
kabel_d   = 6.5;
platine_x = 24;              // ESP32-C3 Supermini
platine_y = 19;

aussen_x = innen_x + 2 * wand;
aussen_y = innen_y + 2 * wand;
aussen_z = innen_z + boden;

/* ---------- Lage des Verschlusses ---------- */
block_y   = 38;              // Tiefe des Blocks: Zunge plus Servorumpf
block_b   = 96;
riegel_z  = 28;              // Hoehe der Riegelachse ueber dem Boden
zunge_y   = 20;              // Mitte der Zunge, von der Innenwand aus

/* Zwei Bedingungen bestimmen die Servoachse.
 *
 * Kinematik: Der Stift sitzt 9 mm von der Achse und schwenkt +-45 Grad. Sein
 * Abstand zur Achse in y schwankt dabei zwischen 6,4 und 9 mm - die Achse
 * liegt also 7,7 mm vor der Riegelmitte, dann bleibt er im Querschlitz.
 *
 * Platz: Der Rumpf ist 12,4 mm tief. Beim ersten Entwurf lag die Zunge 9 mm
 * hinter der Wand, die Achse damit bei 1,3 - die Tasche brach durch die
 * Vorderwand. Deshalb sitzt die Zunge 20 mm tief. */
servo_achse_x = -30;
servo_achse_y = zunge_y - (stift_radius * (1 + cos(schwenk)) / 2);
servo_oben    = riegel_z + 3;   // Oberkante Servo: das Horn liegt knapp
                                // ueber dem Querschlitz des Riegels

/* Wo die Riegelspitze steht, wenn zu.
 *
 * Der Hub ist durch die Kurbel festgelegt (12,7 mm), also bestimmt diese eine
 * Zahl beide Endlagen. Sie muss zwei Bedingungen erfuellen: verriegelt ganz
 * durch die Zunge hindurch, offen sicher davor. Beim ersten Entwurf stand
 * hier zunge_d/2 + 7 - dann blieben offen 0,3 mm Luft vor der Zunge, und der
 * Deckel waere nicht abgegangen. */
riegel_spitze_zu = zunge_d / 2 + 3.5;
schlitz_von_links = riegel_l - (riegel_spitze_zu - servo_achse_x) + stift_radius * sin(schwenk);

module koerper() {
  /* Reihenfolge ist hier alles: erst die Huelle aushoehlen, DANN den Block
   * hineinstellen, dann die Aussparungen abziehen. Zieht man den Innenraum
   * von Huelle und Block gemeinsam ab, verschwindet der Block mit - er steht
   * ja genau darin. Beim ersten Entwurf kam die Kiste leer aus dem Renderer. */
  difference() {
    union() {
      difference() {
        translate([-aussen_x/2, 0, 0]) cube([aussen_x, aussen_y, aussen_z]);
        translate([-innen_x/2, wand, boden]) cube([innen_x, innen_y, innen_z + 1]);
      }
      // 2 mm unter dem Deckelrand bleiben, sonst setzt der Deckel auf dem
      // Block auf statt auf den Waenden
      translate([-block_b/2, wand, boden]) cube([block_b, block_y, innen_z - rand_h - 2]);
    }

    // Schlitz fuer die Zunge, nach oben offen
    translate([-(zunge_d + 2*spiel)/2, wand + zunge_y - (zunge_b + 2*spiel)/2,
               boden + innen_z - zunge_l - 3])
      cube([zunge_d + 2*spiel, zunge_b + 2*spiel, zunge_l + 12]);

    // Riegelbohrung, quer durch den Zungenschlitz. Links offen, damit sich
    // der Riegel von innen einschieben laesst.
    translate([-block_b/2 - 1, wand + zunge_y - (riegel_b + 2*spiel)/2,
               boden + riegel_z - (riegel_h + 2*spiel)/2])
      cube([block_b/2 + riegel_spitze_zu + 4, riegel_b + 2*spiel, riegel_h + 2*spiel]);

    // Servotasche, nach oben offen
    translate([servo_achse_x - servo_achse_versatz - spiel,
               wand + servo_achse_y - servo_y/2 - spiel, boden + servo_oben - servo_z])
      cube([servo_x + 2*spiel, servo_y + 2*spiel, servo_z + 30]);

    // Freiraum fuer Horn und Stift
    translate([servo_achse_x, wand + servo_achse_y, boden + riegel_z - riegel_h/2 - 1])
      cylinder(r = stift_radius + 4, h = 30);

    // Auflage fuer die Schraubflansche
    for (dx = [-servo_flansch_x/2, servo_flansch_x/2])
      translate([servo_achse_x - servo_achse_versatz + servo_x/2 + dx - 3,
                 wand + servo_achse_y - servo_y/2 - 2, boden + servo_oben - 4.5])
        cube([6, servo_y + 4, 3]);

    // Kabeldurchlass hinten
    translate([aussen_x/2 - 22, aussen_y + 1, boden + 8])
      rotate([90, 0, 0]) cylinder(d = kabel_d, h = wand + 3);

    // Flache Mulde als Bett fuer die Platine
    translate([innen_x/2 - platine_x - 6, wand + innen_y - platine_y - 6, boden - 1])
      cube([platine_x, platine_y, 2]);
  }
}

module deckel() {
  union() {
    translate([-aussen_x/2, 0, 0]) cube([aussen_x, aussen_y, wand]);
    // Rand, faellt in den Innenraum und richtet den Deckel aus
    translate([-innen_x/2 + spiel, wand + spiel, -rand_h])
      difference() {
        cube([innen_x - 2*spiel, innen_y - 2*spiel, rand_h]);
        translate([2.4, 2.4, -1]) cube([innen_x - 2*spiel - 4.8, innen_y - 2*spiel - 4.8, 8]);
      }
    // Zunge quer zur Fahrtrichtung, mit Loch fuer den Riegel
    difference() {
      translate([-zunge_d/2, wand + zunge_y - zunge_b/2, -zunge_l])
        cube([zunge_d, zunge_b, zunge_l]);
      // Das Loch sitzt so tief unter der Deckelunterseite, wie der Riegel
      // unter der Oberkante des Innenraums liegt.
      translate([-zunge_d/2 - 1, wand + zunge_y - (riegel_b + 2*spiel)/2,
                 -(innen_z - riegel_z) - (riegel_h + 2*spiel)/2])
        cube([zunge_d + 2, riegel_b + 2*spiel, riegel_h + 2*spiel]);
    }
  }
}

module riegel() {
  difference() {
    cube([riegel_l, riegel_b, riegel_h], center = true);
    // Querschlitz fuer den Mitnehmerstift
    translate([-riegel_l/2 + schlitz_von_links, 0, 0])
      cube([stift_d + 0.6, 2 * stift_radius * (1 - cos(schwenk)) + stift_d + 3, riegel_h + 2],
           center = true);
    // Fase an der Spitze, damit er leichter einfaedelt
    translate([riegel_l/2, 0, 0]) rotate([0, 45, 0])
      cube([4, riegel_b + 2, 4], center = true);
  }
}

module baugruppe() {
  spitze = (zustand == "zu") ? riegel_spitze_zu : riegel_spitze_zu - riegel_weg;
  koerper();
  color("SteelBlue") translate([0, 0, boden + innen_z]) deckel();
  color("Goldenrod")
    translate([spitze - riegel_l/2, wand + zunge_y, boden + riegel_z]) riegel();
}

/* Nur der Verschluss, ohne Kistenwaende - zur Kontrolle der Bewegung. */
module mechanik() {
  spitze = (zustand == "zu") ? riegel_spitze_zu : riegel_spitze_zu - riegel_weg;
  intersection() {
    koerper();
    translate([-block_b/2 - 1, 0, boden + 8]) cube([block_b + 2, block_y + wand, innen_z]);
  }
  color("SteelBlue")
    translate([-zunge_d/2, wand + zunge_y - zunge_b/2, boden + innen_z - zunge_l])
      difference() {
        cube([zunge_d, zunge_b, zunge_l]);
        translate([-1, zunge_b/2 - (riegel_b + 2*spiel)/2, zunge_l - (innen_z - riegel_z) - (riegel_h + 2*spiel)/2])
          cube([zunge_d + 2, riegel_b + 2*spiel, riegel_h + 2*spiel]);
      }
  color("Crimson")
    translate([spitze - riegel_l/2, wand + zunge_y, boden + riegel_z]) riegel();
  // Servoachse und Stift als Marken
  color("DimGray") translate([servo_achse_x, wand + servo_achse_y, boden + riegel_z - 6])
    cylinder(d = 4, h = 24);
  color("Lime") translate([servo_achse_x + stift_radius * sin(zustand == "zu" ? schwenk : -schwenk),
                           wand + servo_achse_y + stift_radius * cos(schwenk),
                           boden + riegel_z - riegel_h/2])
    cylinder(d = stift_d, h = riegel_h);
}

if (teil == "mechanik") mechanik();
else if (teil == "koerper") koerper();
else if (teil == "deckel") deckel();
else if (teil == "riegel") riegel();
else baugruppe();
