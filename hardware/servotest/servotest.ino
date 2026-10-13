/* Servotest fuer die Tresorbox - noch nicht die Firmware.
 *
 * Faehrt das Servo auf Befehl ueber den seriellen Monitor (115200 Baud).
 * Im Monitor unten "Neue Zeile" als Zeilenende waehlen.
 *
 *   m      Mitte (90 Grad) - zum Aufstecken des Horns, Riegel auf halbem Weg
 *   z      zu    (Mitte + 23 Grad)
 *   a      auf   (Mitte - 23 Grad)
 *   +      ein Grad weiter in Richtung "zu"   (Endlage nachstellen)
 *   -      ein Grad weiter in Richtung "auf"
 *   d      Dauertest: 20-mal zu und auf, mit Pause
 *   p      zeigt den aktuellen Winkel
 *   h      Hilfe
 *   105    (eine Zahl + Enter) faehrt auf genau diesen Winkel - begrenzt auf
 *          die Mitte +-31 Grad, weiter liefe der Stift aus seinem Schlitz
 *
 * Laeuft der Riegel bei "z" auf statt zu, ist nur die Drehrichtung
 * andersherum: RICHTUNG unten auf -1 setzen.
 *
 * Verdrahtung wie in hardware/README.md: braun GND, rot 5V, orange GPIO 18,
 * Elko 1000 uF zwischen 5V und GND nah am Servo.
 *
 * Bibliothek: "ESP32Servo" (Arduino-Bibliotheksverwalter). Board:
 * "ESP32 Dev Module" aus dem Paket "esp32" von Espressif.
 */
#include <ESP32Servo.h>

const int PIN = 18;
const int MITTE = 90;
const int SCHWENK = 23;          // wie schwenk in tresorbox.scad (23,4 Grad)
const int GRENZE = 31;           // weiter aus der Mitte laeuft der Stift aus dem Schlitz
const int RICHTUNG = 1;          // -1, wenn "zu" und "auf" vertauscht sind
const int SCHRITT_MS = 12;       // langsam fahren: Klemmt etwas, knallt es nicht

Servo servo;
int winkel = MITTE;
String zahl = "";

/* Langsam hinfahren und danach loslassen (detach). Ein dauernd angesteuertes
 * Servo brummt, wird warm und drueckt gegen jede kleine Verspannung - die
 * Last haengt ohnehin in der Bohrungswand, nicht im Getriebe. */
void fahre(int ziel) {
  ziel = constrain(ziel, MITTE - GRENZE, MITTE + GRENZE);
  servo.attach(PIN, 500, 2400);  // MG90S/SG90: etwa 0,5 bis 2,4 ms
  servo.write(winkel);
  while (winkel != ziel) {
    winkel += (ziel > winkel) ? 1 : -1;
    servo.write(winkel);
    delay(SCHRITT_MS);
  }
  delay(300);
  servo.detach();
  Serial.printf("Winkel %d (Mitte %+d)\n", winkel, winkel - MITTE);
}

void hilfe() {
  Serial.println("Servotest: m = Mitte, z = zu, a = auf, +/- = 1 Grad, d = Dauertest,");
  Serial.println("           p = Winkel zeigen, Zahl + Enter = Winkel anfahren (59..121)");
  Serial.println("Zuerst 'm' senden: Beim Start weiss das Programm nicht, wo das Servo steht.");
}

void setup() {
  Serial.begin(115200);
  ESP32PWM::allocateTimer(0);
  servo.setPeriodHertz(50);
  delay(500);
  hilfe();
}

void loop() {
  if (!Serial.available()) return;
  char c = Serial.read();
  if (c >= '0' && c <= '9') { zahl += c; return; }
  if (c == '\n' || c == '\r') {
    if (zahl.length()) { fahre(zahl.toInt()); zahl = ""; }
    return;
  }
  zahl = "";
  switch (c) {
    case 'm': fahre(MITTE); break;
    case 'z': fahre(MITTE + RICHTUNG * SCHWENK); break;
    case 'a': fahre(MITTE - RICHTUNG * SCHWENK); break;
    case '+': fahre(winkel + RICHTUNG); break;
    case '-': fahre(winkel - RICHTUNG); break;
    case 'p': Serial.printf("Winkel %d (Mitte %+d)\n", winkel, winkel - MITTE); break;
    case 'h': hilfe(); break;
    case 'd':
      for (int i = 1; i <= 20; i++) {
        fahre(MITTE + RICHTUNG * SCHWENK);
        delay(700);
        fahre(MITTE - RICHTUNG * SCHWENK);
        delay(700);
        Serial.printf("Zyklus %d von 20\n", i);
      }
      break;
    default: break;
  }
}
