#!/usr/bin/env python3
"""Zeichnet die Kurbelschleife als SVG - die Stelle, an der aus Drehen ein
Schieben wird.

Der Mechanismus ist am fertigen Modell unsichtbar: Riegel, Stift und Schlitz
liegen im Verschlussblock, ein Render zeigt nur den Block. Deshalb diese
Draufsicht - und zwar aus denselben Parametern wie die Kiste, denn eine von
Hand gezeichnete Skizze waere nach der ersten Parameteraenderung falsch.
"""
import math, re, pathlib

quelle = pathlib.Path(__file__).with_name("tresorbox.scad").read_text(encoding="utf-8")

def p(name):
    t = re.search(rf"^{name}\s*=\s*([-\d.]+)\s*;", quelle, re.M)
    if not t:
        raise SystemExit(f"Parameter {name} nicht gefunden")
    return float(t.group(1))

r, schwenk, stift_d = p("stift_radius"), p("schwenk"), p("stift_d")
achse_x, zunge_y = p("servo_achse_x"), p("zunge_y")
zunge_d, zunge_b = p("zunge_d"), p("zunge_b")
riegel_l, riegel_b = p("riegel_l"), p("riegel_b")
s_loch_y = p("spiel_loch_y")

achse_y = zunge_y - r * (1 + math.cos(math.radians(schwenk))) / 2
weg = 2 * r * math.sin(math.radians(schwenk))
spitze_zu = zunge_d / 2 + 3.5
schlitz_b = 2 * r * (1 - math.cos(math.radians(schwenk))) + stift_d + 3
loch_b = riegel_b + 2 * s_loch_y

def stift(winkel):
    """Lage des Mitnehmerstifts; Winkel 0 ist die Mittelstellung."""
    return (achse_x + r * math.sin(math.radians(winkel)),
            achse_y + r * math.cos(math.radians(winkel)))

ZU, AUF = +schwenk, -schwenk          # verriegelt ist der positive Ausschlag:
px_zu = stift(ZU)[0]                  # dort steht der Stift am weitesten rechts

M = 5.0                               # Pixel je Millimeter
X0, Y0 = 64, 1                        # Modellnullpunkt, Millimeter vom Rand
BREIT, HOCH = 99, 36

def sx(x): return (x + X0) * M
def sy(y): return (y - Y0) * M

GRAU, LINIE, TEXT = "#9aa4b0", "#6f7b88", "#8b95a1"
RIEGEL, STIFT, ZUNGE = "#5b8dd9", "#e08a45", "#6aa84f"

def tafel(winkel, titel, dy):
    px, py = stift(winkel)
    spitze = spitze_zu + (px - px_zu)          # der Riegel folgt dem Stift in x
    hinten = spitze - riegel_l
    o = [f'<g transform="translate(0,{dy})">',
         f'<text x="{sx(-62)}" y="{sy(Y0)+2}" fill="{TEXT}" font-size="13" '
         f'font-weight="600">{titel}</text>']

    # Zunge: gestrichelter Umriss, dazu die beiden Stege neben dem Loch. Der
    # Riegel faehrt durch die Luecke - genau das soll die Zeichnung zeigen.
    o.append(f'<rect x="{sx(-zunge_d/2)}" y="{sy(zunge_y-zunge_b/2)}" '
             f'width="{zunge_d*M}" height="{zunge_b*M}" fill="none" stroke="{ZUNGE}" '
             f'stroke-width="1" stroke-dasharray="3 2.5" opacity="0.8"/>')
    for oben, hoch in ((zunge_y - zunge_b/2, (zunge_b - loch_b)/2),
                       (zunge_y + loch_b/2,  (zunge_b - loch_b)/2)):
        o.append(f'<rect x="{sx(-zunge_d/2)}" y="{sy(oben)}" width="{zunge_d*M}" '
                 f'height="{hoch*M}" fill="{ZUNGE}" fill-opacity="0.32" '
                 f'stroke="{ZUNGE}" stroke-width="1.4"/>')

    # Riegel mit seinem Querschlitz
    o.append(f'<rect x="{sx(hinten)}" y="{sy(zunge_y-riegel_b/2)}" width="{riegel_l*M}" '
             f'height="{riegel_b*M}" rx="2" fill="{RIEGEL}" fill-opacity="0.20" '
             f'stroke="{RIEGEL}" stroke-width="1.8"/>')
    o.append(f'<rect x="{sx(px-(stift_d+0.6)/2)}" y="{sy(zunge_y-schlitz_b/2)}" '
             f'width="{(stift_d+0.6)*M}" height="{schlitz_b*M}" rx="1.5" fill="#fbfcfd" '
             f'stroke="{RIEGEL}" stroke-width="1.3"/>')

    # Bahn des Stifts, Hornarm, Achse, Stift
    o.append(f'<circle cx="{sx(achse_x)}" cy="{sy(achse_y)}" r="{r*M}" fill="none" '
             f'stroke="{GRAU}" stroke-width="1" stroke-dasharray="3 3" opacity="0.65"/>')
    o.append(f'<line x1="{sx(achse_x)}" y1="{sy(achse_y)}" x2="{sx(px)}" y2="{sy(py)}" '
             f'stroke="{STIFT}" stroke-width="3.4" stroke-linecap="round"/>')
    o.append(f'<circle cx="{sx(achse_x)}" cy="{sy(achse_y)}" r="3.2" fill="#fbfcfd" '
             f'stroke="{LINIE}" stroke-width="1.8"/>')
    o.append(f'<circle cx="{sx(px)}" cy="{sy(py)}" r="{stift_d/2*M}" fill="{STIFT}"/>')

    # Beschriftung - ausserhalb der Geometrie, damit nichts ueberdeckt wird
    def beschriften(x, y, t, farbe, anker="start"):
        o.append(f'<text x="{sx(x)}" y="{sy(y)}" fill="{farbe}" font-size="10.5" '
                 f'text-anchor="{anker}">{t}</text>')

    beschriften(achse_x - 4.5, achse_y - 2.5, "Servoachse", LINIE, "end")
    beschriften(hinten + riegel_l/2 + 4, zunge_y + 1.5, "Riegel", RIEGEL, "middle")
    beschriften(zunge_d/2 + 3, zunge_y - zunge_b/2 + 2.5, "Zunge am Deckel", ZUNGE)
    # Leitlinie vom Querschlitz nach unten
    o.append(f'<line x1="{sx(px)}" y1="{sy(zunge_y+schlitz_b/2)}" x2="{sx(px)}" '
             f'y2="{sy(zunge_y+schlitz_b/2+2.4)}" stroke="{RIEGEL}" stroke-width="1"/>')
    beschriften(px, zunge_y + schlitz_b/2 + 5.4, "Querschlitz, quer zur Fahrt",
                RIEGEL, "middle")

    # Hub bemassen: der waagerechte Abstand der beiden Stiftlagen
    if winkel == ZU:
        y = zunge_y - riegel_b/2 - 5.5
        a, b = stift(AUF)[0], px
        o.append(f'<line x1="{sx(a)}" y1="{sy(y)}" x2="{sx(b)}" y2="{sy(y)}" '
                 f'stroke="{LINIE}" stroke-width="1.1"/>')
        for x in (a, b):
            o.append(f'<line x1="{sx(x)}" y1="{sy(y-1.6)}" x2="{sx(x)}" y2="{sy(y+1.6)}" '
                     f'stroke="{LINIE}" stroke-width="1.1"/>')
        beschriften((a+b)/2, y - 2.6, f"Hub {weg:.1f} mm", LINIE, "middle")
    return "\n".join(o) + "\n</g>"

hoehe = HOCH * M * 2 + 78
teile = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{BREIT*M:.0f}" '
         f'height="{hoehe:.0f}" viewBox="0 0 {BREIT*M:.0f} {hoehe:.0f}" '
         f'font-family="system-ui,-apple-system,sans-serif">',
         tafel(ZU,  f"verriegelt – Servo auf +{schwenk:.0f}°", 14),
         tafel(AUF, f"offen – Servo auf −{schwenk:.0f}°", HOCH * M + 24)]
teile.append(f'<line x1="{sx(-62)}" y1="{hoehe-42}" x2="{sx(-56)}" y2="{hoehe-42}" '
             f'stroke="{STIFT}" stroke-width="3.4" stroke-linecap="round"/>')
teile.append(f'<circle cx="{sx(-56)}" cy="{hoehe-42}" r="{stift_d/2*M}" fill="{STIFT}"/>')
teile.append(f'<text x="{sx(-52)}" y="{hoehe-38.5}" fill="{TEXT}" font-size="11">'
             f'Servohorn mit Mitnehmerstift \u2013 dreht sich, schiebt aber nur in x</text>')
teile.append(f'<text x="{sx(-62)}" y="{hoehe-23}" fill="{TEXT}" font-size="11">'
             f'Hub {weg:.1f} mm = 2 \u00d7 {r:.0f} mm \u00d7 sin\u2009{schwenk:.0f}\u00b0</text>')
teile.append(f'<text x="{sx(-62)}" y="{hoehe-8}" fill="{TEXT}" font-size="11">'
             f'Quer wandert der Stift dabei {2*r*(1-math.cos(math.radians(schwenk)))/2:.1f} mm \u2013 '
             f'das schluckt der {schlitz_b:.1f} mm lange Querschlitz</text>')
teile.append("</svg>")
pathlib.Path(__file__).with_name("kurbelschleife.svg").write_text("\n".join(teile), encoding="utf-8")

# Gegenprobe: der Riegel muss verriegelt durch die Zunge stehen und offen davor.
sp_zu, sp_auf = spitze_zu, spitze_zu - weg
assert sp_zu > zunge_d/2, "Riegel steht verriegelt nicht durch die Zunge"
assert sp_auf < -zunge_d/2, "Riegel gibt offen die Zunge nicht frei"
print(f"Hub {weg:.2f} mm | Spitze verriegelt {sp_zu:+.2f}, offen {sp_auf:+.2f} "
      f"(Zunge von {-zunge_d/2:+.1f} bis {zunge_d/2:+.1f}) | Querschlitz {schlitz_b:.2f} mm")
