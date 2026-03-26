// ============================================================================
// test_kitchen_logic.ino
//
// Arduino-скетч для тестирования логики kitchen_bathroom_new.cpp
// без WiFi / WebSocket.
//
// Что тестируется:
//   1. colorTemperatureToRGB — контрольные значения для 2700K / 4500K / 6500K
//   2. Gas alarm logic       — GAS_DANGER порог, гистерезис GAS_CLEAR
//   3. Fan command           — on/off, блокировка при gasAlarm
//   4. Leak alarm            — автозакрытие клапана, блокировка valve open
//   5. Valve command         — open/close, блокировка при leakAlarm
//   6. Config update         — обновление GAS_DANGER/GAS_CLEAR с сервера
//   7. handleOfficeLightCommand — brightness, colorTemp, state=false → off
//
// Как запустить:
//   1. Открыть этот файл в Arduino IDE
//   2. Выбрать плату: NodeMCU 1.0 (ESP8266)
//   3. Загрузить и открыть Serial Monitor @ 115200
//   4. Все тесты пройдут автоматически — ищи "PASSED" / "FAIL"
//
// Зависимости (те же что у основного firmware):
//   ArduinoJson, FastLED
// ============================================================================

#include <ArduinoJson.h>
#define FASTLED_ALLOW_INTERRUPTS 0
#include <FastLED.h>

// ─── ЗАГЛУШКИ ВМЕСТО WiFi / WebSocket ───────────────────────────────────────
struct MockWebSocket {
  int sendCount = 0;
  String lastSent;
  void sendTXT(const String& json) {
    lastSent = json;
    sendCount++;
    Serial.println("  WS> " + json);
  }
} webSocket;

// Мок NTPClient — фиксированное время
struct MockTime {
  String getFormattedTime() { return "00:00:00"; }
  unsigned long getEpochTime() { return 1000000UL; }
} timeClient;

// ─── ЗАГЛУШКИ ПИНОВ ─────────────────────────────────────────────────────────
int  mockGasValue   = 200;   // analogRead(A0)
int  mockLeakPin    = HIGH;  // digitalRead(D4)
String mockFanMode  = "INPUT";

int  analogRead(uint8_t)           { return mockGasValue; }
int  digitalRead(uint8_t)          { return mockLeakPin; }
void pinMode(uint8_t, uint8_t m)   { mockFanMode = (m == OUTPUT) ? "OUTPUT" : "INPUT"; }

// ─── ЗАГЛУШКА SERVO ──────────────────────────────────────────────────────────
struct MockServo {
  int angle = 0;
  bool attached = false;
  void attach(uint8_t, int, int) { attached = true; }
  void write(int a)  { angle = a; }
  void detach()      { attached = false; }
} servoValve;

bool servoMoving    = false;
unsigned long servoMoveStart = 0;
const unsigned long SERVO_MOVE_TIME = 600;

// ─── ЗАГЛУШКА FASTLED ────────────────────────────────────────────────────────
#define NUM_OFFICE_LEDS 30
#define PIN_RGB_STRIP    4
CRGB officeLeds[NUM_OFFICE_LEDS];

// ─── СОСТОЯНИЕ FIRMWARE ──────────────────────────────────────────────────────
bool gasAlarm  = false;
bool leakAlarm = false;
bool fanState  = false;
int  GAS_DANGER = 400;
int  GAS_CLEAR  = 360;

bool valveOpen = true;

int officeBrightness = 200;
int officeColorTemp  = 4500;

// ─── ФУНКЦИИ FIRMWARE (копия из kitchen_bathroom_new.cpp) ───────────────────

void log(const char* dir, const String& msg) {
  Serial.print("  "); Serial.print(dir); Serial.print(" "); Serial.println(msg);
}
void log(const char* dir, const char* msg) { log(dir, String(msg)); }

template<typename T>
void sendDeviceState(String device, String parameter, T value) {
  DynamicJsonDocument doc(256);
  doc["type"]       = "device_state";
  doc["device"]     = device;
  doc["parameter"]  = parameter;
  doc["stateValue"] = value;
  String out; serializeJson(doc, out);
  log("OUT", "device_state " + out);
  webSocket.sendTXT(out);
}

void colorTemperatureToRGB(int kelvin, int brightness, int &r, int &g, int &b) {
  float temp = kelvin / 100.0;
  float red, green, blue;
  red   = (temp <= 66) ? 255 : constrain(329.698727446 * pow(temp - 60, -0.1332047592), 0, 255);
  green = (temp <= 66)
    ? constrain(99.4708025861 * log(temp) - 161.1195681661, 0, 255)
    : constrain(288.1221695283 * pow(temp - 60, -0.0755148492), 0, 255);
  blue  = (temp >= 66) ? 255
        : (temp <= 19) ? 0
        : constrain(138.5177312231 * log(temp - 10) - 305.0447927307, 0, 255);
  r = (int)(red   * brightness / 255);
  g = (int)(green * brightness / 255);
  b = (int)(blue  * brightness / 255);
}

void setOfficeLight(int brightness, int colorTemp) {
  officeBrightness = constrain(brightness, 0, 255);
  officeColorTemp  = constrain(colorTemp, 2700, 6500);
  int r, g, b;
  colorTemperatureToRGB(officeColorTemp, officeBrightness, r, g, b);
  fill_solid(officeLeds, NUM_OFFICE_LEDS, CRGB(r, g, b));
  FastLED.show();
  sendDeviceState("office_light", "brightness", officeBrightness);
  sendDeviceState("office_light", "colorTemp",  officeColorTemp);
  log("OUT", "office_light brightness=" + String(officeBrightness) + " colorTemp=" + String(officeColorTemp));
}

void handleOfficeLightCommand(JsonDocument& doc) {
  if (doc.containsKey("state") && !doc["state"].as<bool>()) {
    setOfficeLight(0, officeColorTemp); return;
  }
  if (doc.containsKey("brightness")) officeBrightness = constrain((int)doc["brightness"], 0, 255);
  if (doc.containsKey("colorTemp"))  officeColorTemp  = constrain((int)doc["colorTemp"],  2700, 6500);
  setOfficeLight(officeBrightness, officeColorTemp);
}

void moveValveTo(int angle) {
  servoValve.attach(5, 544, 2400);
  servoValve.write(angle);
  servoMoveStart = millis();
  servoMoving    = true;
}

void handleFanCommand(JsonDocument& doc) {
  if (!doc.containsKey("state")) return;
  bool fanCommand = false;
  if (doc["state"].is<bool>())        fanCommand = doc["state"].as<bool>();
  else if (doc["state"].is<int>())    fanCommand = doc["state"].as<int>() != 0;
  else if (doc["state"].is<const char*>()) {
    String s = doc["state"].as<String>();
    fanCommand = (s == "true" || s == "1" || s == "on");
  }
  log("IN", "fan command=" + String(fanCommand ? "on" : "off"));
  if (fanCommand && !fanState) {
    pinMode(12, OUTPUT); fanState = true;
    sendDeviceState("kitchen_fan", "state", "on");
  } else if (!fanCommand && fanState) {
    if (gasAlarm) { log("IN", "fan off blocked: gas alarm active"); return; }
    pinMode(12, INPUT); fanState = false;
    sendDeviceState("kitchen_fan", "state", "off");
  }
}

void handleValveCommand(JsonDocument& doc) {
  if (!doc.containsKey("state")) return;
  String state;
  if (doc["state"].is<bool>())     state = doc["state"].as<bool>() ? "close" : "open";
  else if (doc["state"].is<int>()) state = doc["state"].as<int>()  ? "close" : "open";
  else                             state = doc["state"].as<String>();
  log("IN", "valve command=" + state);
  if (state == "open" && leakAlarm) {
    log("OUT", "valve blocked: leak alarm active");
  } else if (state == "open") {
    moveValveTo(0); valveOpen = true;
    sendDeviceState("valve", "state", "open");
  } else if (state == "close") {
    moveValveTo(90); valveOpen = false;
    sendDeviceState("valve", "state", "closed");
  }
}

void handleIncomingCommand(const String& message) {
  DynamicJsonDocument doc(512);
  if (deserializeJson(doc, message)) { log("IN", "JSON error"); return; }
  if (doc["type"] == "config") {
    if (doc.containsKey("gas_threshold_warning")) GAS_DANGER = doc["gas_threshold_warning"].as<int>();
    if (doc.containsKey("gas_threshold_safe"))   GAS_CLEAR  = doc["gas_threshold_safe"].as<int>();
    log("IN", "config GAS_DANGER=" + String(GAS_DANGER) + " GAS_CLEAR=" + String(GAS_CLEAR));
    return;
  }
  if (doc["type"] == "device_state") return;
  if (!doc.containsKey("device"))    return;
  String device = doc["device"].as<String>();
  log("IN", "command device=" + device);
  if      (device == "fan")          handleFanCommand(doc);
  else if (device == "valve")        handleValveCommand(doc);
  else if (device == "office_light") handleOfficeLightCommand(doc);
}

void readSensors() {
  int gasValue = analogRead(A0);
  log("OUT", "gas=" + String(gasValue) + " danger=" + String(GAS_DANGER) + " clear=" + String(GAS_CLEAR));
  if (gasValue > GAS_DANGER && !gasAlarm) {
    gasAlarm = true;
    log("OUT", "gas alarm ON");
    pinMode(12, OUTPUT); fanState = true;
    sendDeviceState("kitchen_fan", "state", "on");
  } else if (gasValue < GAS_CLEAR && gasAlarm) {
    gasAlarm = false;
    log("OUT", "gas alarm OFF");
    pinMode(12, INPUT); fanState = false;
    sendDeviceState("kitchen_fan", "state", "off");
  }
  int leakState = digitalRead(2);
  log("OUT", "leak=" + String(leakState));
  if (leakState == LOW && !leakAlarm) {
    leakAlarm = true;
    log("OUT", "leak_alert=detected");
    moveValveTo(90);
    sendDeviceState("valve", "state", "closed");
  } else if (leakState == HIGH && leakAlarm) {
    leakAlarm = false;
    log("OUT", "leak_alert=clear");
    moveValveTo(0);
    sendDeviceState("valve", "state", "open");
  }
}

// ─── ТЕСТОВЫЕ ХЕЛПЕРЫ ────────────────────────────────────────────────────────
int passed = 0, failed = 0;

void checkBool(const char* name, bool got, bool expected) {
  bool ok = (got == expected);
  Serial.print(ok ? "  [PASS] " : "  [FAIL] ");
  Serial.print(name);
  if (!ok) {
    Serial.print(" got="); Serial.print(got);
    Serial.print(" expected="); Serial.print(expected);
  }
  Serial.println();
  ok ? passed++ : failed++;
}

void checkInt(const char* name, int got, int expected, int tol = 5) {
  bool ok = abs(got - expected) <= tol;
  Serial.print(ok ? "  [PASS] " : "  [FAIL] ");
  Serial.print(name);
  if (!ok) {
    Serial.print(" got="); Serial.print(got);
    Serial.print(" expected="); Serial.print(expected);
    Serial.print(" tol=±"); Serial.print(tol);
  }
  Serial.println();
  ok ? passed++ : failed++;
}

void checkStr(const char* name, const String& got, const char* expected) {
  bool ok = got == expected;
  Serial.print(ok ? "  [PASS] " : "  [FAIL] ");
  Serial.print(name);
  if (!ok) {
    Serial.print(" got="); Serial.print(got);
    Serial.print(" expected="); Serial.print(expected);
  }
  Serial.println();
  ok ? passed++ : failed++;
}

void resetState() {
  gasAlarm = false; leakAlarm = false; fanState = false;
  GAS_DANGER = 400; GAS_CLEAR = 360;
  valveOpen = true; officeBrightness = 200; officeColorTemp = 4500;
  mockGasValue = 200; mockLeakPin = HIGH; mockFanMode = "INPUT";
  servoMoving = false;
  webSocket.sendCount = 0;
}

// ─── ТЕСТЫ ────────────────────────────────────────────────────────────────────

void test_colorTemp() {
  Serial.println("\n=== 1. colorTemperatureToRGB ===");
  int r, g, b;

  // 2700K теплый белый: красный максимальный, синий малый
  colorTemperatureToRGB(2700, 255, r, g, b);
  Serial.println("  2700K/255 → r=" + String(r) + " g=" + String(g) + " b=" + String(b));
  checkInt("2700K r ~255", r, 255, 2);
  checkInt("2700K g ~141", g, 141, 8);
  checkInt("2700K b ~41",  b,  41, 8);

  // 4500K нейтральный: красный высокий, синий средний
  colorTemperatureToRGB(4500, 255, r, g, b);
  Serial.println("  4500K/255 → r=" + String(r) + " g=" + String(g) + " b=" + String(b));
  checkInt("4500K r ~255", r, 255, 2);
  checkInt("4500K g ~210", g, 210, 10);
  checkInt("4500K b ~147", b, 147, 10);

  // 6500K холодный: все три высокие
  colorTemperatureToRGB(6500, 255, r, g, b);
  Serial.println("  6500K/255 → r=" + String(r) + " g=" + String(g) + " b=" + String(b));
  checkInt("6500K r ~202", r, 202, 10);
  checkInt("6500K g ~225", g, 225, 10);
  checkInt("6500K b ~255", b, 255, 2);

  // Яркость 0 → всё 0
  colorTemperatureToRGB(4500, 0, r, g, b);
  checkInt("brightness=0 → r=0", r, 0, 0);
  checkInt("brightness=0 → g=0", g, 0, 0);
  checkInt("brightness=0 → b=0", b, 0, 0);
}

void test_gasAlarm() {
  Serial.println("\n=== 2. Gas alarm logic ===");
  resetState();

  // Нормальный уровень — alarm не срабатывает
  mockGasValue = 350;
  readSensors();
  checkBool("gas=350 < 400 → no alarm", gasAlarm, false);
  checkStr ("fan mode stays INPUT",      mockFanMode, "INPUT");

  // Превышение порога — alarm ON, вентилятор включается
  mockGasValue = 450;
  readSensors();
  checkBool("gas=450 > 400 → alarm ON", gasAlarm, true);
  checkStr ("fan mode → OUTPUT",         mockFanMode, "OUTPUT");
  checkBool("fanState = true",           fanState, true);

  // Значение между CLEAR и DANGER — гистерезис, alarm не сбрасывается
  mockGasValue = 380;
  readSensors();
  checkBool("gas=380 in hysteresis → alarm stays ON", gasAlarm, true);

  // Ниже GAS_CLEAR — alarm OFF, вентилятор выключается
  mockGasValue = 300;
  readSensors();
  checkBool("gas=300 < 360 → alarm OFF", gasAlarm, false);
  checkStr ("fan mode → INPUT",          mockFanMode, "INPUT");
  checkBool("fanState = false",          fanState, false);
}

void test_fanCommand() {
  Serial.println("\n=== 3. Fan command ===");
  resetState();

  // Включить вентилятор командой
  handleIncomingCommand(R"({"device":"fan","state":true})");
  checkBool("fan on command → fanState=true", fanState, true);
  checkStr ("fan on → pinMode OUTPUT",        mockFanMode, "OUTPUT");

  // Выключить без alarm — должно сработать
  handleIncomingCommand(R"({"device":"fan","state":false})");
  checkBool("fan off command → fanState=false", fanState, false);
  checkStr ("fan off → pinMode INPUT",          mockFanMode, "INPUT");

  // Включить вентилятор, потом активировать gas alarm
  handleIncomingCommand(R"({"device":"fan","state":true})");
  gasAlarm = true;
  int sendBefore = webSocket.sendCount;

  // Выключить при активном alarm — должно быть заблокировано
  handleIncomingCommand(R"({"device":"fan","state":false})");
  checkBool("fan off blocked by gasAlarm → fanState stays true", fanState, true);
}

void test_leakAlarm() {
  Serial.println("\n=== 4. Leak alarm ===");
  resetState();

  // Нет протечки — всё нормально
  mockLeakPin = HIGH;
  readSensors();
  checkBool("leak=HIGH → no alarm", leakAlarm, false);
  checkBool("valve stays open",     valveOpen, true);

  // Протечка — alarm ON, клапан закрывается
  mockLeakPin = LOW;
  readSensors();
  checkBool("leak=LOW → alarm ON",       leakAlarm, true);
  checkBool("valve closed",              !valveOpen, true);
  checkInt ("servo angle=90 (closed)",   servoValve.angle, 90, 0);

  // Протечка устранена — alarm OFF, клапан открывается
  mockLeakPin = HIGH;
  readSensors();
  checkBool("leak=HIGH → alarm OFF", leakAlarm, false);
  checkBool("valve opened",          valveOpen, true);
  checkInt ("servo angle=0 (open)",  servoValve.angle, 0, 0);
}

void test_valveCommand() {
  Serial.println("\n=== 5. Valve command ===");
  resetState();

  // Закрыть клапан командой
  handleIncomingCommand(R"({"device":"valve","state":"close"})");
  checkBool("valve close cmd → valveOpen=false", valveOpen, false);
  checkInt ("servo angle=90",                    servoValve.angle, 90, 0);

  // Открыть клапан без alarm
  handleIncomingCommand(R"({"device":"valve","state":"open"})");
  checkBool("valve open cmd → valveOpen=true", valveOpen, true);
  checkInt ("servo angle=0",                   servoValve.angle, 0, 0);

  // При активном leak alarm — открытие заблокировано
  leakAlarm = true;
  handleIncomingCommand(R"({"device":"valve","state":"open"})");
  checkBool("valve open blocked by leakAlarm → valveOpen=false", valveOpen, false);
  leakAlarm = false;
}

void test_configUpdate() {
  Serial.println("\n=== 6. Config update ===");
  resetState();

  handleIncomingCommand(R"({"type":"config","gas_threshold_warning":350,"gas_threshold_safe":310})");
  checkInt("GAS_DANGER updated to 350", GAS_DANGER, 350, 0);
  checkInt("GAS_CLEAR  updated to 310", GAS_CLEAR,  310, 0);

  // Gas alarm срабатывает по новым порогам
  mockGasValue = 360; // > 350
  readSensors();
  checkBool("gas=360 > new 350 → alarm ON", gasAlarm, true);

  // Сброс по новому порогу
  mockGasValue = 300; // < 310
  readSensors();
  checkBool("gas=300 < new 310 → alarm OFF", gasAlarm, false);
}

void test_officeLight() {
  Serial.println("\n=== 7. Office light command ===");
  resetState();

  // Включить с заданными параметрами
  handleIncomingCommand(R"({"device":"office_light","state":true,"brightness":180,"colorTemp":3000})");
  checkInt("brightness=180", officeBrightness, 180, 0);
  checkInt("colorTemp=3000", officeColorTemp,  3000, 0);

  // Проверить цвет на ленте (3000K / brightness 180)
  int r, g, b;
  colorTemperatureToRGB(3000, 180, r, g, b);
  checkInt("LED[0].r matches 3000K/180", officeLeds[0].r, r, 2);
  checkInt("LED[0].g matches 3000K/180", officeLeds[0].g, g, 2);
  checkInt("LED[0].b matches 3000K/180", officeLeds[0].b, b, 2);

  // state=false → brightness обнуляется
  handleIncomingCommand(R"({"device":"office_light","state":false})");
  checkInt("state=false → brightness=0", officeBrightness, 0, 0);
  checkInt("LED[0].r=0 (off)",           officeLeds[0].r,  0, 0);

  // Зажать brightness вне диапазона
  handleIncomingCommand(R"({"device":"office_light","state":true,"brightness":999,"colorTemp":1000})");
  checkInt("brightness clamped to 255",  officeBrightness, 255, 0);
  checkInt("colorTemp clamped to 2700",  officeColorTemp,  2700, 0);
}

// ─── SETUP / LOOP ─────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n\n=== ESP Kitchen Logic Tests ===");

  FastLED.addLeds<WS2812B, PIN_RGB_STRIP, GRB>(officeLeds, NUM_OFFICE_LEDS);
  FastLED.setBrightness(255);
  FastLED.clear();

  test_colorTemp();
  test_gasAlarm();
  test_fanCommand();
  test_leakAlarm();
  test_valveCommand();
  test_configUpdate();
  test_officeLight();

  Serial.println("\n================================");
  Serial.print("RESULT: "); Serial.print(passed); Serial.print(" passed, ");
  Serial.print(failed); Serial.println(" failed");
  if (failed == 0) Serial.println("ALL TESTS PASSED");
  else             Serial.println("SOME TESTS FAILED — check above");
  Serial.println("================================\n");
}

void loop() {
  // тесты только в setup, loop пустой
}
