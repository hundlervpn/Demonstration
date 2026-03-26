import cv2
import face_recognition
import os
import sys
import json
import asyncio
import websockets
import base64
from datetime import datetime
from ultralytics import YOLO

# Configuration
WS_URL = os.getenv("WS_URL", "ws://localhost:3001")
ROOM = "street"
DEVICE_ID = "esp_street_01"
SENSOR_TYPE = "face_recognition"

# Face database location
FACES_DIR = "faces"

# Throttling: only send when face name changes
last_sent_name = None
last_sent_time = 0
MIN_SEND_INTERVAL = 2  # Minimum seconds between same-name messages

# Face database state
known_encodings = []
known_names = []

def load_faces():
    """Load (or reload) face encodings from faces directory"""
    global known_encodings, known_names

    if not os.path.exists(FACES_DIR):
        os.makedirs(FACES_DIR)

    loaded_encodings = []
    loaded_names = []
    for file in os.listdir(FACES_DIR):
        if file.endswith(('.jpg', '.png', '.jpeg')):
            img = face_recognition.load_image_file(f"{FACES_DIR}/{file}")
            encs = face_recognition.face_encodings(img)
            if encs:
                loaded_encodings.append(encs[0])
                loaded_names.append(os.path.splitext(file)[0].capitalize())

    known_encodings = loaded_encodings
    known_names = loaded_names
    print(f"[FaceDB] Loaded. Database contains: {known_names}", flush=True)

print("Loading face database...", flush=True)
load_faces()
print(f"Ready! Database contains: {known_names}", flush=True)

# Initialize YOLO and camera
model = YOLO('yolov8n.pt')
cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("ERROR: Cannot open camera (index 0)")
    sys.exit(1)

count = 0
current_faces = []

async def send_face_event(websocket, name):
    """Send face recognition event to WebSocket server"""
    global last_sent_name, last_sent_time

    timestamp = int(datetime.now().timestamp() * 1000)
    current_time = timestamp / 1000

    # Throttling: only send if name changed or enough time passed
    if name == last_sent_name and (current_time - last_sent_time) < MIN_SEND_INTERVAL:
        return

    message = {
        "room": ROOM,
        "sensor": SENSOR_TYPE,
        "value": name,
        "timestamp": timestamp
    }

    try:
        await websocket.send(json.dumps(message))
        print(f"[WebSocket] Sent face event: {name}", flush=True)
        last_sent_name = name
        last_sent_time = current_time
    except Exception as e:
        print(f"[WebSocket] Error sending message: {e}")

async def listen_for_commands(ws):
    """Listen for incoming server commands (e.g. reload_faces)"""
    try:
        async for raw in ws:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if msg.get("type") == "reload_faces":
                print("[FaceDB] Reload command received, reloading...", flush=True)
                try:
                    load_faces()
                except Exception as e:
                    print(f"[FaceDB] Reload error: {e}", flush=True)
    except Exception as e:
        print(f"[WebSocket] Listener stopped: {e}", flush=True)

async def reconnect_with_backoff(url, max_attempts=10):
    """Reconnect with exponential backoff"""
    for attempt in range(1, max_attempts + 1):
        try:
            print(f"[WebSocket] Attempting to connect (attempt {attempt}/{max_attempts})...", flush=True)
            ws = await websockets.connect(url)
            print(f"[WebSocket] Connected to server", flush=True)
            return ws
        except Exception as e:
            wait_time = min(2 ** attempt, 30)  # Max 30 seconds
            print(f"[WebSocket] Connection failed: {e}. Retrying in {wait_time}s...", flush=True)
            await asyncio.sleep(wait_time)

    print("[WebSocket] Max reconnection attempts reached", flush=True)
    return None

async def main():
    """Main async loop for WebSocket and camera processing"""
    global current_faces, count

    ws = await reconnect_with_backoff(WS_URL)
    if not ws:
        print("[ERROR] Could not connect to WebSocket server")
        return

    listener_task = asyncio.create_task(listen_for_commands(ws))
    last_detected_name = None

    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            break

        # PROCESSING (every 3 frames for performance)
        if count % 3 == 0:
            new_faces = []
            results = model(frame, classes=[0], verbose=False)

            for res in results[0].boxes:
                x1, y1, x2, y2 = map(int, res.xyxy[0])

                # Look for face only in upper body (save time)
                face_roi = frame[y1:y1+(y2-y1)//2, x1:x2]
                if face_roi.size > 0:
                    rgb_roi = cv2.cvtColor(face_roi, cv2.COLOR_BGR2RGB)
                    face_locs = face_recognition.face_locations(rgb_roi, model="hog")

                    name = "CHUZHOY"

                    # If face found, get coordinates relative to full frame
                    if face_locs:
                        top, right, bottom, left = face_locs[0]
                        # Adjust face coordinates relative to full frame
                        l_top, l_right, l_bottom, l_left = y1+top-100, x1+right+100, y1+bottom+100, x1+left-100

                        face_enc = face_recognition.face_encodings(rgb_roi, face_locs)[0]
                        matches = face_recognition.compare_faces(known_encodings, face_enc, tolerance=0.6)
                        if True in matches:
                            name = known_names[matches.index(True)]

                        # Save small frame around face
                        new_faces.append(((l_top, l_right, l_bottom, l_left), name))
                    else:
                        # If face not visible, draw small mark above head
                        new_faces.append(((y1, x1+20, y1+20, x1), "Searching..."))

            current_faces = new_faces

        # RENDERING (every frame - removes flicker)
        for (top, right, bottom, left), name in current_faces:
            color = (0, 255, 0) if name != "CHUZHOY" and name != "Searching..." else (0, 0, 255)

            # Draw small frame around face
            cv2.rectangle(frame, (left, top), (right, bottom), color, 2)

            # Beautiful signature below frame
            cv2.rectangle(frame, (left, bottom), (right, bottom + 25), color, cv2.FILLED)
            cv2.putText(frame, name, (left + 5, bottom + 18), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

        count += 1

        # Send video frame every 3rd frame (~10 FPS)
        if count % 3 == 0:
            try:
                _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
                frame_base64 = base64.b64encode(buffer).decode('utf-8')
                video_message = {
                    "type": "video_frame",
                    "room": ROOM,
                    "data": frame_base64,
                    "timestamp": int(datetime.now().timestamp() * 1000)
                }
                await ws.send(json.dumps(video_message))
            except Exception as e:
                print(f"[WebSocket] Error sending video frame: {e}", flush=True)

        # Check for face changes and send WebSocket message
        if current_faces:
            # Get first detected face name
            detected_name = current_faces[0][1]

            # Send if name changed
            if detected_name != last_detected_name and detected_name != "Searching...":
                await send_face_event(ws, detected_name)
                last_detected_name = detected_name
        elif last_detected_name is not None:
            # No face detected now, but we had one before
            await send_face_event(ws, "Searching...")
            last_detected_name = None

        # Yield to event loop — allows listen_for_commands to process incoming messages
        await asyncio.sleep(0)

    cap.release()
    listener_task.cancel()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[Shutdown] Stopping...")
    except Exception as e:
        print(f"\n[ERROR] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        cap.release()
