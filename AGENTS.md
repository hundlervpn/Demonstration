# Smart Home Server

Next.js application for Smart Home control panel with ESP8266 sensor integration via WebSocket.

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Animations:** Motion
- **Communication:** WebSocket (real-time bidirectional)
- **Hardware:** ESP8266 (MQ-2 gas sensor, PIR motion sensor, DHT11 temp/humidity, water leak)

## Architecture

**Not a Single Page Application (SPA).** This is a **Next.js App Router** application with:

- **Server Components** — Rendered on server (SSR/SSG), no client-side JavaScript
- **Client Components** — Rendered in browser with hooks, state, events (`"use client"`)
- **File-based Routing** — Each `page.tsx` is a separate route, not client-side navigation
- **WebSocket Server** — Separate Node.js server for real-time sensor communication

### Data Flow

```
ESP8266 Sensors
     │
     │ WebSocket (sensor data: gas, motion, temp, humidity, water_leak)
     ▼
WebSocket Server (port 3001)
     │
     │ Store in memory + Broadcast
     ▼
sensor-store.ts (Map)
     │
     │ Real-time WebSocket updates
     ▼
useSensorData hooks
     │
     │ React state update
     ▼
UI Components (re-render)


Client (Browser)
     │
     │ WebSocket (device_command: fan on/off, light control)
     ▼
WebSocket Server (port 3001)
     │
     │ Forward to ESP device
     ▼
ESP8266 Device
     │
     │ Execute command + broadcast new state
     ▼
WebSocket Server
     │
     │ Broadcast (device_state)
     ▼
useDeviceState hooks
     │
     │ React state update
     ▼
UI Components (re-render)
```

## Running the Application

### Docker (Recommended)

```bash
# Build Docker image
docker build -t smart-home .

# Run container
docker run -p 3000:3000 -p 3001:3001 smart-home
```

Docker runs both Next.js (port 3000) and WebSocket server (port 3001).

### Development

```bash
npm run dev:all
```

Runs both Next.js (port 3000) and WebSocket server (port 3001).

```bash
npm run dev:all:cv
```

Same as above **plus** the CV client (camera + face recognition). Requires conda env `guard` with `face_recognition`, `ultralytics`, `opencv-python`, `websockets` installed. The Python binary is called directly — no `conda run` wrapper — to keep stdout visible in `concurrently`.

### Production

```bash
npm run build
npm run start          # Next.js on port 3000
npm run ws-server      # WebSocket on port 3001
```

## ESP Integration

### Firmware Files

| File | ESP | Sensors / Devices |
|------|-----|-------------------|
| `.temp/kitchen_bathroom_new.cpp` | ESP8266 NodeMCU | MQ-2 gas, water leak, servo valve, kitchen fan (relay), office RGB strip |
| `.temp/hallway_office_new.cpp` | ESP8266 NodeMCU | PIR motion, DHT11 temp/humidity |

### WebSocket Connection

**URL:** `ws://YOUR_SERVER_IP:3001`

**Arduino Libraries Required:**
- `WebSocketsClient` by Markus Sattler
- `ArduinoJson`, `FastLED`, `Servo`, `NTPClient`

**Message Format (ESP → Server):**
```json
{
  "room": "kitchen",
  "sensor": "gas",
  "value": 250,
  "timestamp": 12345678,
  "api_key": "optional-api-key"
}
```

**Fields:**
- `room` — `kitchen`, `hallway`, `bathroom`, `office`, `street`
- `sensor` — `gas`, `motion`, `temperature`, `humidity`, `water_leak`
- `value` — sensor reading (number, string: `"detected"`, `"clear"`, or boolean)
- `timestamp` — milliseconds since boot (optional, auto-generated if omitted)
- `api_key` — API key if authentication is enabled (optional)

### Server → ESP: Config on Connect

On every WebSocket connection the server sends gas thresholds so ESP stays in sync with `sensor-store.ts`:
```json
{ "type": "config", "gas_threshold_safe": 360, "gas_threshold_warning": 400 }
```
ESP updates `GAS_CLEAR` / `GAS_DANGER` globals from this message. Default values in firmware match server defaults — safe fallback if config is not received.

### Fan Relay Hardware Notes (kitchen_bathroom ESP)

Pin: `GPIO12 / D6`. Relay module uses **open-collector** input — ESP can't source enough current for `digitalWrite(HIGH)`.

| `pinMode` call | Pin state | Relay | Fan |
|---|---|---|---|
| `OUTPUT` | LOW (sinks current) | ON | **ВКЛ** |
| `INPUT` | float (high-Z) | OFF | **ВЫКЛ** |

At boot: `pinMode(INPUT)` — fan stays OFF. Never use `digitalWrite` on this pin.

### WebSocket Callback Constraints (ESP8266)

**Never call `webSocket.sendTXT()` from within the `WStype_CONNECTED` callback.**

The `WebSocketsClient` library fires `WStype_CONNECTED` from inside `webSocket.loop()`, which still holds the TCP send buffer. Calling `sendTXT()` there corrupts internal state → connection drops within milliseconds → 5-second reconnect loop.

**Correct pattern — deferred flag:**
```cpp
bool pendingInitialState = false;

void webSocketEvent(WStype_t type, ...) {
  case WStype_CONNECTED:
    pendingInitialState = true;   // ← set flag only
    break;
}

void loop() {
  webSocket.loop();
  if (pendingInitialState) {      // ← send safely after loop() returns
    pendingInitialState = false;
    sendInitialState();
  }
}
```

**Symptom of the bug:** Serial shows `WS connected` immediately followed by `WS disconnected` with no error, cycling every ~5 seconds. No `device_command` messages ever reach handlers.

### RGB Strip (WS2812B) — WiFi Interference Fix

FastLED uses bit-banging on ESP8266 — WiFi interrupts during `FastLED.show()` corrupt the signal and only the first LED updates correctly.

**Fix:** define before the include — already applied in firmware:
```cpp
#define FASTLED_ALLOW_INTERRUPTS 0
#include <FastLED.h>
```

**Always yield before and after `show()`** to let WiFi finish pending operations:
```cpp
yield();
FastLED.show();
yield();
```

**Diagnostic self-test pattern** — put in `setup()` before `connectToWiFi()` to confirm hardware is OK independently of WiFi:
```cpp
fill_solid(officeLeds, NUM_OFFICE_LEDS, CRGB(255, 0, 0));
FastLED.show();
delay(500);            // all 30 LEDs should be red; if only LED[0] → wiring/power issue
FastLED.clear();
FastLED.show();
```

### Room to Device Mapping

| Room | Device ID | Sensors | Devices |
|------|-----------|---------|---------|
| `kitchen` | `esp_kitchen_01` | MQ-2 (gas) | `kitchen_fan`, `office_light`, `valve` |
| `hallway` | `esp_hallway_01` | PIR (motion) | — |
| `bathroom` | `esp_bathroom_01` | water_leak | `valve` |
| `office` | `esp_office_01` | DHT11 (temp, humidity) | `humidifier` |
| `street` | `esp_street_01` | Camera | — |

Multiple devices can share one ESP connection. `office_light` and `valve` are registered when `kitchen` sensor data arrives (same physical ESP).

### Device Control

**Client → Server:**
```json
{"type": "device_command", "device": "kitchen_fan", "action": "set_state", "state": true}
{"type": "device_command", "device": "valve", "action": "set_state", "state": false}
{"type": "device_command", "device": "office_light", "action": "set_state", "state": true, "brightness": 80, "colorTemp": 4000}
```

**Server → ESP:**
```json
{"device": "fan", "state": true}
{"device": "valve", "state": "open"}
{"device": "office_light", "state": true, "brightness": 80, "colorTemp": 4000}
```

Note: `valve` maps `state: true → "close"`, `state: false → "open"` (safety default = open).

**Server → Client:** `{type: "device_state", device: "kitchen_fan", value: "on"}`

Use `useDeviceState("kitchen_fan")` hook for control.

## Project Structure

```
Smart-Home/
├── server/
│   └── websocket-server.ts       # Standalone WebSocket server (port 3001)
├── scripts/
│   └── test-websocket-client.js  # WebSocket test client for testing
├── faces/                        # Face images for recognition (gitignored *.jpg/png/jpeg)
├── data/                         # Runtime data: events.json, faces.json (gitignored)
├── cv-websocket-client.py        # CV client: YOLO + face recognition, streams to WS
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── faces/
│   │   │   │   └── route.ts      # Face profiles CRUD (multipart upload, image storage)
│   │   │   └── ws-sensors/
│   │   │       └── route.ts      # API route (if needed)
│   │   ├── bathroom/
│   │   │   └── page.tsx          # Bathroom room page
│   │   ├── events/
│   │   │   └── page.tsx          # Event log page
│   │   ├── hallway/
│   │   │   └── page.tsx          # Hallway room page (motion sensor)
│   │   ├── kitchen/
│   │   │   └── page.tsx          # Kitchen page with gas sensor display
│   │   ├── office/
│   │   │   └── page.tsx          # Office room page
│   │   ├── settings/
│   │   │   └── page.tsx          # Settings page (face management, thresholds)
│   │   ├── street/
│   │   │   └── page.tsx          # Street/outdoor sensors + camera feed
│   │   ├── globals.css           # Global styles
│   │   ├── layout.tsx            # Root layout
│   │   └── page.tsx              # Main dashboard
│   ├── components/
│   │   ├── Main page/            # Dashboard cards
│   │   ├── PageTransition.tsx    # Page transition wrapper
│   │   └── TopBar.tsx            # Top navigation bar
│   ├── hooks/
│   │   └── useSensorData.ts      # React hooks for WebSocket (useGasSensor, useDeviceState, useSensorData)
│   └── lib/
│       ├── face-db.ts            # Face profile storage (JSON, CRUD)
│       ├── event-store.ts        # Event log storage
│       ├── sensor-store.ts       # Sensor data + gas thresholds
│       └── telegram.ts           # Telegram alert sender
├── .env                          # Environment variables
├── README.md                     # Project documentation
├── next.config.ts                # Next.js configuration
├── package.json                  # Dependencies
└── tsconfig.json                 # TypeScript configuration
```

## Testing

### WebSocket Test Client

Test client script for simulating ESP8266 sensor data transmission.

**Location:** `scripts/test-websocket-client.js`

**Usage:**
```bash
# Single test (6 messages, then exit)
npm run test:ws

# Infinite test (repeats cycles until Ctrl+C)
npm run test:ws -- --infinite

# Custom WebSocket URL
node scripts/test-websocket-client.js ws://192.168.1.100:3001

# Custom URL + infinite mode
node scripts/test-websocket-client.js ws://192.168.1.100:3001 --infinite
```

**Output:** Sends test messages and displays all received WebSocket messages in real-time.

## Key Files

| File | Purpose |
|------|---------|
| `server/websocket-server.ts` | WebSocket server (port 3001) |
| `cv-websocket-client.py` | CV client: YOLO detection + face recognition, streams frames |
| `src/hooks/useSensorData.ts` | React hooks: useGasSensor, useDeviceState, useSensorData |
| `src/lib/sensor-store.ts` | Sensor state map + gas thresholds (GAS_THRESHOLD_SAFE/WARNING) |
| `src/lib/face-db.ts` | Face profile CRUD persisted to data/faces.json |
| `src/app/api/faces/route.ts` | REST API: add/delete face profiles with image file management |
| `src/app/kitchen/page.tsx` | Kitchen: gas sensor + fan control |
| `src/app/office/page.tsx` | Office: DHT11 temperature/humidity |
| `src/app/hallway/page.tsx` | Hallway: motion sensor |
| `src/components/Office/` | Office components (ClimateIndicators, ManualControls) |

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `WS_PORT` | WebSocket server port | `3001` | No |
| `WS_HOST` | WebSocket server host | `0.0.0.0` | No |
| `SENSOR_API_KEY` | API key for ESP authentication | — | No |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL for client | `ws://localhost:3001` | No |

## CV Client (`cv-websocket-client.py`)

Python script that reads from a webcam, runs YOLO person detection + face recognition, and streams annotated frames to the WS server.

### Python Environment

Uses conda env `guard`. The package.json `cv-client` script calls the binary directly:
```
/opt/homebrew/Caskroom/miniconda/base/envs/guard/bin/python -u cv-websocket-client.py
```

The `-u` flag disables Python's stdout buffering so `print()` output appears in `concurrently` in real time. **Do not replace with `conda run`** — it captures subprocess stdout regardless of flags.

### How it Works

1. At startup: loads face encodings from `faces/` directory into memory
2. Connects to WS server at `WS_URL` (default `ws://localhost:3001`)
3. Starts `listen_for_commands(ws)` as a background asyncio task
4. Main loop: reads frames → YOLO detect persons → face_recognition per person → annotate frame → `ws.send(video_frame)`
5. At the end of every loop iteration: `await asyncio.sleep(0)` yields control back to the event loop so `listen_for_commands` can process queued messages

### `reload_faces` Hot-Reload

When a face is added/deleted via `/api/faces`, the server broadcasts `{type: "reload_faces"}` to all clients. The CV client's `listen_for_commands` coroutine receives this and calls `load_faces()` immediately — no restart needed.

**Critical:** the `await asyncio.sleep(0)` at the end of the main loop is what makes this work. Without it, `cap.read()` + YOLO inference block the event loop entirely and `listen_for_commands` never runs.

### WS Message Types (CV Client ↔ Server)

**CV → Server:**
```json
{"type": "video_frame", "room": "street", "data": "<base64-jpg>", "timestamp": 123}
{"room": "street", "sensor": "face_recognition", "value": "Denis", "timestamp": 123}
```

**Server → CV:**
```json
{"type": "reload_faces", "timestamp": "..."}
{"type": "config", "gas_threshold_safe": 360, "gas_threshold_warning": 400}
{"type": "initial", "data": {...}}
```

`video_frame` messages are forwarded by the server to all clients **except the sender** — so the CV client never receives its own frames back.

## Face Management API

`GET /api/faces` — list all profiles.

`POST /api/faces` — add profile (multipart/form-data):
- `file` — face image (jpg/png/jpeg), saved to `faces/<name>.<ext>`
- `name` — display name (auto-derived from filename if omitted)
- `role` — `"resident"` | `"guest"`

On image save the server sends `{type: "reload_faces"}` over WebSocket → broadcast to all clients → CV client calls `load_faces()` to hot-reload encodings without restart.

`DELETE /api/faces?id=<id>` — remove profile + image file. Also triggers `reload_faces`.

## Security

- **API Key** — Set `SENSOR_API_KEY` in `.env` for authentication
- **Validation** — Server validates all incoming data

## Git Branch Naming

- Feature branches use appropriate prefixes: `feature/`, `bugfix/`, `hotfix/`
- Quint reasoning branches use same prefixes as corresponding features (e.g., `feature/cv-integration`)
- Worktrees stored in `.worktrees/<name>` (without prefix duplication)

Examples:
- CV integration → `feature/cv-integration` branch, `.worktrees/cv-integration` tree
- Robot identification → `feature/robot-integration` branch, `.worktrees/robot-integration` tree
 