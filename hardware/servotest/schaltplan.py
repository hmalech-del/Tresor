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
add('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000" '
    'font-family="DejaVu Sans, Arial, sans-serif">')
add('<rect width="1000" height="1000" fill="#fff"/>')
add('<text x="30" y="40" font-size="24" font-weight="bold">Servotest – Verdrahtung</text>')
add('<text x="30" y="66" font-size="14" fill="#444">ESP32 DevKit (38 Pins, USB-C) von oben · Stifte zeigen nach unten: '
    'Dupont-Buchsen von unten aufstecken</text>')

# Board
add(f'<rect x="{B_X}" y="{B_Y}" width="{B_W}" height="{B_H}" rx="8" fill="#1d1d1d"/>')
add(f'<rect x="{B_X + 18}" y="{B_Y + 42}" width="120" height="66" rx="3" fill="#b9b9b9"/>')
add(f'<text x="{B_X + 78}" y="{B_Y + 80}" font-size="13" text-anchor="middle">ESP32</text>')
add(f'<rect x="{B_X + B_W - 8}" y="{B_Y + 58}" width="34" height="34" rx="5" fill="#9a9a9a"/>')
for reihe, y, namen, oben in ((0, Y_O, OBEN, True), (1, Y_U, UNTEN, False)):
    for i, n in enumerate(namen):
        x = pin_x(i)
        wichtig = (oben and i == 8) or (not oben and i in (13, 18))
        add(f'<circle cx="{x}" cy="{y}" r="{6 if wichtig else 4}" fill="{"#ffd43b" if wichtig else "#c9a227"}"/>')
        ty = y + (20 if oben else -12)
        add(f'<text x="{x}" y="{ty}" font-size="{11 if wichtig else 9}" fill="{"#fff" if wichtig else "#bbb"}" '
            f'text-anchor="middle" font-weight="{"bold" if wichtig else "normal"}">{n}</text>')

# Mini-Steckbrett: je 5 Loecher einer Spalte sind verbunden, obere und untere
# Haelfte getrennt. Der Servostecker sitzt auf einer 3er-Stiftleiste in drei
# Spalten nebeneinander; jede Spalte traegt dann die Leitung ihrer Farbe.
SB_X, SB_Y, SPALTEN, R = 680, 380, 8, 22
def sp_x(c): return SB_X + 30 + c * R               # c = 0 ... SPALTEN-1
def zeile_y(z): return SB_Y + 30 + z * R + (22 if z >= 5 else 0)   # a-e, Graben, f-j
SB_H = zeile_y(9) - SB_Y + 20
add(f'<rect x="{SB_X}" y="{SB_Y}" width="{sp_x(SPALTEN - 1) - SB_X + 30}" height="{SB_H}" rx="6" fill="#f1f3f5" stroke="#adb5bd"/>')
C_OR, C_ROT, C_BR = 3, 4, 5                         # Spalten unter dem Servostecker
TINT = {C_OR: ORANGE, C_ROT: ROT, C_BR: BRAUN}
for c in range(SPALTEN):
    for oben in (True, False):
        z0 = 0 if oben else 5
        farbe = TINT.get(c) if oben else None
        add(f'<rect x="{sp_x(c) - 7}" y="{zeile_y(z0) - 7}" width="14" height="{4 * R + 14}" rx="7" '
            f'fill="{farbe or "#dee2e6"}" opacity="{0.35 if farbe else 0.6}"/>')
        for z in range(z0, z0 + 5):
            add(f'<rect x="{sp_x(c) - 4}" y="{zeile_y(z) - 4}" width="8" height="8" fill="#adb5bd"/>')
for k, t in enumerate(("Mini-Steckbrett: die 5 Löcher einer Spalte", "sind verbunden, die beiden Hälften nicht.")):
    add(f'<text x="{SB_X}" y="{SB_Y + SB_H + 18 + k * 15}" font-size="11" fill="#555">{t}</text>')

def linie(punkte, farbe, breite=4):
    d = " ".join(f"{'M' if i == 0 else 'L'}{x},{y}" for i, (x, y) in enumerate(punkte))
    add(f'<path d="{d}" fill="none" stroke="{farbe}" stroke-width="{breite}" stroke-linejoin="round" stroke-linecap="round"/>')

# Servo und sein Kabelbuendel bis zum Stecker
SX, SY = 700, 100
add(f'<rect x="{SX}" y="{SY}" width="150" height="70" rx="6" fill="#5f3dc4"/>')
add(f'<circle cx="{SX + 36}" cy="{SY + 35}" r="15" fill="#e5dbff"/>')
add(f'<text x="{SX + 100}" y="{SY + 41}" font-size="16" fill="#fff" text-anchor="middle">MG90S</text>')
add(f'<text x="{SX + 160}" y="{SY + 18}" font-size="12" fill="{BRAUN}">braun = GND</text>')
add(f'<text x="{SX + 160}" y="{SY + 36}" font-size="12" fill="{ROT}">rot = +5V</text>')
add(f'<text x="{SX + 160}" y="{SY + 54}" font-size="12" fill="{ORANGE}">orange = Signal</text>')
ST_O, ST_U = zeile_y(0) - 30, zeile_y(0) + 5     # Stecker oben/unten
mitte = sp_x(C_ROT)
for k, (c, farbe) in enumerate(((C_OR, ORANGE), (C_ROT, ROT), (C_BR, BRAUN))):
    bx = mitte - 5 + k * 5
    linie([(bx, SY + 70), (bx, ST_O - 24), (sp_x(c), ST_O - 6), (sp_x(c), ST_O)], farbe, 3)
add(f'<rect x="{sp_x(C_OR) - 11}" y="{ST_O}" width="{sp_x(C_BR) - sp_x(C_OR) + 22}" height="{ST_U - ST_O}" rx="3" fill="#222"/>')
for c in (C_OR, C_ROT, C_BR):
    add(f'<rect x="{sp_x(c) - 2}" y="{ST_U - 4}" width="4" height="8" fill="#ffd43b"/>')
add(f'<text x="{sp_x(C_OR) - 18}" y="{ST_O - 22}" font-size="11" fill="#333" text-anchor="end">Servostecker auf</text>')
add(f'<text x="{sp_x(C_OR) - 18}" y="{ST_O - 8}" font-size="11" fill="#333" text-anchor="end">3er-Stiftleiste</text>')

# Elko von oben, stehend: Beine in Zeile d der roten (+) und braunen (−) Spalte
EX, EY = (sp_x(C_ROT) + sp_x(C_BR)) / 2, zeile_y(3)
add(f'<circle cx="{EX}" cy="{EY}" r="16" fill="#364fc7"/>')
add(f'<path d="M{EX + 9},{EY - 13} A16,16 0 0 1 {EX + 9},{EY + 13} Z" fill="#91a7ff"/>')
add(f'<line x1="{EX + 16}" y1="{EY}" x2="{SB_X + 222}" y2="{EY}" stroke="#333" stroke-width="1"/>')
for k, (t, f) in enumerate((("Elko 1000 µF", "#333"), ("(von oben)", "#555"), ("+ langes Bein:", ROT), ("rote Spalte", ROT),
                            ("− Streifen:", "#333"), ("braune Spalte", "#333"))):
    add(f'<text x="{SB_X + 226}" y="{EY - 36 + k * 15}" font-size="11" fill="{f}">{t}</text>')

# Board -> Steckbrett, jeweils in Zeile e; die Litzen laufen im Graben
GR = zeile_y(4) + 11
linie([(pin_x(8), Y_O), (pin_x(8), 218), (650, 218), (650, GR), (sp_x(C_OR), GR), (sp_x(C_OR), zeile_y(4))], ORANGE)
linie([(pin_x(18), Y_U), (pin_x(18), GR + 11), (sp_x(C_ROT), GR + 11), (sp_x(C_ROT), zeile_y(4))], ROT)
linie([(pin_x(13), Y_U), (pin_x(13), GR + 22), (sp_x(C_BR), GR + 22), (sp_x(C_BR), zeile_y(4))], "#222")
add(f'<text x="{B_X}" y="{B_Y + B_H + 22}" font-size="12" fill="#444">USB-C rechts: Datenkabel zum Rechner</text>')

# Legende / Hinweise
H = ["So wird gesteckt",
     "1  Drei Stifte einer Stiftleiste in die obere Hälfte des Steckbretts, in drei Spalten nebeneinander.",
     "\u00a0\u00a0\u00a0\u00a0Den Servostecker draufstecken. Jetzt trägt jede der drei Spalten eine Servofarbe.",
     "2  Board G18 → orange Spalte, Board 5V → rote Spalte, Board GND → braune Spalte",
     "\u00a0\u00a0\u00a0\u00a0(3 Litzen männlich/weiblich: weiblich von unten auf den Boardstift, männlich ins Steckbrett).",
     "3  Elko: langes Bein (+) in die rote Spalte, Bein am hellen Streifen (−) in die braune.",
     "4  Alles nachzählen, erst dann USB einstecken.",
     "",
     "Ohne Stiftleiste: drei Litzen männlich/männlich in die Löcher des Servosteckers, die anderen Enden in drei Spalten.",
     "Ohne Steckbrett: erst ohne Elko – drei Litzen männlich/weiblich vom Servostecker direkt an G18, 5V und GND."]
for i, t in enumerate(H):
    add(f'<text x="30" y="{760 + i * 24}" font-size="{15 if i == 0 else 13}" '
        f'font-weight="{"bold" if i == 0 else "normal"}" fill="#222">{t}</text>')
add('</svg>')
pathlib.Path(__file__).with_name("schaltplan.svg").write_text("\n".join(s), encoding="utf-8")
print("schaltplan.svg geschrieben")
