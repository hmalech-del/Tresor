#!/usr/bin/env python3
"""Rechnet die kritischen Masse der Tresorbox nach.

Ein Render zeigt nur, was man ohnehin sieht - die Teile des Verschlusses
liegen im Block und sind unsichtbar. Diese Pruefung rechnet stattdessen
nach, ob sich alles trifft, und faellt auf, sobald jemand an den Parametern
dreht. Nach jeder Aenderung an tresorbox.scad laufen lassen.
"""
import math, re, sys, pathlib

quelle = pathlib.Path(__file__).with_name("tresorbox.scad").read_text(encoding="utf-8")

def p(name):
    """Holt einen Zahlenparameter aus der SCAD-Datei."""
    treffer = re.search(rf"^{name}\s*=\s*([-\d.]+)\s*;", quelle, re.M)
    if not treffer:
        sys.exit(f"Parameter {name} nicht gefunden")
    return float(treffer.group(1))

innen_x, innen_y, innen_z = p("innen_x"), p("innen_y"), p("innen_z")
wand, boden, spiel = p("wand"), p("boden"), p("spiel")
zunge_b, zunge_d, zunge_l = p("zunge_b"), p("zunge_d"), p("zunge_l")
riegel_b, riegel_h, riegel_l = p("riegel_b"), p("riegel_h"), p("riegel_l")
servo_x, servo_y, servo_z = p("servo_x"), p("servo_y"), p("servo_z")
servo_achse_versatz = p("servo_achse_versatz")
stift_radius, stift_d, schwenk = p("stift_radius"), p("stift_d"), p("schwenk")
block_y, block_b, riegel_z, zunge_y = p("block_y"), p("block_b"), p("riegel_z"), p("zunge_y")
servo_achse_x, rand_h = p("servo_achse_x"), p("rand_h")

weg = 2 * stift_radius * math.sin(math.radians(schwenk))
servo_achse_y = zunge_y - stift_radius * (1 + math.cos(math.radians(schwenk))) / 2
servo_oben = riegel_z + 3
spitze_zu = zunge_d / 2 + 3.5
spitze_auf = spitze_zu - weg
schlitz_von_links = riegel_l - (spitze_zu - servo_achse_x) + stift_radius * math.sin(math.radians(schwenk))
block_h = innen_z - rand_h - 2
bohrung_links = -block_b / 2 - 1
bohrung_rechts = bohrung_links + block_b / 2 + spitze_zu + 4

fehler = []
def pruefe(name, bedingung, text):
    zeichen = "ok  " if bedingung else "FEHL"
    print(f"  [{zeichen}] {name:34s} {text}")
    if not bedingung:
        fehler.append(name)

print("Verschluss")
pruefe("Riegel geht durch die Zunge",
       spitze_zu > zunge_d / 2 + 2,
       f"Spitze {spitze_zu:+.1f}, Zunge endet {zunge_d/2:+.1f} -> {spitze_zu - zunge_d/2:.1f} mm darueber")
pruefe("Riegel gibt die Zunge frei",
       spitze_auf < -(zunge_d / 2 + spiel + 1.5),
       f"Spitze offen {spitze_auf:+.1f} -> {abs(spitze_auf) - zunge_d/2:.1f} mm Luft")
pruefe("Riegelende bleibt in der Bohrung",
       spitze_auf - riegel_l > bohrung_links,
       f"Ende offen {spitze_auf - riegel_l:+.1f}, Bohrung beginnt {bohrung_links:+.1f}")
pruefe("Bohrung reicht weit genug",
       bohrung_rechts > spitze_zu + 1,
       f"Bohrung endet {bohrung_rechts:+.1f}, Spitze braucht {spitze_zu:+.1f}")
pruefe("Riegel schmaler als die Zunge",
       riegel_b + 2 * spiel < zunge_b - 4,
       f"Riegel {riegel_b} mm in einer {zunge_b} mm breiten Zunge")

print("\nKurbelschleife")
for name, spitze, theta in [("verriegelt", spitze_zu, schwenk), ("offen", spitze_auf, -schwenk)]:
    schlitz = spitze - riegel_l + schlitz_von_links
    stift = servo_achse_x + stift_radius * math.sin(math.radians(theta))
    pruefe(f"Stift trifft Schlitz ({name})", abs(schlitz - stift) < 0.05,
           f"Schlitz {schlitz:+.2f} | Stift {stift:+.2f}")
schlitz_laenge = 2 * stift_radius * (1 - math.cos(math.radians(schwenk))) + stift_d + 3
stift_y_hub = stift_radius * (1 - math.cos(math.radians(schwenk))) * 2
pruefe("Querschlitz lang genug", schlitz_laenge > stift_y_hub + stift_d + 1,
       f"Schlitz {schlitz_laenge:.1f} mm, Stift wandert {stift_y_hub:.1f} mm")
pruefe("Querschlitz passt in den Riegel", schlitz_laenge < riegel_b - 1,
       f"Schlitz {schlitz_laenge:.1f} mm in {riegel_b} mm Riegelbreite")

print("\nPlatz im Koerper")
servo_vorn = servo_achse_y - servo_y / 2 - spiel
pruefe("Servotasche bricht nicht durch", servo_vorn > 1.0,
       f"Tasche beginnt {servo_vorn:.1f} mm hinter der Innenwand")
pruefe("Servo passt in die Blocktiefe", servo_achse_y + servo_y / 2 + spiel < block_y - 1,
       f"Rumpf endet bei {servo_achse_y + servo_y/2:.1f}, Block ist {block_y} tief")
pruefe("Zunge passt in die Blocktiefe",
       zunge_y + zunge_b / 2 + spiel < block_y - 1 and zunge_y - zunge_b / 2 - spiel > 1,
       f"Zunge {zunge_y - zunge_b/2:.1f} bis {zunge_y + zunge_b/2:.1f} in {block_y} mm")
pruefe("Servo passt in die Hoehe", servo_oben - servo_z > 0.5,
       f"Rumpf von {servo_oben - servo_z:.1f} bis {servo_oben:.1f} ueber dem Boden")
pruefe("Block bleibt unter dem Deckelrand", block_h + 1.5 < innen_z - rand_h + 0.01,
       f"Block {block_h:.1f} hoch, Rand endet bei {innen_z - rand_h:.1f}")
pruefe("Zunge reicht unter den Riegel",
       zunge_l > (innen_z - riegel_z) + riegel_h / 2 + 3,
       f"Zunge {zunge_l} lang, Riegel sitzt {innen_z - riegel_z:.0f} mm unter dem Deckel")
pruefe("Block passt in die Kiste", block_b < innen_x - 8 and block_y < innen_y - 8,
       f"Block {block_b}x{block_y} in {innen_x}x{innen_y}")

print("\nDruck")
flaeche = riegel_b * riegel_h
pruefe("Riegel traegt genug", flaeche * 12 > 800,
       f"{flaeche:.0f} mm2 Scherflaeche -> etwa {flaeche*12/1000:.1f} kN bei PETG")
print(f"  [info] Bauraum                      {innen_x+2*wand:.0f} x {innen_y+2*wand:.0f} x {innen_z+boden:.0f} mm")

print()
if fehler:
    print("FEHLGESCHLAGEN: " + ", ".join(fehler))
    sys.exit(1)
print("Alle Masse passen.")
