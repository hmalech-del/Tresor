"""Verdrahtungsplan fuer den Servotest -> schaltplan.svg

Das Board ist ein ESP32 DevKitC mit 38 Pins (wie das des Nutzers, USB-C),
von oben gesehen, USB rechts. Die Stifte zeigen nach UNTEN - die
Dupont-Buchsen werden von unten aufgesteckt. Pinbelegung wie auf dem
Aufdruck: obere Reihe GND ... CLK, untere Reihe 3V3 ... 5V.

  python3 schaltplan.py   (schreibt schaltplan.svg daneben)
"""
import pathlib

OBEN = "GND G23 G22 TXD RXD G21 GND G19 G18 G5 G17 G16 G4 G0 G2 G15 SD1 SD0 CLK".split()
UNTEN = "3V3 EN VP VN G34 G35 G32 G33 G25 G26 G27 G14 G12 GND G13 SD2 SD3 CMD 5V".split()
ROT, BRAUN, ORANGE, GRAU = "#d62828", "#7a4a1f", "#f08c00", "#555"

B_X, B_Y, B_W, B_H = 60, 250, 540, 150          # Board
P0, DP = B_X + 28, 26                            # erster Pin, Raster (gezeichnet, nicht massstaeblich)
Y_O, Y_U = B_Y + 18, B_Y + B_H - 18              # Pinreihen

def pin_x(i): return P0 + i * DP

s = []
add = s.append
add('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 850" width="1000" height="850" '
    'font-family="DejaVu Sans, Arial, sans-serif">')
add('<rect width="1000" height="850" fill="#fff"/>')
add('<text x="30" y="40" font-size="24" font-weight="bold">Servotest – Verdrahtung</text>')
add('<text x="30" y="66" font-size="14" fill="#444">ESP32 DevKit (38 Pins, USB-C) von oben · Stifte zeigen nach unten: '
    'Dupont-Buchsen von unten aufstecken</text>')

# Board
add(f'<rect x="{B_X}" y="{B_Y}" width="{B_W}" height="{B_H}" rx="8" fill="#1d1d1d"/>')
add(f'<rect x="{B_X + 18}" y="{B_Y + 42}" width="120" height="66" rx="3" fill="#b9b9b9"/>')
add(f'<text x="{B_X + 78}" y="{B_Y + 80}" font-size="13" text-anchor="middle">ESP32</text>')
add(f'<rect x="{B_X + B_W - 8}" y="{B_Y + 58}" width="34" height="34" rx="5" fill="#9a9a9a"/>')
add(f'<text x="{B_X + B_W + 42}" y="{B_Y + 72}" font-size="13">USB-C</text>')
add(f'<text x="{B_X + B_W + 42}" y="{B_Y + 90}" font-size="12" fill="#444">zum Rechner</text>')
add(f'<text x="{B_X + B_W + 42}" y="{B_Y + 106}" font-size="12" fill="#444">(Datenkabel!)</text>')
for reihe, y, namen, oben in ((0, Y_O, OBEN, True), (1, Y_U, UNTEN, False)):
    for i, n in enumerate(namen):
        x = pin_x(i)
        wichtig = (oben and i in (6, 8)) or (not oben and i == 18)
        add(f'<circle cx="{x}" cy="{y}" r="{6 if wichtig else 4}" fill="{"#ffd43b" if wichtig else "#c9a227"}"/>')
        ty = y + (20 if oben else -12)
        add(f'<text x="{x}" y="{ty}" font-size="{11 if wichtig else 9}" fill="{"#fff" if wichtig else "#bbb"}" '
            f'text-anchor="middle" font-weight="{"bold" if wichtig else "normal"}">{n}</text>')

# Steckbrett (Mini, 2 Reihen genutzt)
SB_X, SB_Y = 650, 470
add(f'<rect x="{SB_X}" y="{SB_Y}" width="300" height="120" rx="6" fill="#f1f3f5" stroke="#adb5bd"/>')
add(f'<text x="{SB_X + 150}" y="{SB_Y + 112}" font-size="12" text-anchor="middle" fill="#555">Mini-Steckbrett</text>')
R5, RG = SB_Y + 35, SB_Y + 75                    # Reihe 5V, Reihe GND
for y, farbe, name in ((R5, ROT, "+5V"), (RG, "#222", "GND")):
    add(f'<line x1="{SB_X + 20}" y1="{y}" x2="{SB_X + 280}" y2="{y}" stroke="{farbe}" stroke-width="3" opacity="0.25"/>')
    add(f'<text x="{SB_X + 290}" y="{y + 4}" font-size="11" fill="{farbe}">{name}</text>')
    for k in range(10):
        add(f'<rect x="{SB_X + 26 + k * 25}" y="{y - 4}" width="8" height="8" fill="#ced4da"/>')

# Elko (zwischen den Reihen, stehend)
EX = SB_X + 205
add(f'<rect x="{EX - 14}" y="{SB_Y - 52}" width="28" height="44" rx="5" fill="#364fc7"/>')
add(f'<rect x="{EX + 6}" y="{SB_Y - 52}" width="8" height="44" fill="#91a7ff"/>')
add(f'<text x="{EX - 30}" y="{SB_Y - 58}" font-size="12">Elko 1000 µF</text>')
add(f'<line x1="{EX - 6}" y1="{SB_Y - 8}" x2="{EX - 6}" y2="{R5}" stroke="{GRAU}" stroke-width="2"/>')
add(f'<line x1="{EX + 8}" y1="{SB_Y - 8}" x2="{EX + 8}" y2="{RG}" stroke="{GRAU}" stroke-width="2"/>')
add(f'<text x="{EX - 26}" y="{R5 - 8}" font-size="11" fill="{ROT}">+ langes Bein</text>')
add(f'<text x="{EX + 14}" y="{RG - 10}" font-size="11">− Streifen</text>')

# Servo
SX, SY = 700, 110
add(f'<rect x="{SX}" y="{SY}" width="150" height="80" rx="6" fill="#5f3dc4"/>')
add(f'<circle cx="{SX + 40}" cy="{SY + 40}" r="16" fill="#e5dbff"/>')
add(f'<text x="{SX + 100}" y="{SY + 46}" font-size="16" fill="#fff" text-anchor="middle">MG90S</text>')
# drei Litzen aus dem Servo nach unten links
ax = [SX + 30, SX + 45, SX + 60]

def linie(punkte, farbe, breite=4):
    d = " ".join(f"{'M' if i == 0 else 'L'}{x},{y}" for i, (x, y) in enumerate(punkte))
    add(f'<path d="{d}" fill="none" stroke="{farbe}" stroke-width="{breite}" stroke-linejoin="round" stroke-linecap="round"/>')

# orange: direkt zu G18 (obere Reihe, Index 8)
linie([(ax[2], SY + 80), (ax[2], 225), (pin_x(8), 225), (pin_x(8), Y_O)], ORANGE)
# braun: zur GND-Reihe des Steckbretts
linie([(ax[0], SY + 80), (ax[0], 210), (SB_X + 105, 210), (SB_X + 105, RG)], BRAUN)
# rot: zur 5V-Reihe des Steckbretts
linie([(ax[1], SY + 80), (ax[1], 200), (SB_X + 130, 200), (SB_X + 130, R5)], ROT)
add(f'<text x="{SX + 160}" y="{SY + 20}" font-size="12" fill="{BRAUN}">braun = GND</text>')
add(f'<text x="{SX + 160}" y="{SY + 38}" font-size="12" fill="{ROT}">rot = +5V</text>')
add(f'<text x="{SX + 160}" y="{SY + 56}" font-size="12" fill="{ORANGE}">orange = Signal</text>')

# Board -> Steckbrett: GND (obere Reihe, Index 6) und 5V (untere Reihe, Index 18)
linie([(pin_x(6), Y_O), (pin_x(6), 238), (630, 238), (630, RG), (SB_X + 30, RG)], "#222")
linie([(pin_x(18), Y_U), (pin_x(18), 440), (SB_X + 55, 440), (SB_X + 55, R5)], ROT)

# Legende / Hinweise
H = ["So wird gesteckt",
     "1  orange (Signal) → G18. Litze männlich/weiblich: weiblich auf den Stift, männlich in die Servobuchse.",
     "2  rot (+5V) und braun (GND) des Servos ins Steckbrett – über zwei Litzen männlich/männlich.",
     "3  Board 5V und Board GND ins Steckbrett – zwei Litzen männlich/weiblich (weiblich auf den Stift).",
     "4  Elko ins Steckbrett: langes Bein (+) in die 5V-Reihe, Bein am hellen Streifen (−) in die GND-Reihe.",
     "5  Alles nachzählen, erst dann USB einstecken.",
     "",
     "Ohne Steckbrett: erst ohne Elko testen – orange, rot, braun direkt (3 Litzen männlich/weiblich).",
     "Startet das Board beim Fahren neu (Hilfetext erscheint wieder), fehlt der Elko."]
for i, t in enumerate(H):
    add(f'<text x="30" y="{630 + i * 24}" font-size="{15 if i == 0 else 13}" '
        f'font-weight="{"bold" if i == 0 else "normal"}" fill="#222">{t}</text>')
add('</svg>')
pathlib.Path(__file__).with_name("schaltplan.svg").write_text("\n".join(s), encoding="utf-8")
print("schaltplan.svg geschrieben")
