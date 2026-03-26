// ============================================================================
// БИБЛИОТЕКИ
// ============================================================================
#include <ESP8266WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <Servo.h>
#include <NTPClient.h>
#include <WiFiUdp.h>
#include <LittleFS.h>
#define FASTLED_ALLOW_INTERRUPTS 0
#include <FastLED.h>
#include "secrets_ws.h"

// ============================================================================
// 1. РАСПИНОВКА (ПИНЫ) для NodeMCU ESP8266 — ИСПРАВЛЕНО ПО ПЛАНУ
// ============================================================================
// Освещение (прихожая)
#define PIN_PIR           13  // D7 - Датчик движения
#define PIN_HALL_STRIP    12  // D6 - Адресная лента прихожей (WS2812B)
#define NUM_HALL_LEDS     30  // Количество светодиодов в ленте прихожей

// Климат (кабинет)
#define PIN_DHT           2   // D4 - DHT11
#define PIN_SERVO_WINDOW  5   // D1 - Сервопривод окна ← ПЕРЕНЕСЕНО с D3 (GPIO0)!

// D1 свободен (лента кабинета перенесена на kitchen_bathroom ESP)

// Климат-контроль
#define PIN_HUMIDIFIER    14  // D5 - Увлажнитель (кабинет)

// ============================================================================
// 2. ВЕБСОКЕТ НАСТРОЙКИ
// ============================================================================
#define WS_SERVER_HOST   ws_server_host
#define WS_SERVER_PORT   ws_server_port
#define WS_PATH          "/"

// ============================================================================
// 3. ОБЪЕКТЫ И ПЕРЕМЕННЫЕ
// ============================================================================
WebSocketsClient webSocket;
DHT dht(PIN_DHT, DHT11);
Servo servoWindow;
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 10800, 60000);

// Адресная лента прихожей
CRGB hallLeds[NUM_HALL_LEDS];

// === РЕЖИМЫ РАБОТЫ КАБИНЕТА ===
enum RoomMode { OFF, FOCUS, RELAX, MANUAL };
RoomMode currentMode = MANUAL;

// === ОСВЕЩЕНИЕ (прихожая) ===
bool lightAutoMode = true;
unsigned long lastMotionTime = 0;
unsigned long MOTION_TIMEOUT = 5000;  // 5 секунд (обновляется из LittleFS)
int currentBrightness = 0;
bool manualOverride = false;
unsigned long manualOverrideTime = 0;
bool motionDetected = false;
bool pendingInitialState = false;

// === КЛИМАТ ===
float temp_open_threshold = 23.0;
float temp_close_threshold = 19.0;
float humidity_min = 50.0;
int windowPosition = 0;
bool humidifierState = false;

// === ТАЙМЕРЫ ===
unsigned long lastSensorRead = 0;
const unsigned long SENSOR_INTERVAL = 5000;
unsigned long lastReconnectAttempt = 0;
const unsigned long RECONNECT_INTERVAL = 5000;

// === СТРУКТУРА НАСТРОЕК ===
struct SystemSettings {
  unsigned long motion_timeout;
  float temp_open_threshold;
  float temp_close_threshold;
  float humidity_min;
  int gas_threshold;
  RoomMode current_mode;
};
SystemSettings settings;

// ============================================================================
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ
// ============================================================================
void printSeparator() {
  Serial.println("--------------------------------------------");
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
  Serial.print("[WS] ◀ Отправка состояния: ");
  Serial.println(jsonString);
  webSocket.sendTXT(jsonString);
}

// Освещение кабинета (office_light) перенесено на kitchen_bathroom ESP

// ============================================================================
// УСТАНОВКА РЕЖИМА РАБОТЫ КАБИНЕТА — ОБНОВЛЕНО ПРЕДУСТАНОВКИ
// ============================================================================
void setMode(RoomMode mode) {
  currentMode = mode;
  settings.current_mode = mode;
  saveSettings();
  
  Serial.print("[MODE] Режим работы изменен на: ");
  switch(mode) {
    case OFF:
      Serial.println("OFF");
      setLightBrightness(0, false);
      if (windowPosition != 0) {
        servoWindow.write(0);
        windowPosition = 0;
        sendDeviceState("window", "state", "closed");
      }
      if (humidifierState) {
        digitalWrite(PIN_HUMIDIFIER, LOW);  // ИСПРАВЛЕНО: digitalWrite вместо pinMode
        humidifierState = false;
        sendDeviceState("office_humidifier", "state", "off");
      }
      break;
      
    case FOCUS:
      Serial.println("FOCUS");
      temp_open_threshold = 22.0;
      temp_close_threshold = 18.0;
      humidity_min = 45.0;
      settings.temp_open_threshold = temp_open_threshold;
      settings.temp_close_threshold = temp_close_threshold;
      settings.humidity_min = humidity_min;
      saveSettings();
      break;
      
    case RELAX:
      Serial.println("RELAX");
      temp_open_threshold = 25.0;
      temp_close_threshold = 21.0;
      humidity_min = 55.0;
      settings.temp_open_threshold = temp_open_threshold;
      settings.temp_close_threshold = temp_close_threshold;
      settings.humidity_min = humidity_min;
      saveSettings();
      break;
      
    case MANUAL:
      Serial.println("MANUAL");
      // Ручное управление — ничего не менять
      break;
  }
  
  // Отправка уведомления о смене режима
  DynamicJsonDocument doc(128);
  doc["type"] = "mode_changed";
  doc["mode"] = currentMode;
  
  String jsonString;
  serializeJson(doc, jsonString);
  webSocket.sendTXT(jsonString);
}

// ============================================================================
// ЗАГРУЗКА НАСТРОЕК ИЗ LittleFS
// ============================================================================
void loadSettings() {
  Serial.println("[SETTINGS] Загрузка настроек...");
  
  if (!LittleFS.begin()) {
    Serial.println("[SETTINGS] ✗ Ошибка инициализации LittleFS");
    settings.motion_timeout = 300000;
    settings.temp_open_threshold = 23.0;
    settings.temp_close_threshold = 19.0;
    settings.humidity_min = 50.0;
    settings.gas_threshold = 1000;
    settings.current_mode = MANUAL;
    return;
  }
  
  if (LittleFS.exists("/settings.json")) {
    File file = LittleFS.open("/settings.json", "r");
    if (file) {
      DynamicJsonDocument doc(256);
      DeserializationError error = deserializeJson(doc, file);
      
      if (!error) {
        settings.motion_timeout = doc["motion_timeout"] | 5000UL;
        if (settings.motion_timeout < 5000) settings.motion_timeout = 5000;
        settings.temp_open_threshold = doc["temp_open_threshold"];
        settings.temp_close_threshold = doc["temp_close_threshold"];
        settings.humidity_min = doc["humidity_min"];
        settings.gas_threshold = doc["gas_threshold"];
        settings.current_mode = (RoomMode)doc["current_mode"];
        
        MOTION_TIMEOUT = settings.motion_timeout;
        temp_open_threshold = settings.temp_open_threshold;
        temp_close_threshold = settings.temp_close_threshold;
        humidity_min = settings.humidity_min;
        currentMode = settings.current_mode;
        
        Serial.println("[SETTINGS] ✓ Настройки загружены");
      } else {
        Serial.println("[SETTINGS] ✗ Ошибка парсинга настроек");
      }
      
      file.close();
    }
  }
}

// ============================================================================
// СОХРАНЕНИЕ НАСТРОЕК В LittleFS
// ============================================================================
void saveSettings() {
  Serial.println("[SETTINGS] Сохранение настроек...");
  
  DynamicJsonDocument doc(256);
  doc["motion_timeout"] = settings.motion_timeout;
  doc["temp_open_threshold"] = settings.temp_open_threshold;
  doc["temp_close_threshold"] = settings.temp_close_threshold;
  doc["humidity_min"] = settings.humidity_min;
  doc["gas_threshold"] = settings.gas_threshold;
  doc["current_mode"] = (int)settings.current_mode;
  
  File file = LittleFS.open("/settings.json", "w");
  if (file) {
    serializeJson(doc, file);
    file.close();
    Serial.println("[SETTINGS] ✓ Настройки сохранены");
  }
}

// ============================================================================
// ОТПРАВКА НАЧАЛЬНОГО СОСТОЯНИЯ
// ============================================================================
void sendInitialState() {
  Serial.println("[WS] Отправка начального состояния устройств...");
  
  sendDeviceState("hall_light", "brightness", currentBrightness);
  sendDeviceState("window", "state", windowPosition == 90 ? "open" : "closed");
  sendDeviceState("office_humidifier", "state", humidifierState ? "on" : "off");
  sendDeviceState("office_mode", "mode", currentMode);
  
  Serial.println("[WS] ✓ Начальное состояние отправлено");
  
  DynamicJsonDocument request(64);
  request["type"] = "request_settings";
  String requestStr;
  serializeJson(request, requestStr);
  webSocket.sendTXT(requestStr);
}

// ============================================================================
// ПОДКЛЮЧЕНИЕ К WIFI
// ============================================================================
void connectToWiFi() {
  Serial.println();
  printSeparator();
  Serial.print("[WiFi] Подключение к сети: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    attempts++;
    if (attempts % 20 == 0) {
      Serial.println();
      Serial.println("[WiFi] Ожидание подключения...");
    }
  }
  
  Serial.println();
  Serial.println("[WiFi] ✓ Подключено!");
  Serial.print("[WiFi] IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("[WiFi] RSSI: ");
  Serial.print(WiFi.RSSI());
  Serial.println(" dBm");
  printSeparator();
}

// ============================================================================
// NTP СИНХРОНИЗАЦИЯ
// ============================================================================
void syncTime() {
  Serial.println("[NTP] Синхронизация времени...");
  timeClient.begin();
  timeClient.update();
  
  if (timeClient.isTimeSet()) {
    Serial.println("[NTP] ✓ Время синхронизировано!");
    Serial.print("[NTP] Текущее время: ");
    Serial.println(timeClient.getFormattedTime());
  } else {
    Serial.println("[NTP] ✗ Не удалось получить время");
  }
}

// ============================================================================
// WEBSOCKET ОБРАБОТЧИКИ
// ============================================================================
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("[WS] ✗ Соединение разорвано");
      break;
    case WStype_CONNECTED:
      Serial.println("[WS] ✓ Подключено");
      Serial.print("[WS] URL: ws://");
      Serial.print(WS_SERVER_HOST);
      Serial.print(":");
      Serial.print(WS_SERVER_PORT);
      Serial.println(WS_PATH);
      
      pendingInitialState = true;
      break;
      
    case WStype_TEXT:
      Serial.print("[WS] ▶ Получено: ");
      Serial.println((char*)payload);
      handleIncomingCommand((char*)payload);
      break;
      
    case WStype_BIN:
      Serial.println("[WS] ▶ Бинарные данные (не обрабатываются)");
      break;
      
    case WStype_PING:
      Serial.println("[WS] ○ PING");
      break;
      
    case WStype_PONG:
      Serial.println("[WS] ● PONG");
      break;
      
    case WStype_ERROR:
      Serial.println("[WS] ✗ Ошибка");
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
    Serial.print("[WS] ✗ Ошибка JSON: ");
    Serial.println(error.c_str());
    return;
  }
  
  // Обработка команды настроек
  if (doc.containsKey("command") && doc["command"] == "set_settings") {
    if (doc.containsKey("settings")) {
      JsonObject settingsObj = doc["settings"];
      
      if (settingsObj.containsKey("motion_timeout")) {
        unsigned long newTimeout = (unsigned long)(int)settingsObj["motion_timeout"] * 1000UL;
        if (newTimeout < 5000) newTimeout = 5000;
        settings.motion_timeout = newTimeout;
        MOTION_TIMEOUT = settings.motion_timeout;
      }
      
      if (settingsObj.containsKey("temp_open_threshold")) {
        settings.temp_open_threshold = settingsObj["temp_open_threshold"];
        temp_open_threshold = settings.temp_open_threshold;
      }
      
      if (settingsObj.containsKey("temp_close_threshold")) {
        settings.temp_close_threshold = settingsObj["temp_close_threshold"];
        temp_close_threshold = settings.temp_close_threshold;
      }
      
      if (settingsObj.containsKey("humidity_min")) {
        settings.humidity_min = settingsObj["humidity_min"];
        humidity_min = settings.humidity_min;
      }
      
      saveSettings();
      
      DynamicJsonDocument response(128);
      response["type"] = "settings_applied";
      response["status"] = "success";
      
      String responseStr;
      serializeJson(response, responseStr);
      webSocket.sendTXT(responseStr);
      return;
    }
  }
  
  // Обработка команды смены режима
  if (doc.containsKey("type") && doc["type"] == "command" && doc["command"] == "set_mode") {
    if (doc.containsKey("mode")) {
      String modeStr = doc["mode"];
      RoomMode mode;
      if (modeStr == "focus") mode = FOCUS;
      else if (modeStr == "rest") mode = RELAX;
      else if (modeStr == "manual") mode = MANUAL;
      else if (modeStr == "off") mode = OFF;
      else return;
      
      setMode(mode);
      return;
    }
  }
  
  // Обработка команд устройств
  if (doc.containsKey("device")) {
    String device = doc["device"];
    if (device == "light") handleLightCommand(doc);
    else if (device == "window") handleWindowCommand(doc);
    else if (device == "humidifier") handleHumidifierCommand(doc);
    else if (device == "climate") handleClimateSettingsCommand(doc);
  }
}

void handleLightCommand(JsonDocument& doc) {
  if (doc.containsKey("brightness")) {
    int brightness = doc["brightness"];
    setLightBrightness(brightness, doc.containsKey("manual") ? doc["manual"] : true);
  }
  
  if (doc.containsKey("mode")) {
    String mode = doc["mode"];
    if (mode == "auto") {
      lightAutoMode = true;
      manualOverride = false;
      Serial.println("[LIGHT] Режим: автоматический");
    } else if (mode == "manual") {
      lightAutoMode = false;
      manualOverride = true;
      manualOverrideTime = millis();
      Serial.println("[LIGHT] Режим: ручной");
    }
  }
}

void handleWindowCommand(JsonDocument & doc) {
  if (doc.containsKey("state")) {
    String state = doc["state"];
    if (state == "open" && windowPosition != 90) {
      servoWindow.write(90);
      windowPosition = 90;
      sendDeviceState("window", "state", "open");
    } else if (state == "close" && windowPosition != 0) {
      servoWindow.write(0);
      windowPosition = 0;
      sendDeviceState("window", "state", "closed");
    }
  }
}

void handleClimateSettingsCommand(JsonDocument& doc) {
  if (doc.containsKey("temp_open_threshold")) {
    temp_open_threshold = doc["temp_open_threshold"];
    settings.temp_open_threshold = temp_open_threshold;
    Serial.print("[CLIMATE] temp_open_threshold = ");
    Serial.println(temp_open_threshold);
  }
  if (doc.containsKey("temp_close_threshold")) {
    temp_close_threshold = doc["temp_close_threshold"];
    settings.temp_close_threshold = temp_close_threshold;
    Serial.print("[CLIMATE] temp_close_threshold = ");
    Serial.println(temp_close_threshold);
  }
  if (doc.containsKey("humidity_min")) {
    humidity_min = doc["humidity_min"];
    settings.humidity_min = humidity_min;
    Serial.print("[CLIMATE] humidity_min = ");
    Serial.println(humidity_min);
  }
  saveSettings();
  DynamicJsonDocument response(128);
  response["type"] = "settings_applied";
  response["status"] = "success";
  String responseStr;
  serializeJson(response, responseStr);
  webSocket.sendTXT(responseStr);
}

void handleHumidifierCommand(JsonDocument & doc) {
  if (doc.containsKey("state")) {
    bool humidifierCommand = doc["state"];
    if (humidifierCommand && !humidifierState) {
      digitalWrite(PIN_HUMIDIFIER, HIGH);  // ИСПРАВЛЕНО: было pinMode(..., INPUT)
      humidifierState = true;
      sendDeviceState("office_humidifier", "state", "on");
    } else if (!humidifierCommand && humidifierState) {
      digitalWrite(PIN_HUMIDIFIER, LOW);   // ИСПРАВЛЕНО: было pinMode(..., OUTPUT)
      humidifierState = false;
      sendDeviceState("office_humidifier", "state", "off");
    }
  }
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
  Serial.print("[WS] ◀ Отправка данных: ");
  Serial.println(jsonString);
  webSocket.sendTXT(jsonString);
}

// ============================================================================
// УПРАВЛЕНИЕ СВЕТОМ (прихожая)
// ============================================================================
void setLightBrightness(int brightness, bool manual) {
  brightness = constrain(brightness, 0, 100);
  
  if (manual) {
    manualOverride = true;
    manualOverrideTime = millis();
    lightAutoMode = false;
  }
  
  currentBrightness = brightness;
  int v = map(brightness, 0, 100, 0, 255);
  fill_solid(hallLeds, NUM_HALL_LEDS, CRGB(v, v, v));
  yield();
  FastLED.show();
  yield();

  sendDeviceState("hall_light", "brightness", currentBrightness);
  
  Serial.print("[LIGHT] Яркость: ");
  Serial.print(brightness);
  Serial.println("%");
}

void checkMotionSensor() {
  int motionState = digitalRead(PIN_PIR);
  
  if (motionState == HIGH && !motionDetected) {
    motionDetected = true;
    lastMotionTime = millis();
    Serial.println("[PIR] >>> Движение обнаружено! <<<");
    sendSensorData("hallway", "motion", "detected");
    
    if (lightAutoMode && !manualOverride) {
      setLightBrightness(100, false);
    }
  }
  
  if (motionDetected && millis() - lastMotionTime > MOTION_TIMEOUT) {
    motionDetected = false;
    Serial.print("[PIR] Движение прекратилось (~");
    Serial.print(MOTION_TIMEOUT / 1000);
    Serial.println(" сек)");
    sendSensorData("hallway", "motion", "clear");
    
    if (lightAutoMode && !manualOverride) {
      setLightBrightness(0, false);
    }
  }
}

// ============================================================================
// ОПРОС ДАТЧИКОВ
// ============================================================================
void readSensors() {
  // DHT11
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  
  if (!isnan(temperature)) {
    Serial.print("[DHT] Температура: ");
    Serial.print(temperature);
    Serial.println(" °C");
    sendSensorData("office", "temperature", temperature);
  }
  
  if (!isnan(humidity)) {
    Serial.print("[DHT] Влажность: ");
    Serial.print(humidity);
    Serial.println(" %");
    sendSensorData("office", "humidity", humidity);
    
    if (currentMode != OFF && humidity < humidity_min && !humidifierState) {
      digitalWrite(PIN_HUMIDIFIER, HIGH);  // ИСПРАВЛЕНО
      humidifierState = true;
      sendDeviceState("office_humidifier", "state", "on");
      Serial.println("[CLIMATE] Увлажнитель включен");
    } else if (currentMode == OFF && humidifierState) {
      // OFF mode: принудительно выключить
      digitalWrite(PIN_HUMIDIFIER, LOW);
      humidifierState = false;
      sendDeviceState("office_humidifier", "state", "off");
      Serial.println("[CLIMATE] Увлажнитель выключен (OFF режим)");
    } else if (currentMode != OFF && humidity >= humidity_min + 5 && humidifierState) {
      digitalWrite(PIN_HUMIDIFIER, LOW);   // ИСПРАВЛЕНО
      humidifierState = false;
      sendDeviceState("office_humidifier", "state", "off");
      Serial.println("[CLIMATE] Увлажнитель выключен");
    }
  }
}

// ============================================================================
// УПРАВЛЕНИЕ КЛИМАТОМ
// ============================================================================
void climateControl() {
  float temperature = dht.readTemperature();
  
  if (isnan(temperature)) return;
  
  if (temperature > temp_open_threshold && windowPosition == 0) {
    servoWindow.write(90);
    windowPosition = 90;
    sendDeviceState("window", "state", "open");
    Serial.println("[CLIMATE] Окно открыто");
  } else if (temperature < temp_close_threshold && windowPosition == 90) {
    servoWindow.write(0);
    windowPosition = 0;
    sendDeviceState("window", "state", "closed");
    Serial.println("[CLIMATE] Окно закрыто");
  }
}

// ============================================================================
// ИНИЦИАЛИЗАЦИЯ — ИСПРАВЛЕНО
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(100);
  
  Serial.println();
  Serial.println("============================================");
  Serial.println("   ИНИЦИАЛИЗАЦИЯ (Прихожая + Кабинет)    ");
  Serial.println("============================================");
  
  Serial.print("[SYS] Chip ID: ");
  Serial.println(ESP.getChipId());
  
  Serial.println("[SYS] Настройка пинов...");

  pinMode(PIN_PIR, INPUT);
  pinMode(PIN_HUMIDIFIER, OUTPUT);
  digitalWrite(PIN_HUMIDIFIER, LOW);

  // Инициализация ленты прихожей (лента кабинета — на kitchen_bathroom ESP)
  FastLED.addLeds<WS2812B, PIN_HALL_STRIP, GRB>(hallLeds, NUM_HALL_LEDS);
  FastLED.setBrightness(200);
  FastLED.clear();
  yield();
  FastLED.show();
  yield();
  
  // Сервопривод окна — ПЕРЕНЕСЕН на D2 (GPIO4)
  servoWindow.attach(PIN_SERVO_WINDOW);
  servoWindow.write(0);

  dht.begin();
  
  connectToWiFi();
  
  Serial.println();
  loadSettings();
  
  Serial.println();
  syncTime();
  
  setMode(currentMode);
  
  Serial.println();
  printSeparator();
  Serial.println("[WS] Настройка WebSocket...");
  webSocket.begin(WS_SERVER_HOST, WS_SERVER_PORT, WS_PATH);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(RECONNECT_INTERVAL);
  Serial.println("[WS] ✓ WebSocket клиент инициализирован");
  Serial.print("[WS] Сервер: ws://");
  Serial.print(WS_SERVER_HOST);
  Serial.print(":");
  Serial.print(WS_SERVER_PORT);
  Serial.println(WS_PATH);
  printSeparator();
  
  Serial.println("============================================");
  Serial.println("          СИСТЕМА ГОТОВА                    ");
  Serial.println("============================================");
  Serial.println("[SYS] Датчики: PIR, DHT");
  Serial.println("[SYS] Устройства: HALL_STRIP(FASTLED/D6), SERVO(D2), HUMID");
  Serial.println("[SYS] Протокол: WebSocket / JSON");
  Serial.println("[SYS] Интервал: 5 сек");
  Serial.println("[SYS] LittleFS: OK");
  Serial.println("============================================");
  Serial.println();
}

// ============================================================================
// ОСНОВНОЙ ЦИКЛ
// ============================================================================
void loop() {
  webSocket.loop();

  if (pendingInitialState) {
    pendingInitialState = false;
    sendInitialState();
  }

  if (!webSocket.isConnected() && (millis() - lastReconnectAttempt > RECONNECT_INTERVAL)) {
    Serial.println("[WS] Попытка переподключения...");
    webSocket.disconnect();
    webSocket.begin(WS_SERVER_HOST, WS_SERVER_PORT, WS_PATH);
    lastReconnectAttempt = millis();
  }
  
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Отключен, переподключение...");
    connectToWiFi();
    delay(5000);
    return;
  }
  
  timeClient.update();
  
  checkMotionSensor();
  
  if (millis() - lastSensorRead > SENSOR_INTERVAL) {
    lastSensorRead = millis();
    readSensors();
    if (currentMode != OFF) climateControl();
  }
  
  if (manualOverride && millis() - manualOverrideTime > 300000) {
    manualOverride = false;
    lightAutoMode = true;
    Serial.println("[LIGHT] Автоматический режим восстановлен");
  }
  
  delay(10);
}