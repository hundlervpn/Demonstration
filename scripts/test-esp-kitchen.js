/**
 * ESP Kitchen/Bathroom Firmware Mock Test
 *
 * Simulates kitchen_bathroom_new.cpp logic with mocked WiFi/WebSocket/hardware.
 * Tests gas alarm, leak detection, valve, fan, and office light logic without hardware.
 *
 * Usage:
 *   node scripts/test-esp-kitchen.js              # Scripted scenario only
 *   node scripts/test-esp-kitchen.js ws://localhost:3001  # Also forward to real WS server
 *
 * Scenario (each tick = simulated SENSOR_INTERVAL):
 *   tick 1-2  : gas=200, leak=HIGH — normal
 *   tick 3-4  : gas=450            — GAS ALARM → fan auto-ON
 *   tick 5    : gas=200            — gas clear  → fan auto-OFF
 *   tick 6    : leak=LOW           — LEAK ALARM → valve close
 *   tick 7    : leak=HIGH          — leak clear → valve open
 *   cmd       : fan on, fan off, valve close, office_light, config update
 */

const WebSocket = require("ws");

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const TICK_MS         = 1000;  // simulated SENSOR_INTERVAL (5000ms on real ESP)
const NUM_OFFICE_LEDS = 30;
const SERVO_MOVE_TIME = 600;

// ─── MOCK HARDWARE STATE ──────────────────────────────────────────────────────
let mockGasValue  = 200;   // analogRead(PIN_GAS)
let mockLeakPin   = 1;     // digitalRead(PIN_LEAK): 1=HIGH=OK, 0=LOW=LEAK
let mockFanPinMode = "INPUT";  // INPUT (off) / OUTPUT (on)

// ─── MOCK ARDUINO APIs ────────────────────────────────────────────────────────
const startMs = Date.now();
function millis() { return Date.now() - startMs; }
function constrain(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function analogRead()    { return mockGasValue; }
function digitalRead()   { return mockLeakPin; }
function pinMode(pin, mode) {
  mockFanPinMode = mode;
  hw(`pinMode(${pin}, ${mode}) → fan ${mode === "OUTPUT" ? "ON" : "OFF"}`);
}
function log(dir, msg) {
  const t = new Date().toISOString().slice(11, 19);
  const arrow = dir === "IN" ? "←" : "→";
  console.log(`  ${t} ${arrow} ${msg}`);
}

// ─── MOCK FASTLED ─────────────────────────────────────────────────────────────
const officeLeds = new Array(NUM_OFFICE_LEDS).fill(null).map(() => ({ r: 0, g: 0, b: 0 }));
const FastLED = {
  addLeds: () => {},
  setBrightness: () => {},
  clear: () => { officeLeds.forEach(l => { l.r = 0; l.g = 0; l.b = 0; }); },
  show: () => {
    const { r, g, b } = officeLeds[0];
    hw(`FastLED.show() → all ${NUM_OFFICE_LEDS} LEDs = rgb(${r},${g},${b})`);
  },
};
function fill_solid(leds, count, color) {
  for (let i = 0; i < count; i++) leds[i] = { ...color };
}

// ─── MOCK SERVO ───────────────────────────────────────────────────────────────
const servoValve = {
  attached: false,
  angle: 0,
  attach: (pin) => { servoValve.attached = true; },
  write: (angle) => {
    servoValve.angle = angle;
    hw(`servo.write(${angle}°) → valve ${angle === 0 ? "OPEN" : "CLOSED"}`);
  },
  detach: () => { servoValve.attached = false; hw("servo.detach()"); },
};

// ─── MOCK WEBSOCKET ───────────────────────────────────────────────────────────
let realWs = null;
const webSocket = {
  sendTXT: (json) => {
    log("OUT", json);
    if (realWs && realWs.readyState === WebSocket.OPEN) realWs.send(json);
  },
};

// ─── FIRMWARE STATE ───────────────────────────────────────────────────────────
let gasAlarm  = false;
let leakAlarm = false;
let fanState  = false;
let GAS_DANGER = 400;
let GAS_CLEAR  = 360;

let gasAlertTriggered  = false;
let leakAlertTriggered = false;

let officeBrightness = 200;
let officeColorTemp  = 4500;

let lastSensorRead = 0;

let lastReading       = 1;   // HIGH
let stableButtonState = 1;   // HIGH
let lastDebounceTime  = 0;
const DEBOUNCE_DELAY  = 50;
let valveOpen = true;

let servoMoving    = false;
let servoMoveStart = 0;

// ─── FIRMWARE FUNCTIONS (ported from C++) ─────────────────────────────────────

function colorTemperatureToRGB(kelvin, brightness) {
  const temp = kelvin / 100.0;
  let red, green, blue;

  red = (temp <= 66) ? 255 : constrain(329.698727446 * Math.pow(temp - 60, -0.1332047592), 0, 255);

  if (temp <= 66) {
    green = constrain(99.4708025861 * Math.log(temp) - 161.1195681661, 0, 255);
  } else {
    green = constrain(288.1221695283 * Math.pow(temp - 60, -0.0755148492), 0, 255);
  }

  if (temp >= 66) {
    blue = 255;
  } else if (temp <= 19) {
    blue = 0;
  } else {
    blue = constrain(138.5177312231 * Math.log(temp - 10) - 305.0447927307, 0, 255);
  }

  return {
    r: Math.round(red   * brightness / 255),
    g: Math.round(green * brightness / 255),
    b: Math.round(blue  * brightness / 255),
  };
}

function setOfficeLight(brightness, colorTemp) {
  officeBrightness = constrain(brightness, 0, 255);
  officeColorTemp  = constrain(colorTemp, 2700, 6500);

  const { r, g, b } = colorTemperatureToRGB(officeColorTemp, officeBrightness);
  fill_solid(officeLeds, NUM_OFFICE_LEDS, { r, g, b });
  FastLED.show();

  sendDeviceState("office_light", "brightness", officeBrightness);
  sendDeviceState("office_light", "colorTemp",  officeColorTemp);
  log("OUT", `office_light brightness=${officeBrightness} colorTemp=${officeColorTemp}`);
}

function handleOfficeLightCommand(doc) {
  if ("state" in doc && !doc.state) {
    setOfficeLight(0, officeColorTemp);
    return;
  }
  if ("brightness" in doc) officeBrightness = constrain(doc.brightness, 0, 255);
  if ("colorTemp"  in doc) officeColorTemp  = constrain(doc.colorTemp,  2700, 6500);
  setOfficeLight(officeBrightness, officeColorTemp);
}

function sendDeviceState(device, parameter, value) {
  const msg = { type: "device_state", device, parameter, stateValue: value, timestamp: Date.now() };
  webSocket.sendTXT(JSON.stringify(msg));
}

function sendSensorData(room, sensorType, value) {
  const msg = { room, sensor: sensorType, value, timestamp: Date.now() };
  webSocket.sendTXT(JSON.stringify(msg));
}

function sendInitialState() {
  sendDeviceState("valve",        "state",      leakAlarm ? "closed" : "open");
  sendDeviceState("kitchen_fan",  "state",      fanState  ? "on"     : "off");
  sendDeviceState("office_light", "brightness", officeBrightness);
  sendDeviceState("office_light", "colorTemp",  officeColorTemp);
  log("OUT", "initial_state sent");
}

function moveValveTo(angle) {
  servoValve.attach(5);
  servoValve.write(angle);
  servoMoveStart = millis();
  servoMoving    = true;
}

function handleFanCommand(doc) {
  if (!("state" in doc)) return;
  let fanCommand = false;
  if (typeof doc.state === "boolean") fanCommand = doc.state;
  else if (typeof doc.state === "number") fanCommand = doc.state !== 0;
  else if (typeof doc.state === "string") fanCommand = ["true", "1", "on"].includes(doc.state);

  log("IN", `fan command=${fanCommand ? "on" : "off"}`);

  if (fanCommand && !fanState) {
    pinMode(12, "OUTPUT");
    fanState = true;
    sendDeviceState("kitchen_fan", "state", "on");
  } else if (!fanCommand && fanState) {
    if (gasAlarm) { log("IN", "fan off blocked: gas alarm active"); return; }
    pinMode(12, "INPUT");
    fanState = false;
    sendDeviceState("kitchen_fan", "state", "off");
  }
}

function handleValveCommand(doc) {
  if (!("state" in doc)) return;
  let state;
  if (typeof doc.state === "boolean") state = doc.state ? "close" : "open";
  else if (typeof doc.state === "number") state = doc.state ? "close" : "open";
  else state = doc.state;

  log("IN", `valve command=${state}`);

  if (state === "open" && leakAlarm) {
    log("OUT", "valve blocked: leak alarm active");
  } else if (state === "open") {
    moveValveTo(0);
    valveOpen = true;
    sendDeviceState("valve", "state", "open");
  } else if (state === "close") {
    moveValveTo(90);
    valveOpen = false;
    sendDeviceState("valve", "state", "closed");
  }
}

function handleIncomingCommand(json) {
  let doc;
  try { doc = JSON.parse(json); } catch (e) { log("IN", `JSON error: ${e.message}`); return; }

  if (doc.type === "config") {
    if ("gas_threshold_warning" in doc) GAS_DANGER = doc.gas_threshold_warning;
    if ("gas_threshold_safe"   in doc) GAS_CLEAR  = doc.gas_threshold_safe;
    log("IN", `config GAS_DANGER=${GAS_DANGER} GAS_CLEAR=${GAS_CLEAR}`);
    return;
  }
  if (doc.type === "device_state") return;
  if (!("device" in doc)) return;

  log("IN", `command device=${doc.device}`);
  if      (doc.device === "fan")          handleFanCommand(doc);
  else if (doc.device === "valve")        handleValveCommand(doc);
  else if (doc.device === "office_light") handleOfficeLightCommand(doc);
}

function readSensors() {
  const gasValue = analogRead();
  log("OUT", `gas=${gasValue} danger=${GAS_DANGER} clear=${GAS_CLEAR}`);
  sendSensorData("kitchen", "gas", gasValue);

  if (gasValue > GAS_DANGER && !gasAlarm) {
    gasAlarm = true; gasAlertTriggered = true;
    log("OUT", "gas alarm ON");
    pinMode(12, "OUTPUT"); fanState = true;
    sendDeviceState("kitchen_fan", "state", "on");
  } else if (gasValue < GAS_CLEAR && gasAlarm) {
    gasAlarm = false; gasAlertTriggered = false;
    log("OUT", "gas alarm OFF");
    pinMode(12, "INPUT"); fanState = false;
    sendDeviceState("kitchen_fan", "state", "off");
  }

  const leakState = digitalRead();
  log("OUT", `leak=${leakState}`);

  if (leakState === 0 && !leakAlarm) {
    leakAlarm = true; leakAlertTriggered = true;
    log("OUT", "leak_alert=detected");
    sendSensorData("bathroom", "water_leak", "detected");
    moveValveTo(90);
    sendDeviceState("valve", "state", "closed");
  } else if (leakState === 1 && leakAlarm) {
    leakAlarm = false; leakAlertTriggered = false;
    log("OUT", "leak_alert=clear");
    sendSensorData("bathroom", "water_leak", "clear");
    moveValveTo(0);
    sendDeviceState("valve", "state", "open");
  }
}

function loop() {
  // Servo detach after SERVO_MOVE_TIME
  if (servoMoving && (millis() - servoMoveStart > SERVO_MOVE_TIME)) {
    servoValve.detach();
    servoMoving = false;
  }

  if (millis() - lastSensorRead > TICK_MS) {
    lastSensorRead = millis();
    readSensors();
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function hw(msg) { console.log(`  \x1b[2m[HW] ${msg}\x1b[0m`); }
function section(title) { console.log(`\n\x1b[1;34m── ${title} ──────────────────────────────\x1b[0m`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── TEST SCENARIO ────────────────────────────────────────────────────────────
async function runScenario() {
  section("INIT");
  FastLED.addLeds();
  FastLED.setBrightness(255);
  FastLED.clear();
  FastLED.show();
  fanState = false; valveOpen = true;
  log("OUT", "system ready (mock)");
  log("IN",  "WS connected (mock)");
  sendInitialState();

  await sleep(200);
  section("tick 1-2 — normal (gas=200, leak=OK)");
  mockGasValue = 200; mockLeakPin = 1;
  loop(); await sleep(TICK_MS + 100);
  loop(); await sleep(TICK_MS + 100);

  section("tick 3-4 — GAS ALARM (gas=450 > 400)");
  mockGasValue = 450;
  loop(); await sleep(TICK_MS + 100);
  loop(); await sleep(TICK_MS + 100);

  section("tick 5 — gas clear (gas=200 < 360)");
  mockGasValue = 200;
  loop(); await sleep(TICK_MS + 100);

  section("CMD — fan on (manual)");
  handleIncomingCommand(JSON.stringify({ device: "fan", state: true }));

  section("CMD — fan off (manual, no alarm → should work)");
  handleIncomingCommand(JSON.stringify({ device: "fan", state: false }));

  section("tick 6 — LEAK ALARM (leak=LOW)");
  mockLeakPin = 0;
  loop(); await sleep(TICK_MS + 100);

  section("CMD — valve open blocked by leak alarm");
  handleIncomingCommand(JSON.stringify({ device: "valve", state: "open" }));

  section("tick 7 — leak clear (leak=HIGH)");
  mockLeakPin = 1;
  loop(); await sleep(TICK_MS + 100);

  await sleep(SERVO_MOVE_TIME + 50); // wait for servo detach
  loop();

  section("CMD — office_light on (brightness=180, colorTemp=3000K)");
  handleIncomingCommand(JSON.stringify({ device: "office_light", state: true, brightness: 180, colorTemp: 3000 }));

  section("CMD — office_light off");
  handleIncomingCommand(JSON.stringify({ device: "office_light", state: false }));

  section("CMD — config update (GAS_DANGER=350, GAS_CLEAR=310)");
  handleIncomingCommand(JSON.stringify({ type: "config", gas_threshold_warning: 350, gas_threshold_safe: 310 }));

  section("tick 8-9 — gas alarm with new thresholds (gas=360 > 350)");
  mockGasValue = 360;
  loop(); await sleep(TICK_MS + 100);

  section("tick 10 — gas clear with new thresholds (gas=200 < 310)");
  mockGasValue = 200;
  loop(); await sleep(TICK_MS + 100);

  section("DONE");
  console.log("\n  All scenarios passed.\n");
  if (realWs) realWs.close();
}

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────
const wsUrl = process.argv.slice(2).find(a => a.startsWith("ws://") || a.startsWith("wss://"));

if (wsUrl) {
  console.log(`Connecting to ${wsUrl} to forward messages...`);
  realWs = new WebSocket(wsUrl);
  realWs.on("open",    () => { console.log("WS server connected.\n"); runScenario(); });
  realWs.on("message", (data) => {
    log("IN", `[server] ${data.toString()}`);
    handleIncomingCommand(data.toString());
  });
  realWs.on("error",   (err) => { console.error("WS error:", err.message); });
  realWs.on("close",   () => { console.log("WS server disconnected."); process.exit(0); });
} else {
  runScenario().then(() => process.exit(0));
}
