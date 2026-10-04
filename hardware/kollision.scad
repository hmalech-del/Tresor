/* Kollisionspruefung: Servo, Horn und Stift gegen Koerper und Riegel.
 *
 * pruefung.py rendert jeden Fall einzeln; ist die Schnittmenge leer, passt
 * es. So hat es beim ersten Entwurf nicht ausgesehen: Das Servo stand nur
 * als Achse im Modell, und sein Rumpf ragte 5,5 mm in die Riegelbahn.
 *
 *   openscad -D 'fall="rumpf_koerper"' -o x.stl kollision.scad
 *
 * Faelle: rumpf_koerper, laschen_koerper, rumpf_riegel_zu, rumpf_riegel_auf,
 *         arm_koerper_zu, arm_koerper_mitte, arm_koerper_auf,
 *         arm_riegel_zu, arm_riegel_auf, stift_koerper_zu, stift_koerper_auf
 */
include <tresorbox.scad>
teil = "nichts";
fall = "rumpf_koerper";

/* Das Servo als Klotz, so wie es in der Tasche haengt. */
module rumpf() {
  translate([servo_achse_x - servo_achse_versatz, wand + servo_achse_y - servo_y/2, boden + servo_unten])
    cube([servo_x, servo_y, servo_z]);
}
module laschen() {
  translate([servo_mitte_x - servo_flansch_x/2, wand + servo_achse_y - servo_y/2, boden + servo_unten + servo_flansch_z])
    cube([servo_flansch_x, servo_y, servo_flansch_d]);
}
/* Der Arm: 5 mm breit, 2 mm dick, bis zur Spitze; w = Winkel aus der Mitte. */
module arm(w) {
  translate([servo_achse_x, wand + servo_achse_y, boden + servo_oben + horn_unterseite])
    rotate([0, 0, 90 + w]) translate([0, -2.5, 0]) cube([horn_arm, 5, 2]);
}
/* Der Stift: M2, 12 mm, von der Armoberseite nach unten. */
module stift(w) {
  translate([servo_achse_x + stift_radius * cos(90 + w), wand + servo_achse_y + stift_radius * sin(90 + w),
             boden + servo_oben + horn_unterseite + 2 - 12])
    cylinder(d = stift_d, h = 12);
}
/* Riegel in einer Endlage. Verriegelt ist der positive Ausschlag - der Stift
 * wandert dann in +x, also zur Zunge hin. */
module riegel_in(zu) {
  spitze = zu ? riegel_spitze_zu : riegel_spitze_zu - riegel_weg;
  translate([spitze - riegel_l/2, wand + zunge_y, boden + riegel_z]) riegel();
}
/* Der Arm dreht im Uhrzeigersinn gesehen, wenn der Stift nach +x soll:
 * Winkel aus der +y-Richtung, positiv = gegen den Uhrzeiger. Nach +x heisst
 * also -schwenk. */
zu_w = -schwenk;
auf_w = schwenk;

if (fall == "rumpf_koerper") intersection() { koerper(); rumpf(); }
if (fall == "laschen_koerper") intersection() { koerper(); laschen(); }
if (fall == "rumpf_riegel_zu") intersection() { riegel_in(true); rumpf(); }
if (fall == "rumpf_riegel_auf") intersection() { riegel_in(false); rumpf(); }
if (fall == "arm_koerper_zu") intersection() { koerper(); arm(zu_w); }
if (fall == "arm_koerper_mitte") intersection() { koerper(); arm(0); }
if (fall == "arm_koerper_auf") intersection() { koerper(); arm(auf_w); }
if (fall == "arm_riegel_zu") intersection() { riegel_in(true); arm(zu_w); }
if (fall == "arm_riegel_auf") intersection() { riegel_in(false); arm(auf_w); }
if (fall == "stift_koerper_zu") intersection() { koerper(); stift(zu_w); }
if (fall == "stift_koerper_auf") intersection() { koerper(); stift(auf_w); }
/* Gegenprobe: Der Stift muss im Querschlitz stecken, nicht im Riegel. */
if (fall == "stift_riegel_zu") intersection() { riegel_in(true); stift(zu_w); }
if (fall == "stift_riegel_auf") intersection() { riegel_in(false); stift(auf_w); }

/* Ansicht fuer die README: Blockausschnitt des Pruefstuecks mit eingesetztem
 * Servo, Horn, Stift und Riegel (verriegelt). Nur in der Vorschau farbig. */
if (fall == "ansicht") {
  /* Schnitt durch die Servoachse: Die vordere Haelfte des Blocks fehlt,
   * damit man sieht, wie das Servo in seiner Tasche haengt. */
  color("Gainsboro") intersection() {
    koerper();
    translate([servo_mitte_x - servo_flansch_x/2 - 4, wand + servo_achse_y, boden])
      cube([60, 45, innen_z - rand_h - 2]);
  }
  color("Purple") rumpf();
  color("MediumOrchid") laschen();
  color("Black") arm(zu_w);
  color("Black") translate([servo_achse_x, wand + servo_achse_y, boden + servo_oben])
    cylinder(r = 3.5, h = horn_unterseite + 2);
  color("Silver") stift(zu_w);
  color("Goldenrod") riegel_in(true);
}
