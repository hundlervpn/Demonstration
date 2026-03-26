/**
 * rgb_strip_test.ino — Автономный тест WS2812B (без WiFi/WebSocket)
 *
 * Пин: D1 (GPIO5) — тот же, что PIN_RGB_STRIP в основной прошивке
 * Светодиодов: 30
 *
 * Шаги теста (каждый по 2 сек, затем повтор):
 *   1. Красный (чистый R)        — проверяем канал R
 *   2. Зелёный (чистый G)        — проверяем канал G
 *   3. Синий   (чистый B)        — проверяем канал B
 *   4. Белый   (R+G+B=255)       — полная яркость, макс. ток (~1.8A на 30 LED)
 *   5. Тёплый белый (2700K, 50%) — как режим "Отдых"
 *   6. Холодный белый (5500K, 86%) — как режим "Фокус"
 *   7. Бегущий огонь (1 пиксель) — проверяем, что все LED в цепочке живые
 *   8. Выкл
 *
 * Диагностика по Serial (115200 baud):
 *   - Если шаги 1-6 не дают нужный цвет → проблема с уровнем сигнала (3.3→5V)
 *   - Если шаг 7 останавливается на каком-то LED → сломан именно этот диод
 *   - Если вообще ничего → нет питания или обрыв DATA
 */

#include <FastLED.h>

#define DATA_PIN     2    // D4
#define NUM_LEDS     30
#define STEP_MS      2000 // пауза между шагами (мс)
#define CHASE_MS     80   // задержка бегущего огня (мс/пиксель)

CRGB leds[NUM_LEDS];

// ─── Конвертация цветовой температуры → RGB (тот же алгоритм, что в прошивке) ───
void colorTempToRGB(int kelvin, int brightness, int &r, int &g, int &b) {
  float t = kelvin / 100.0f;
  float fr = (t <= 66) ? 255 : constrain(329.698727f * pow(t - 60, -0.133205f), 0, 255);
  float fg = (t <= 66)
    ? constrain(99.470802f * log(t) - 161.119568f, 0, 255)
    : constrain(288.122170f * pow(t - 60, -0.075515f), 0, 255);
  float fb = (t >= 66) ? 255
    : (t <= 19) ? 0
    : constrain(138.517731f * log(t - 10) - 305.044793f, 0, 255);

  r = (int)(fr * brightness / 255);
  g = (int)(fg * brightness / 255);
  b = (int)(fb * brightness / 255);
}

void fillAll(CRGB color) {
  fill_solid(leds, NUM_LEDS, color);
  FastLED.show();
}

void allOff() {
  FastLED.clear();
  FastLED.show();
}

void printStep(int step, const char* label, int r = -1, int g = -1, int b = -1) {
  Serial.print("[Step ");
  Serial.print(step);
  Serial.print("] ");
  Serial.print(label);
  if (r >= 0) {
    Serial.print("  RGB=(");
    Serial.print(r); Serial.print(",");
    Serial.print(g); Serial.print(",");
    Serial.print(b); Serial.print(")");
  }
  Serial.println();
}

void setup() {
  Serial.begin(115200);
  delay(500);

  FastLED.addLeds<WS2812B, DATA_PIN, GRB>(leds, NUM_LEDS);
  FastLED.setBrightness(255);  // Глобальная яркость FastLED = макс.
  FastLED.clear();
  FastLED.show();

  Serial.println();
  Serial.println("=== WS2812B Strip Test ===");
  Serial.print("Pin: D1 (GPIO5)  LEDs: ");
  Serial.println(NUM_LEDS);
  Serial.println("Each step lasts 2 seconds.");
  Serial.println();
}

void loop() {
  int r, g, b;

  // ── 1. Красный ──────────────────────────────────────────────────────────────
  printStep(1, "Pure RED   — should see RED on all LEDs");
  fillAll(CRGB::Red);
  delay(STEP_MS);

  // ── 2. Зелёный ──────────────────────────────────────────────────────────────
  printStep(2, "Pure GREEN — should see GREEN on all LEDs");
  fillAll(CRGB::Green);
  delay(STEP_MS);

  // ── 3. Синий ────────────────────────────────────────────────────────────────
  printStep(3, "Pure BLUE  — should see BLUE on all LEDs");
  fillAll(CRGB::Blue);
  delay(STEP_MS);

  // ── 4. Белый (полная яркость) ────────────────────────────────────────────────
  printStep(4, "Full WHITE (255,255,255) — ~1.8A draw, check PSU");
  fillAll(CRGB(255, 255, 255));
  delay(STEP_MS);

  // ── 5. Тёплый белый 2700K / 50% ─────────────────────────────────────────────
  colorTempToRGB(2700, 140, r, g, b);
  printStep(5, "Warm white 2700K  50%  (\"Rest\" preset)", r, g, b);
  fillAll(CRGB(r, g, b));
  delay(STEP_MS);

  // ── 6. Холодный белый 5500K / 86% ───────────────────────────────────────────
  colorTempToRGB(5500, 220, r, g, b);
  printStep(6, "Cold white 5500K  86%  (\"Focus\" preset)", r, g, b);
  fillAll(CRGB(r, g, b));
  delay(STEP_MS);

  // ── 7. Бегущий огонь: диагностика обрыва в цепочке ──────────────────────────
  Serial.println("[Step 7] Chase — each LED lights cyan in turn");
  Serial.println("         Watch for which LED stops the chain.");
  allOff();
  for (int i = 0; i < NUM_LEDS; i++) {
    leds[i] = CRGB::Cyan;
    if (i > 0) leds[i - 1] = CRGB::Black;
    FastLED.show();
    Serial.print("  LED #");
    Serial.println(i);
    delay(CHASE_MS);
  }
  // последний гасим
  leds[NUM_LEDS - 1] = CRGB::Black;
  FastLED.show();
  delay(200);

  // ── 8. Выкл ─────────────────────────────────────────────────────────────────
  printStep(8, "OFF — all LEDs should be dark");
  allOff();
  delay(STEP_MS);

  Serial.println("--- Cycle done, repeating ---\n");
}
