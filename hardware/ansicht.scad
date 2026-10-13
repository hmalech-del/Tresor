/* Ansichten der ganzen Tresorbox fuer die README - mit Servo, Horn, Stift,
 * Riegel, Platine, Elko und Kabeln. Nur in der Vorschau farbig:
 *
 *   xvfb-run -a openscad -D 'fall="offen"' --camera=... -o gesamt-offen.png ansicht.scad
 *
 * Faelle: offen (Deckel abgehoben), zu (geschlossen). Gekaufte Teile sind
 * vereinfacht: Quader und Zylinder in ihren echten Massen.
 */
include <kollision.scad>
fall = "keine";
ansicht = "offen";
deckel_hub = 45;      // so weit schwebt der Deckel in der offenen Ansicht

module platine() {
  translate([platine_x0, wand + platine_y0, boden + sockel_h]) {
    color("DarkGreen") cube([platine_x, platine_y, 1.6]);
    // ESP32-Modul mit Blechhaube, an der Seite gegenueber der USB-Buchse
    color("Silver") translate([1, (platine_y - 18) / 2, 1.6]) cube([25.5, 18, 3.2]);
    // Stiftleisten an beiden Laengsseiten
    for (y = [1, platine_y - 3.5]) color("Black") translate([3, y, -8.5]) cube([platine_x - 6, 2.5, 8.5]);
    // USB-Buchse an der rechten Stirnseite
    color("Gainsboro") translate([platine_x - 6, platine_y / 2 - 4, 1.6]) cube([6.5, 8, 3.2]);
  }
}

/* USB-Stecker samt Kabel, durch das Loch in der rechten Wand nach aussen. */
module usb() {
  translate([platine_x0 + platine_x + 0.5, wand + platine_mitte_y, boden + buchse_z]) {
    color("DimGray") translate([0, -5.5, -3.5]) cube([22, 11, 7]);
    color("DimGray") translate([22, 0, 0]) rotate([0, 90, 0]) cylinder(d = 4, h = 40);
  }
}

/* Servokabel: unten aus dem Kanal am linken Blockende, an der linken Wand
 * entlang nach hinten und zur Platine. */
module servokabel() {
  z = boden + servo_unten + 4;
  punkte = [[servo_achse_x - servo_achse_versatz, wand + servo_achse_y, z],
            [-block_b / 2 - 4, wand + servo_achse_y, z],
            [-innen_x / 2 + 4, wand + servo_achse_y + 4, z],
            [-innen_x / 2 + 4, wand + platine_mitte_y, z],
            [platine_x0 - 6, wand + platine_mitte_y, z]];
  color("Chocolate")
    for (i = [0 : len(punkte) - 2])
      hull() { translate(punkte[i]) sphere(d = 2.6, $fn = 12); translate(punkte[i + 1]) sphere(d = 2.6, $fn = 12); }
  // Elko 1000 uF neben der Platine
  color("RoyalBlue") translate([platine_x0 - 8, wand + platine_y0 + 4, boden]) cylinder(d = 8, h = 13);
}

module innenleben() {
  color("Purple") rumpf();
  color("MediumOrchid") laschen();
  color("Black") arm(zu_w);
  color("Black") translate([servo_achse_x, wand + servo_achse_y, boden + servo_oben])
    cylinder(r = 3.5, h = horn_unterseite + 2);
  color("Silver") stift(zu_w);
  color("Goldenrod") riegel_in(true);
  platine();
  usb();
  servokabel();
}

color("Khaki") koerper();
innenleben();
/* Offen: Der Deckel schwebt hinter der Kiste, damit er den Blick nicht
 * verdeckt - die Zunge haengt dabei sichtbar nach unten. */
color("SteelBlue")
  translate([0, ansicht == "offen" ? aussen_y + 20 : 0, boden + innen_z + (ansicht == "offen" ? deckel_hub : 0)]) deckel();
