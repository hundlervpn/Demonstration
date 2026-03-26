/**
 * RGB Strip Test Client
 *
 * Sends a sequence of office_light commands to test WS2812B strip behavior.
 * Each step has a label and a 2-second pause so you can visually verify the result.
 *
 * Usage:
 *   node scripts/test-rgb-strip.js                   # Connect to localhost:3001
 *   node scripts/test-rgb-strip.js ws://192.168.x.x:3001
 *
 * Steps:
 *   1. Full white (max brightness, 4000K) — strips shows WHITE
 *   2. Warm (2700K, 55%)               — warm amber-white
 *   3. Cold (6500K, 85%)               — cold daylight white
 *   4. Dim (2700K, 10%)                — barely visible warm glow
 *   5. Focus preset (5500K, 86%)       — same as "Фокус" mode
 *   6. Rest preset  (2700K, 55%)       — same as "Отдых" mode
 *   7. OFF                              — strip goes dark
 */

const WebSocket = require("ws");

const DEFAULT_WS_URL = "ws://localhost:3001";
const STEP_DELAY_MS  = 2000;

const args   = process.argv.slice(2);
const ws_url = args.find((a) => a.startsWith("ws://") || a.startsWith("wss://")) || DEFAULT_WS_URL;

const STEPS = [
  { label: "Full white  — 255br / 4000K", state: true,  brightness: 255, colorTemp: 4000 },
  { label: "Warm        — 140br / 2700K", state: true,  brightness: 140, colorTemp: 2700 },
  { label: "Cold        — 220br / 6500K", state: true,  brightness: 220, colorTemp: 6500 },
  { label: "Dim         —  25br / 2700K", state: true,  brightness:  25, colorTemp: 2700 },
  { label: "Focus preset— 220br / 5500K", state: true,  brightness: 220, colorTemp: 5500 },
  { label: "Rest preset — 140br / 2700K", state: true,  brightness: 140, colorTemp: 2700 },
  { label: "OFF",                          state: false },
];

function send(ws, step) {
  const cmd = {
    type:   "device_command",
    device: "office_light",
    action: "set_state",
    state:  step.state,
  };
  if (step.state && step.brightness !== undefined) cmd.brightness = step.brightness;
  if (step.state && step.colorTemp  !== undefined) cmd.colorTemp  = step.colorTemp;

  ws.send(JSON.stringify(cmd));
  const detail = step.state
    ? `brightness=${step.brightness} colorTemp=${step.colorTemp}K`
    : "state=false";
  console.log(`  -> ${step.label.padEnd(32)} [${detail}]`);
}

function runSteps(ws) {
  let i = 0;

  function next() {
    if (i >= STEPS.length) {
      console.log("\nAll steps done. Closing...");
      ws.close();
      return;
    }
    const step = STEPS[i++];
    console.log(`\nStep ${i}/${STEPS.length}`);
    send(ws, step);
    setTimeout(next, STEP_DELAY_MS);
  }

  next();
}

console.log(`Connecting to ${ws_url} ...`);
const ws = new WebSocket(ws_url);

ws.on("open", () => {
  console.log("Connected.\n");
  console.log("Each step lasts 2 seconds. Watch the strip:\n");
  runSteps(ws);
});

ws.on("message", (data) => {
  try {
    const msg = JSON.parse(data.toString());
    // Only print device_state replies to reduce noise
    if (msg.type === "device_state" && msg.device === "office_light") {
      console.log(`   <- ESP: ${msg.parameter}=${msg.stateValue}`);
    }
  } catch {
    // ignore
  }
});

ws.on("error",  (err)  => { console.error("WS error:", err.message); process.exit(1); });
ws.on("close",  ()     => { console.log("Connection closed."); process.exit(0); });

process.on("SIGINT", () => { ws.close(); });
