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
/* Der Verschlussblock steht vorn ueber die volle Breite und frisst die
   ersten block_y Millimeter der Tiefe. Nutzbar ist also
   innen_x x (innen_y - block_y) x innen_z; pruefung.py rechnet es aus.

   Handy flach hinlegen: innen_x = 175, innen_y = 125, innen_z = 25.
   In der ersten Fassung stand hier innen_y = 85 - das waren nach Abzug des
   Blocks 47 mm freie Tiefe, und ein Handy ist 75 breit. Es haette nicht
   hineingepasst. Das ist ein langer Druck; fang mit der kleinen Kiste an. */

/* ---------- Druck ---------- */
wand    = 3;
boden   = 3;
rand_h  = 4;                 // wie tief der Deckelrand in die Kiste faellt

/* Spiel - getrennt nach Aufgabe.
 *
 * Erst stand hier ein einziger Wert fuer alles. Das ist der haeufigste
 * Konstruktionsfehler bei gedruckten Mechaniken: Ein Gleitsitz, ein
 * Steckfall, eine Schraubtasche und ein Deckelrand haben nichts miteinander
 * zu tun. Wer den einen Wert anpasst, bis der Riegel laeuft, macht damit den
 * Deckel wacklig.
 *
 * Grundsatz fuer die Ausrichtung: EIN Merkmal fuehrt, alle anderen sind lose.
 * Hier fuehrt die Zunge, denn nur ihre Lage entscheidet, ob der Riegel
 * trifft. Der Deckelrand haelt bloss Staub ab und ist deshalb absichtlich
 * weit - waeren beide stramm, wuerden sie gegeneinander arbeiten, und der
 * Deckel klemmte, sobald der Druck ein Zehntel daneben liegt. */
spiel_riegel = 0.35;         // Gleitsitz: Riegel in seiner Bohrung
spiel_decke  = 0.8;          // zusaetzlich oben - die Bohrungsdecke ist eine
                             // Bruecke und haengt beim Drucken durch
spiel_zunge  = 0.5;          // Steckfall: Zunge in ihren Schlitz (fuehrend)
/* Das Loch in der Zunge braucht in den beiden Achsen verschieden viel.
 *
 * Quer (Y) stapeln sich zwei Lagefehler: Der Riegel darf in seiner Bohrung
 * um 0,35 mm wandern, die Zunge in ihrem Schlitz um 0,5 mm - zusammen 0,85.
 * Weniger Loch, und der Riegel stiesse im ungluecklichen Fall stumpf gegen
 * die Zunge.
 *
 * Hoch (Z) stapelt sich nichts: Der Riegel liegt auf dem Boden seiner
 * Bohrung, der Deckel sitzt auf den Waenden. Beides ist bestimmt. Hier waere
 * viel Spiel sogar schaedlich, denn genau darum wackelt der Deckel spaeter. */
spiel_loch_y = 1.0;          // Riegel durch das Loch der Zunge, quer
spiel_loch_z = 0.5;          // ... und hoch
spiel_loch   = spiel_loch_z; // Rueckfall
spiel_rand   = 0.8;          // Deckelrand - bewusst lose
spiel_servo  = 0.5;          // Servotasche; gehalten wird es von den Schrauben
spiel        = spiel_riegel; // Rueckfall fuer alte Formeln

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
/* Das Loch muss den STECKER durchlassen, nicht das Kabel. Ein USB-C-Stecker
 * misst mit Umspritzung etwa 11 x 7 mm; mit 6,5 mm bekaeme man das Kabel gar
 * nicht erst hinein, denn einfaedeln laesst es sich von keiner Seite. */
kabel_d   = 12;

/* Welche Platine eingebaut wird, entscheidet nur das Bett - nicht die Kiste.
 * Hinter dem Block liegen 120 x 42 mm freier Boden; da passt jedes gaengige
 * ESP32-Board hinein. Waehle hier, wofuer der Sockel gedruckt wird. */
platine = "devkit";          // devkit | supermini
platine_x = (platine == "devkit") ? 55 : 24;   // Laenge, zeigt zur Buchse hin
platine_y = (platine == "devkit") ? 28 : 19;   // Breite

/* Der Sockel hebt die Platine an, damit die USB-Buchse auf Hoehe des
 * Kabellochs liegt. Laege das Board flach auf dem Boden, saesse die Buchse
 * bei etwa 3 mm - das Loch muesste dann in den Boden schneiden. */
sockel_h  = 4;

/* Platz zwischen dem Buchsenende der Platine und der Innenwand. Ein
 * USB-Stecker ist mit Umspritzung etwa 25 mm lang und laesst sich in einem
 * 3 mm duennen Wandloch nicht um die Ecke kippen - er muss also gerade
 * einfahren und braucht die Laenge innen. */
stecker_raum = 28;

/* Lage des Platinensockels: rechts buendig minus Steckerraum, hinten an der
   Rueckwand mit 5 mm Luft. */
platine_x0    = innen_x/2 - stecker_raum - platine_x;
platine_y0    = innen_y - platine_y - 5;
platine_mitte_y = platine_y0 + platine_y/2;
buchse_z      = sockel_h + 3.2;   // Leiterplatte 1,6 + halbe Buchse

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

/* Die Bohrung ist unten knapp und oben weit.
 *
 * Der Riegel liegt durch die Schwerkraft ohnehin auf dem Boden der Bohrung;
 * nur dort braucht es einen Gleitsitz. Die Decke ueberbrueckt 14 mm und sackt
 * beim Drucken um zwei bis drei Zehntel durch - gaebe man ihr dasselbe Spiel,
 * klemmte der Riegel genau in der Mitte seines Weges. */
bohrung_b  = riegel_b + 2 * spiel_riegel;
bohrung_h  = riegel_h + spiel_riegel + spiel_decke;
bohrung_z0 = riegel_z - riegel_h / 2 - spiel_riegel / 2;   // Unterkante

/* Wo die Riegelspitze steht, wenn zu.
 *
 * Der Hub ist durch die Kurbel festgelegt (12,7 mm), also bestimmt diese eine
 * Zahl beide Endlagen. Sie muss zwei Bedingungen erfuellen: verriegelt ganz
 * durch die Zunge hindurch, offen sicher davor. Beim ersten Entwurf stand
 * hier zunge_d/2 + 7 - dann blieben offen 0,3 mm Luft vor der Zunge, und der
 * Deckel waere nicht abgegangen. */
riegel_spitze_zu = zunge_d / 2 + 3.5;
schlitz_von_links = riegel_l - (riegel_spitze_zu - servo_achse_x) + stift_radius * sin(schwenk);

/* ---------- Gemeinsame Aussparungen ----------
 *
 * Bohrung und Zungenschlitz stecken in eigenen Modulen, weil das Pruefstueck
 * sie benutzt. Baute man es aus eigenem Code nach, pruefte es seine eigene
 * Kopie und nicht die Kiste. */

module bohrung_cut(von_x, laenge) {
  union() {
    translate([von_x, wand + zunge_y - bohrung_b/2, boden + bohrung_z0])
      cube([laenge, bohrung_b, bohrung_h]);
    /* Freigang fuer den Mitnehmerstift unter der Bohrung. Ohne ihn muesste
     * die Schraube auf ein Zehntel genau abgelaengt werden: zu kurz greift
     * sie nicht, zu lang schlaegt sie auf dem Boden auf. */
    translate([servo_achse_x - stift_radius * sin(schwenk) - stift_d,
               wand + zunge_y - (stift_d + 2)/2, boden + bohrung_z0 - 3])
      cube([2 * stift_radius * sin(schwenk) + 2 * stift_d, stift_d + 2, 4]);
  }
}

module zungenschlitz_cut() {
  union() {
    translate([-(zunge_d + 2*spiel_zunge)/2, wand + zunge_y - (zunge_b + 2*spiel_zunge)/2,
               boden + innen_z - zunge_l - 3])
      cube([zunge_d + 2*spiel_zunge, zunge_b + 2*spiel_zunge, zunge_l + 12]);
    /* Trichter am Schlitzmund: faengt die Zunge auf, wenn der Deckel schief
     * aufgesetzt wird. */
    translate([0, wand + zunge_y, boden + innen_z - 2])
      hull() {
        translate([0, 0, 2]) cube([zunge_d + 2*spiel_zunge + 5, zunge_b + 2*spiel_zunge + 5, 0.1], center = true);
        cube([zunge_d + 2*spiel_zunge, zunge_b + 2*spiel_zunge, 0.1], center = true);
      }
  }
}

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

      // Sockel fuer die Platine
      translate([platine_x0, wand + platine_y0, boden])
        cube([platine_x, platine_y, sockel_h]);
    }

    zungenschlitz_cut();
    // Links offen, damit sich der Riegel von innen einschieben laesst
    bohrung_cut(-block_b/2 - 1, block_b/2 + riegel_spitze_zu + 4);

    // Servotasche, nach oben offen
    translate([servo_achse_x - servo_achse_versatz - spiel_servo,
               wand + servo_achse_y - servo_y/2 - spiel_servo, boden + servo_oben - servo_z])
      cube([servo_x + 2*spiel_servo, servo_y + 2*spiel_servo, servo_z + 30]);

    // Freiraum fuer Horn und Stift
    translate([servo_achse_x, wand + servo_achse_y, boden + riegel_z - riegel_h/2 - 1])
      cylinder(r = stift_radius + 4, h = 30);

    // Auflage fuer die Schraubflansche
    for (dx = [-servo_flansch_x/2, servo_flansch_x/2])
      translate([servo_achse_x - servo_achse_versatz + servo_x/2 + dx - 3,
                 wand + servo_achse_y - servo_y/2 - 2, boden + servo_oben - 4.5])
        cube([6, servo_y + 4, 3]);

    // Kabeldurchlass in der rechten Wand, auf Hoehe der USB-Buchse und in
    // einer Flucht mit ihr. Vorher sass er in der Rueckwand - der Stecker
    // waere quer zur Buchse angekommen und haette sich nicht einfaedeln
    // lassen.
    translate([innen_x/2 - 1, wand + platine_mitte_y, boden + buchse_z])
      rotate([0, 90, 0]) cylinder(d = kabel_d, h = wand + 3);

    // Kabelbinder-Tunnel quer durch den Sockel
    translate([platine_x0 + platine_x/2 - 1.5, wand + platine_y0 - 1, boden + 1])
      cube([3, platine_y + 2, 2]);
  }
}

module zunge() {
  difference() {
    translate([-zunge_d/2, wand + zunge_y - zunge_b/2, -zunge_l])
      cube([zunge_d, zunge_b, zunge_l]);

    /* Loch fuer den Riegel, mit Trichter auf der Seite, aus der er kommt.
     * Ohne den muesste der Deckel auf ein Zehntel genau sitzen: Haengt er
     * durch Schmutz oder eine dicke erste Schicht zwei Zehntel zu hoch,
     * stiesse der Riegel stumpf gegen die Zunge statt hindurchzugleiten. */
    translate([-zunge_d/2 - 1, wand + zunge_y - (riegel_b + 2*spiel_loch_y)/2,
               -(innen_z - riegel_z) - (riegel_h + 2*spiel_loch_z)/2])
      cube([zunge_d + 2, riegel_b + 2*spiel_loch_y, riegel_h + 2*spiel_loch_z]);
    translate([-zunge_d/2, wand + zunge_y, -(innen_z - riegel_z)])
      hull() {
        translate([-0.1, 0, 0])
          cube([0.1, riegel_b + 2*spiel_loch_y + 3, riegel_h + 2*spiel_loch_z + 3], center = true);
        translate([1.6, 0, 0])
          cube([0.1, riegel_b + 2*spiel_loch_y, riegel_h + 2*spiel_loch_z], center = true);
      }

    /* Anfasung an der Spitze der Zunge: faedelt in den Schlitz ein. */
    for (sx = [-1, 1])
      translate([sx * zunge_d/2, wand + zunge_y, -zunge_l])
        rotate([0, 45, 0]) cube([2.4, zunge_b + 2, 2.4], center = true);
  }
}

module deckel() {
  union() {
    translate([-aussen_x/2, 0, 0]) cube([aussen_x, aussen_y, wand]);
    /* Rand: bewusst lose. Er haelt Staub ab und begrenzt das seitliche
     * Rutschen - fuehren tut die Zunge. */
    translate([-innen_x/2 + spiel_rand, wand + spiel_rand, -rand_h])
      difference() {
        cube([innen_x - 2*spiel_rand, innen_y - 2*spiel_rand, rand_h]);
        translate([2.4, 2.4, -1])
          cube([innen_x - 2*spiel_rand - 4.8, innen_y - 2*spiel_rand - 4.8, rand_h + 2]);
      }
    zunge();
  }
}

module riegel() {
  difference() {
    cube([riegel_l, riegel_b, riegel_h], center = true);
    // Querschlitz fuer den Mitnehmerstift
    translate([-riegel_l/2 + schlitz_von_links, 0, 0])
      cube([stift_d + 0.6, 2 * stift_radius * (1 - cos(schwenk)) + stift_d + 3, riegel_h + 2],
           center = true);
    /* Fase an der Spitze - faedelt in das Loch der Zunge ein, auch wenn der
     * Deckel ein Zehntel zu hoch sitzt. Rundum, nicht nur oben und unten. */
    translate([riegel_l/2, 0, 0]) rotate([0, 45, 0])
      cube([3, riegel_b + 2, 3], center = true);
    translate([riegel_l/2, 0, 0]) rotate([45, 0, 0])
      cube([3, 3, riegel_h + 2], center = true);
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

/* ---------- Pruefstueck ----------
 *
 * Ein Ausschnitt des Blocks mit Bohrung und Zungenschlitz, dazu ein kurzer
 * Riegel und eine kurze Zunge. Druckt in etwa 20 Minuten statt in sechs
 * Stunden und beantwortet die einzige Frage, die sich vorher nicht rechnen
 * laesst: ob DEIN Drucker diese Passungen trifft.
 *
 * Es benutzt dieselben Module wie die Kiste. Baute man es nach, pruefte es
 * seine eigene Kopie. */
module pruefstueck() {
  scheibe = zunge_b + 12;
  schnitt_z = boden + bohrung_z0 - 6;
  /* Ausschnitt des Blocks um Zunge und Riegelbohrung, unten abgeschnitten
   * und auf null gesetzt - ein Ausschnitt behaelt sonst seine urspruengliche
   * Hoehe und schwebt im Slicer 20 mm ueber der Platte. */
  translate([0, 0, -schnitt_z])
    difference() {
      intersection() {
        koerper();
        /* Reicht bis hinter die Servotasche: So laesst sich auch das Servo
         * probehalber einsetzen. Klone streuen um bis zu drei Zehntel, und
         * das merkt man lieber am Pruefstueck als an der fertigen Kiste. */
        translate([servo_achse_x - servo_achse_versatz - 8, wand + zunge_y - scheibe/2, boden])
          cube([(riegel_spitze_zu + 10) - (servo_achse_x - servo_achse_versatz - 8), scheibe, innen_z]);
      }
      translate([-60, -10, 0]) cube([200, 200, schnitt_z]);
    }
  // kurzer Riegel daneben
  translate([0, scheibe + 14, riegel_h/2])
    intersection() {
      translate([riegel_l/2 - 16, 0, 0]) riegel();
      cube([32, riegel_b + 2, riegel_h + 2], center = true);
    }
  // kurze Zunge daneben
  translate([-34, scheibe + 14, 0])
    rotate([0, 0, 0])
      intersection() {
        translate([0, -(wand + zunge_y), zunge_l]) zunge();
        translate([0, 0, 9]) cube([zunge_d + 2, zunge_b + 2, 18], center = true);
      }
}

if (teil == "pruefstueck") pruefstueck();
else if (teil == "mechanik") mechanik();
else if (teil == "koerper") koerper();
else if (teil == "deckel") deckel();
else if (teil == "riegel") riegel();
else baugruppe();
