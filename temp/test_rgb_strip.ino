// ============================================================================
// test_rgb_strip.ino
//
// Тест адресной ленты WS2812B — без WiFi/WebSocket.
// Код colorTemperatureToRGB и setOfficeLight идентичен kitchen_bathroom_new.cpp.
//
// Прогоняет те же пресеты что и scripts/test-rgb-strip.js, но прямо с ESP.
// Каждый шаг держится 3 секунды — смотри на ленту.
//
// Подключение: лента на D2 (GPIO4), питание 5V отдельно.
// Плата: NodeMCU 1.0 (ESP8266 12-E)
// ============================================================================

#define FASTLED_ALLOW_INTERRUPTS 0
#include <FastLED.h>

#define PIN_RGB_STRIP   4    // D2
#define NUM_OFFICE_LEDS 30

CRGB officeLeds[NUM_OFFICE_LEDS];
int  officeBrightness = 200;
int  officeColorTemp  = 4500;

// ============================================================================
// КОНВЕРТАЦИЯ ЦВЕТОВОЙ ТЕМПЕРАТУРЫ В RGB
// (идентично kitchen_bathroom_new.cpp)
// ============================================================================
void colorTemperatureToRGB(int kelvin, int brightness, int &r, int &g, int &b) {
  float temp = kelvin / 100.0;
  float red, green, blue;

  red = (temp <= 66) ? 255 : constrain(329.698727446 * pow(temp - 60, -0.1332047592), 0, 255);

  if (temp <= 66) {
    green = constrain(99.4708025861 * log(temp) - 161.1195681661, 0, 255);
  } else {
    green = constrain(288.1221695283 * pow(temp - 60, -0.0755148492), 0, 255);
  }

  if (temp >= 66) {
    blue = 255;
  } else if (temp <= 19) {
    blue = 0;
  } else {
    blue = constrain(138.5177312231 * log(temp - 10) - 305.0447927307, 0, 255);
  }

  r = (int)(red   * brightness / 255);
  g = (int)(green * brightness / 255);
  b = (int)(blue  * brightness / 255);
}

// ============================================================================
// УПРАВЛЕНИЕ ЛЕНТОЙ
// (идентично kitchen_bathroom_new.cpp)
// ============================================================================
void setOfficeLight(int brightness, int colorTemp) {
  officeBrightness = constrain(brightness, 0, 255);
  officeColorTemp  = constrain(colorTemp, 2700, 6500);

  int r, g, b;
  colorTemperatureToRGB(officeColorTemp, officeBrightness, r, g, b);

  fill_solid(officeLeds, NUM_OFFICE_LEDS, CRGB(r, g, b));
  yield();
  FastLED.show();
  yield();

  Serial.print("  rgb(");
  Serial.print(r); Serial.print(", ");
  Serial.print(g); Serial.print(", ");
  Serial.print(b); Serial.print(")  brightness=");
  Serial.print(officeBrightness); Serial.print("  colorTemp=");
  Serial.println(officeColorTemp);
}

// ============================================================================
// ШАГИ ТЕСТА
// ============================================================================
struct Step {
  const char* label;
  int brightness;
  int colorTemp;
};

const Step STEPS[] = {
  { "Full white   255br / 4000K",  255, 4000 },
  { "Warm         140br / 2700K",  140, 2700 },
  { "Cold         220br / 6500K",  220, 6500 },
  { "Dim           25br / 2700K",   25, 2700 },
  { "Focus preset 220br / 5500K",  220, 5500 },
  { "Rest preset  140br / 2700K",  140, 2700 },
  { "OFF            0br / 2700K",    0, 2700 },
};
const int STEP_COUNT  = sizeof(STEPS) / sizeof(STEPS[0]);
const int STEP_DELAY  = 3000;  // мс на каждый шаг

// ============================================================================
// SETUP / LOOP
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(200);

  FastLED.addLeds<WS2812B, PIN_RGB_STRIP, GRB>(officeLeds, NUM_OFFICE_LEDS);
  FastLED.setBrightness(255);
  FastLED.clear();
  FastLED.show();

  Serial.println("\n=== RGB Strip Test ===");
  Serial.println("Each step lasts 3 seconds. Watch the strip.\n");
}

int currentStep = 0;
unsigned long lastStepTime = 0;

void loop() {
  if (currentStep >= STEP_COUNT) return;

  if (millis() - lastStepTime < STEP_DELAY) return;
  lastStepTime = millis();

  const Step& s = STEPS[currentStep];
  Serial.print("Step "); Serial.print(currentStep + 1);
  Serial.print("/"); Serial.print(STEP_COUNT);
  Serial.print("  "); Serial.print(s.label); Serial.print("  →  ");
  setOfficeLight(s.brightness, s.colorTemp);

  currentStep++;

  if (currentStep >= STEP_COUNT) {
    Serial.println("\nDone. Reset ESP to repeat.");
  }
}
