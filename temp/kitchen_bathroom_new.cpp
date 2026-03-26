// БИБЛИОТЕКИ
// ============================================================================
#include <ESP8266WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <Servo.h>
#include <NTPClient.h>
#include <WiFiUdp.h>
#include <LittleFS.h>
// ESP8266: FastLED использует bit-banging и отключает прерывания во время show().
// WiFi stack работает через прерывания — если срабатывает во время show(), тайминг
// сигнала к ленте сбивается и обновляются только первые LED с неверными цветами.
// ALLOW_INTERRUPTS 0 полностью отключает прерывания на ~0.9мс (30 LED) — WiFi
// стек выдерживает до ~10мс без реконнекта, поэтому это безопасно.
#define FASTLED_ALLOW_INTERRUPTS 0
#include <FastLED.h>
#include "secrets_ws.h"

// ============================================================================
// 1. РАСПИНОВКА (ПИНЫ) для NodeMCU ESP8266
// ============================================================================
// Безопасность
#define PIN_GAS           A0  // A0 - MQ-2
#define PIN_LEAK          2  // D4 - Датчик протечки
#define PIN_SERVO_VALVE   5  // D1 - Сервопривод крана
// Климат-контроль
#define PIN_FAN           12  // D6 - Вентилятор (кухня)

// Освещение (кабинет) - Адресная RGB-лента
#define PIN_RGB_STRIP     4   // D2 - Адресная лента кабинета (WS2812B)
#define NUM_OFFICE_LEDS   30  // Количество светодиодов

// ============================================================================
// 2. ВЕБСОКЕТ НАСТРОЙКИ
// ============================================================================
// Базовый URL сервера (изменить на реальный IP сервера)
#define WS_SERVER_HOST   ws_server_host
#define WS_SERVER_PORT   ws_server_port
#define WS_PATH          "/"

// ============================================================================
// 3. ОБЪЕКТЫ И ПЕРЕМЕННЫЕ
// ============================================================================
WebSocketsClient webSocket;
Servo servoValve;
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 10800, 60000);

// === БЕЗОПАСНОСТЬ ===
bool gasAlarm = false;
bool leakAlarm = false;
int GAS_DANGER = 400;  // Порог включения тревоги (обновляется с сервера)
int GAS_CLEAR  = 360;  // Порог сброса тревоги (обновляется с сервера)
bool fanState = false;

// === ФЛАГИ ДЛЯ TELEGRAM УВЕДОМЛЕНИЙ (E2-2) ===
bool gasAlertTriggered = false;
bool leakAlertTriggered = false;

// === ОСВЕЩЕНИЕ КАБИНЕТА (адресная лента) ===
CRGB officeLeds[NUM_OFFICE_LEDS];
int officeBrightness = 200;
int officeColorTemp  = 4500;

// === ТАЙМЕРЫ ===
unsigned long lastSensorRead = 0;
const unsigned long SENSOR_INTERVAL = 5000;
const unsigned long RECONNECT_INTERVAL = 5000;  // библиотека переподключается сама

// === ОТЛОЖЕННАЯ ОТПРАВКА СОСТОЯНИЯ ===
// WebSocketsClient на ESP8266 не поддерживает sendTXT() из WStype_CONNECTED коллбека —
// вызывает повреждение внутреннего состояния и разрыв соединения (~5с цикл).
// Паттерн: ставим флаг в коллбеке, отправляем в следующей итерации loop().
bool pendingInitialState = false;

// === DEBOUNCE КНОПКИ (PIN_LEAK / D2) ===
bool lastReading       = HIGH;  // сырое чтение пина — сбрасывает таймер при изменении
bool stableButtonState = HIGH;  // подтверждённое состояние (обновляется после debounce)
unsigned long lastDebounceTime = 0;
const unsigned long DEBOUNCE_DELAY = 50;
bool valveOpen = true;  // текущее состояние крана (true = открыт)

// === СЕРВО: НЕБЛОКИРУЮЩИЙ ATTACH/DETACH ===
// ESP8266 WiFi и Servo используют одни таймеры — держать attach постоянно нельзя.
// Паттерн: attach → write → 600мс → detach (освобождаем таймер для WiFi).
bool servoMoving = false;
unsigned long servoMoveStart = 0;
const unsigned long SERVO_MOVE_TIME = 600;

// ============================================================================
// ЛОГГИРОВАНИЕ
// ============================================================================
void log(const char* direction, const char* data) {
  Serial.print(timeClient.getFormattedTime());
  Serial.print(" ");
  Serial.print(direction);
  Serial.print(" ");
  Serial.println(data);
}

void log(const char* direction, const String& data) {
  log(direction, data.c_str());
}

// ============================================================================
// ФУНКЦИЯ ОТПРАВКИ СОСТОЯНИЯ УСТРОЙСТВ
// ============================================================================
template<typename T>
void sendDeviceState(String device, String parameter, T value) {
  DynamicJsonDocument doc(256);
  doc["type"]       = "device_state";
  doc["device"]     = device;
  doc["parameter"]  = parameter;
  doc["stateValue"] = value;
  doc["timestamp"]  = timeClient.getEpochTime() * 1000ULL;
  doc["api_key"]    = ws_api_key;

  String jsonString;
  serializeJson(doc, jsonString);
  log("OUT", "device_state " + jsonString);
  webSocket.sendTXT(jsonString);
}

// ============================================================================
// ПОДКЛЮЧЕНИЕ К WIFI
// ============================================================================
void connectToWiFi() {
  log("OUT", "WiFi connecting to " + String(ssid));
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  log("OUT", "WiFi connected IP=" + WiFi.localIP().toString() + " RSSI=" + String(WiFi.RSSI()) + "dBm");
}

// ============================================================================
// NTP СИНХРОНИЗАЦИЯ
// ============================================================================
void syncTime() {
  timeClient.begin();
  timeClient.update();
  log("OUT", timeClient.isTimeSet() ? "NTP synced" : "NTP failed");
}

// ============================================================================
// КОНВЕРТАЦИЯ ЦВЕТОВОЙ ТЕМПЕРАТУРЫ В RGB
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
// УПРАВЛЕНИЕ ЛЕНТОЙ КАБИНЕТА
// ============================================================================
void setOfficeLight(int brightness, int colorTemp) {
  officeBrightness = constrain(brightness, 0, 255);
  officeColorTemp  = constrain(colorTemp, 2700, 6500);

  int r, g, b;
  colorTemperatureToRGB(officeColorTemp, officeBrightness, r, g, b);

  fill_solid(officeLeds, NUM_OFFICE_LEDS, CRGB(r, g, b));

  // Диагностика: убедиться что fill_solid заполнил весь массив
  Serial.print("[LED] diag fill: led[0]=");
  Serial.print(officeLeds[0].r); Serial.print(",");
  Serial.print(officeLeds[0].g); Serial.print(",");
  Serial.print(officeLeds[0].b);
  Serial.print(" led[29]=");
  Serial.print(officeLeds[NUM_OFFICE_LEDS-1].r); Serial.print(",");
  Serial.print(officeLeds[NUM_OFFICE_LEDS-1].g); Serial.print(",");
  Serial.println(officeLeds[NUM_OFFICE_LEDS-1].b);

  // Диагностика: состояние WiFi перед show()
  Serial.print("[LED] diag wifi: status=");
  Serial.print(WiFi.status() == WL_CONNECTED ? "connected" : "disconnected");
  Serial.print(" rssi="); Serial.println(WiFi.RSSI());

  yield();  // дать WiFi завершить текущие операции до блокировки прерываний

  unsigned long t0 = micros();
  FastLED.show(); // прерывания отключены на ~0.9мс (30 LED)
  unsigned long show_us = micros() - t0;

  Serial.print("[LED] diag show_us="); Serial.print(show_us);
  Serial.println(show_us > 2000 ? " SLOW (interrupted?)" : " OK");

  yield();  // дать WiFi обработать накопившееся

  // Повторный show — если после повтора лента заработает, значит первый show был сбит
  FastLED.show();
  Serial.println("[LED] diag show2 done");

  sendDeviceState("office_light", "brightness", officeBrightness);
  sendDeviceState("office_light", "colorTemp",  officeColorTemp);
  log("OUT", "office_light brightness=" + String(officeBrightness) + " colorTemp=" + String(officeColorTemp));
}

void handleOfficeLightCommand(JsonDocument& doc) {
  if (doc.containsKey("state") && !doc["state"].as<bool>()) {
    setOfficeLight(0, officeColorTemp);
    return;
  }
  if (doc.containsKey("brightness")) {
    officeBrightness = constrain((int)doc["brightness"], 0, 255);
  }
  if (doc.containsKey("colorTemp")) {
    officeColorTemp = constrain((int)doc["colorTemp"], 2700, 6500);
  }
  setOfficeLight(officeBrightness, officeColorTemp);
}

// ============================================================================
// ОТПРАВКА НАЧАЛЬНОГО СОСТОЯНИЯ
// ============================================================================
void sendInitialState() {
  sendDeviceState("valve", "state", leakAlarm ? "closed" : "open");
  sendDeviceState("kitchen_fan", "state", fanState ? "on" : "off");
  sendDeviceState("office_light", "brightness", officeBrightness);
  sendDeviceState("office_light", "colorTemp",  officeColorTemp);
  log("OUT", "initial_state sent");
}

// ============================================================================
// ОТПРАВКА ДАННЫХ ДАТЧИКОВ
// ============================================================================
template<typename T>
void sendSensorData(String room, String sensorType, T value) {
  DynamicJsonDocument doc(256);
  doc["room"]      = room;
  doc["sensor"]    = sensorType;
  doc["value"]     = value;
  doc["timestamp"] = timeClient.getEpochTime() * 1000ULL;
  doc["api_key"]   = ws_api_key;

  String jsonString;
  serializeJson(doc, jsonString);
  log("OUT", "sensor_data " + jsonString);
  webSocket.sendTXT(jsonString);
}

// ============================================================================
// WEBSOCKET ОБРАБОТЧИКИ
// ============================================================================
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      log("IN", "WS disconnected");
      break;
    case WStype_CONNECTED:
      log("IN", "WS connected");
      pendingInitialState = true;  // отправить в loop() — нельзя из коллбека
      break;

    case WStype_TEXT:
      log("IN", "WS " + String((char*)payload));
      handleIncomingCommand((char*)payload);
      break;

    case WStype_ERROR:
      log("IN", "WS error");
      break;

    default:
      break;
  }
}

// ============================================================================
// ОБРАБОТКА ВХОДЯЩИХ КОМАНД
// ============================================================================
void handleIncomingCommand(String message) {
  DynamicJsonDocument doc(512);
  DeserializationError error = deserializeJson(doc, message);

  if (error) {
    log("IN", "JSON error: " + String(error.c_str()));
    return;
  }

  // Конфигурация порогов с сервера
  if (doc["type"] == "config") {
    if (doc.containsKey("gas_threshold_warning")) GAS_DANGER = doc["gas_threshold_warning"].as<int>();
    if (doc.containsKey("gas_threshold_safe"))   GAS_CLEAR  = doc["gas_threshold_safe"].as<int>();
    log("IN", "config GAS_DANGER=" + String(GAS_DANGER) + " GAS_CLEAR=" + String(GAS_CLEAR));
    return;
  }

  // Игнорируем device_state — это эхо от сервера, не команда
  if (doc["type"] == "device_state") return;

  if (!doc.containsKey("device")) return;

  String device = doc["device"];
  log("IN", "command device=" + device);
  if (device == "fan") handleFanCommand(doc);
  else if (device == "valve") handleValveCommand(doc);
  else if (device == "office_light") handleOfficeLightCommand(doc);
}

void handleFanCommand(JsonDocument& doc) {
  if (!doc.containsKey("state")) return;

  bool fanCommand = false;
  if (doc["state"].is<bool>()) {
    fanCommand = doc["state"].as<bool>();
  } else if (doc["state"].is<int>()) {
    fanCommand = doc["state"].as<int>() != 0;
  } else if (doc["state"].is<const char*>()) {
    String stateStr = doc["state"];
    fanCommand = (stateStr == "true" || stateStr == "1" || stateStr == "on");
  }

  log("IN", "fan command=" + String(fanCommand ? "on" : "off"));

  if (fanCommand && !fanState) {
    pinMode(PIN_FAN, OUTPUT);     // LOW → реле ON → вентик включён
    fanState = true;
    sendDeviceState("kitchen_fan", "state", "on");
  } else if (!fanCommand && fanState) {
    if (gasAlarm) {
      log("IN", "fan off blocked: gas alarm active");
      return;
    }
    pinMode(PIN_FAN, INPUT);      // float → реле OFF → вентик выключен
    fanState = false;
    sendDeviceState("kitchen_fan", "state", "off");
  }
}

// attach → write → (600мс в loop) → detach
void moveValveTo(int angle) {
  // ESP8266 core v3+ по умолчанию шлёт PWM 1000-2000µs — SG90 не реагирует.
  // Задаём стандартный диапазон 544-2400µs (как на Arduino Uno).
  servoValve.attach(PIN_SERVO_VALVE, 544, 2400);
  servoValve.write(angle);
  servoMoveStart = millis();
  servoMoving = true;
}

void handleValveCommand(JsonDocument& doc) {
  if (!doc.containsKey("state")) return;

  // Поддержка bool (сервер: true=close, false=open), int и string
  String state;
  if (doc["state"].is<bool>()) {
    state = doc["state"].as<bool>() ? "close" : "open";
  } else if (doc["state"].is<int>()) {
    state = doc["state"].as<int>() ? "close" : "open";
  } else {
    state = doc["state"].as<String>();
  }

  log("IN", "valve command=" + state);

  if (state == "open" && leakAlarm) {
    log("OUT", "valve blocked: leak alarm active");
  } else if (state == "open") {
    moveValveTo(0);
    valveOpen = true;
    sendDeviceState("valve", "state", "open");
  } else if (state == "close") {
    moveValveTo(90);
    valveOpen = false;
    sendDeviceState("valve", "state", "closed");
  }
}

// ============================================================================
// ОПРОС КНОПКИ С DEBOUNCE (вызывается каждую итерацию loop)
// ============================================================================
void checkButton() {
  bool reading = digitalRead(PIN_LEAK);  // LOW = нажата (INPUT_PULLUP)

  // Любое изменение сырого чтения сбрасывает таймер
  if (reading != lastReading) {
    lastDebounceTime = millis();
  }
  lastReading = reading;

  // После debounce-задержки — фиксируем стабильное состояние
  if ((millis() - lastDebounceTime) > DEBOUNCE_DELAY) {
    if (reading != stableButtonState) {
      stableButtonState = reading;
      // Фронт: HIGH→LOW = нажатие кнопки
      if (stableButtonState == LOW) {
        if (valveOpen) {
          moveValveTo(90);
          valveOpen = false;
          sendDeviceState("valve", "state", "closed");
          log("OUT", "button valve toggle=closed");
        } else {
          moveValveTo(0);
          valveOpen = true;
          sendDeviceState("valve", "state", "open");
          log("OUT", "button valve toggle=open");
        }
      }
    }
  }
}

// ============================================================================
// ОПРОС ДАТЧИКОВ
// ============================================================================
void readSensors() {
  int gasValue = analogRead(PIN_GAS);
  log("OUT", "gas=" + String(gasValue) + " danger=" + String(GAS_DANGER) + " clear=" + String(GAS_CLEAR));
  sendSensorData("kitchen", "gas", (float)gasValue);

  if (gasValue > GAS_DANGER && !gasAlarm) {
    gasAlarm = true;
    gasAlertTriggered = true;
    log("OUT", "gas alarm ON");
    pinMode(PIN_FAN, OUTPUT);     // LOW → реле ON
    fanState = true;
    sendDeviceState("kitchen_fan", "state", "on");
  } else if (gasValue < GAS_CLEAR && gasAlarm) {
    gasAlarm = false;
    gasAlertTriggered = false;
    log("OUT", "gas alarm OFF");
    pinMode(PIN_FAN, INPUT);      // float → реле OFF
    fanState = false;
    sendDeviceState("kitchen_fan", "state", "off");
  }

  int leakState = digitalRead(PIN_LEAK);
  log("OUT", "leak=" + String(leakState));

  // INPUT_PULLUP: LOW = сигнал протечки, HIGH = норма
  if (leakState == LOW && !leakAlarm) {
    leakAlarm = true;
    leakAlertTriggered = true;  // E2-2: флаг для Telegram
    log("OUT", "leak_alert=detected");
    sendSensorData("bathroom", "water_leak", "detected");
    moveValveTo(90);
    sendDeviceState("valve", "state", "closed");
  } else if (leakState == HIGH && leakAlarm) {
    leakAlarm = false;
    leakAlertTriggered = false;  // E2-2: сброс флага
    log("OUT", "leak_alert=clear");
    sendSensorData("bathroom", "water_leak", "clear");
    moveValveTo(0);
    sendDeviceState("valve", "state", "open");
  }
}

// ============================================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(100);

  pinMode(PIN_LEAK, INPUT_PULLUP);
  pinMode(PIN_FAN, INPUT);   // float → реле отпущено → вентик ВЫКЛ при старте
  fanState = false;

  FastLED.addLeds<WS2812B, PIN_RGB_STRIP, GRB>(officeLeds, NUM_OFFICE_LEDS);
  FastLED.setBrightness(255);

  // === LED SELF-TEST (до WiFi) ===
  // Если все 30 LED горят красным — железо исправно, проблема в WiFi-интерференции.
  // Если только первый — проблема в пине, питании или библиотеке.
  Serial.println("[LED] self-test START — WiFi off");
  fill_solid(officeLeds, NUM_OFFICE_LEDS, CRGB(255, 0, 0));
  FastLED.show();
  Serial.print("[LED] self-test: led[0]=");
  Serial.print(officeLeds[0].r); Serial.print(",");
  Serial.print(officeLeds[0].g); Serial.print(",");
  Serial.println(officeLeds[0].b);
  Serial.print("[LED] self-test: led[29]=");
  Serial.print(officeLeds[NUM_OFFICE_LEDS-1].r); Serial.print(",");
  Serial.print(officeLeds[NUM_OFFICE_LEDS-1].g); Serial.print(",");
  Serial.println(officeLeds[NUM_OFFICE_LEDS-1].b);
  Serial.println("[LED] self-test: 30 LEDs red — watch strip now");
  delay(500);

  FastLED.clear();
  FastLED.show();

  // Инициализация флагов уведомлений
  gasAlertTriggered = false;
  leakAlertTriggered = false;

  // Не attach здесь — держать серво постоянно нельзя (конфликт с WiFi таймерами)
  // Первая позиция: открыт (0°), без серво — просто фиксируем состояние
  valveOpen = true;

  connectToWiFi();
  syncTime();

  webSocket.begin(WS_SERVER_HOST, WS_SERVER_PORT, WS_PATH);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(RECONNECT_INTERVAL);
  webSocket.enableHeartbeat(15000, 10000, 2); // ping every 15s, pong timeout 10s, 2 retries

  log("OUT", "system ready chip_id=" + String(ESP.getChipId()));
}

// ============================================================================
// ОСНОВНОЙ ЦИКЛ
// ============================================================================
void loop() {
  webSocket.loop();
  checkButton();

  // Отложенная отправка начального состояния после подключения
  if (pendingInitialState) {
    pendingInitialState = false;
    sendInitialState();
  }

  // Detach серво после SERVO_MOVE_TIME — освобождаем таймер для WiFi
  if (servoMoving && (millis() - servoMoveStart > SERVO_MOVE_TIME)) {
    servoValve.detach();
    servoMoving = false;
  }

  if (WiFi.status() != WL_CONNECTED) {
    log("OUT", "WiFi lost, reconnecting");
    connectToWiFi();
    delay(5000);
    return;
  }

  timeClient.update();

  if (millis() - lastSensorRead > SENSOR_INTERVAL) {
    lastSensorRead = millis();
    readSensors();
  }

  delay(10);
}