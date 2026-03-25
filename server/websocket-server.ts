import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import { eventStore } from "../src/lib/event-store";
import { getGasStatus, GAS_THRESHOLD_WARNING } from "../src/lib/sensor-store";

// Types
interface SensorData {
  value: number | boolean | string;
  timestamp: string;
  history: Array<{ value: number | boolean | string; timestamp: string }>;
}

interface SensorMessage {
  room: string;
  sensor: string;
  value: number | boolean | string;
  timestamp?: number | string;
  api_key?: string;
}

interface DeviceCommand {
  type: "device_command";
  device: string;
  action: string;
  state?: boolean;
  value?: string | number;
  api_key?: string;
}

interface DeviceState {
  type: "device_state";
  device: string;
  parameter: string;
  stateValue: string;
  timestamp: string;
}

interface RobotUpdate {
  type: "robot_update";
  data: {
    isActive: boolean;
    task: string;
    battery: number;
    location: string;
    cansCollected: number;
    isCharging?: boolean;
    imageUrl?: string;
  };
  timestamp?: string;
}

interface BroadcastMessage {
  type: "initial" | "sensor_update" | "client_count" | "device_state" | "video_frame";
  key?: string;
  deviceId?: string;
  sensorType?: string;
  data?: SensorData | Record<string, SensorData> | string;
  room?: string;
  timestamp: string;
  clientCount?: number;
  device?: string;
  parameter?: string;
  stateValue?: string;
}

// In-memory storage
const sensorDataStore = new Map<string, SensorData>();
const clients = new Set<WebSocket>();
const MAX_HISTORY_LENGTH = 100;
const deviceConnections = new Map<string, WebSocket>();
const deviceStates = new Map<string, string>(); // Store device states: "on" | "off"

// Room to device mapping
const roomToDeviceMap: Record<string, string> = {
  kitchen: "esp_kitchen_01",
  hallway: "esp_hallway_01",
  bathroom: "esp_bathroom_01",
  "living-room": "esp_livingroom_01",
  office: "esp_office_01",
  street: "esp_street_01",
};

// Process incoming sensor data
function processSensorData(
  deviceId: string,
  sensorType: string,
  value: number | boolean | string,
  timestamp?: string | number,
): { key: string; data: SensorData } {
  const key = `${deviceId}_${sensorType}`;

  // Format timestamp
  let formattedTimestamp: string;
  if (timestamp) {
    if (typeof timestamp === "number") {
      const ts = timestamp > 10000000000 ? timestamp : timestamp * 1000;
      formattedTimestamp = new Date(ts).toISOString();
    } else {
      formattedTimestamp = timestamp.toString();
    }
  } else {
    formattedTimestamp = new Date().toISOString();
  }

  const existing = sensorDataStore.get(key);
  const history = existing?.history || [];

  // Add to history
  history.unshift({ value: value.toString(), timestamp: formattedTimestamp });
  if (history.length > MAX_HISTORY_LENGTH) {
    history.pop();
  }

  // Convert value to number if it's a numeric string
  const numericValue = typeof value === "string" ? parseFloat(value) : value;
  const finalValue = isNaN(numericValue as number) ? value : numericValue;

  const sensorData: SensorData = {
    value: finalValue,
    timestamp: formattedTimestamp,
    history,
  };

  sensorDataStore.set(key, sensorData);

  return { key, data: sensorData };
}

// Broadcast message to all connected clients
function broadcast(message: BroadcastMessage) {
  const payload = JSON.stringify(message);
  let sentCount = 0;

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
      sentCount++;
    }
  });

  console.log(`[Broadcast] Sent to ${sentCount} clients:`, message.type);
}

// Send current sensor data to a specific client
function sendInitialData(ws: WebSocket) {
  const allData: Record<string, SensorData> = {};
  sensorDataStore.forEach((data, key) => {
    allData[key] = data;
  });

  const message: BroadcastMessage = {
    type: "initial",
    data: allData,
    timestamp: new Date().toISOString(),
  };

  ws.send(JSON.stringify(message));

  // Send initial device states
  deviceStates.forEach((stateValue, device) => {
    const deviceState: DeviceState = {
      type: "device_state",
      device: device,
      parameter: "state",
      stateValue: stateValue,
      timestamp: new Date().toISOString(),
    };
    ws.send(JSON.stringify(deviceState));
    console.log(`[WebSocket] Initial state sent: ${device}=${stateValue}`);
  });
}

// Validate API key
function validateApiKey(apiKey?: string): boolean {
  const validApiKey = process.env.SENSOR_API_KEY;

  // If no API key is configured, allow all requests
  if (!validApiKey) {
    return true;
  }

  return apiKey === validApiKey;
}

// Create HTTP server (for WebSocket upgrade only)
const server = http.createServer((req, res) => {
  // Health check endpoint
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        connectedClients: clients.size,
        sensorsTracked: sensorDataStore.size,
        timestamp: new Date().toISOString(),
      }),
    );
    return;
  }

  // All other routes return 404
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({ error: "Not found. Use WebSocket for sensor data." }),
  );
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

wss.on("connection", (ws: WebSocket, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[WebSocket] Client connected from ${clientIp}`);
  clients.add(ws);

  // Send initial data
  sendInitialData(ws);

  // Broadcast client count
  broadcast({
    type: "client_count",
    clientCount: clients.size,
    timestamp: new Date().toISOString(),
  });

  // Handle incoming messages
  ws.on("message", (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());

      // Handle device_command from clients
      if (message.type === "device_command") {
        const command = message as DeviceCommand;

        // For now, just broadcast the command (ESP integration will be added later)
        console.log(`[WebSocket] Device command received: device=${command.device}, action=${command.action}, state=${command.state}`);

        // Send command to ESP device if connected
        const espConnection = deviceConnections.get(command.device);
        if (espConnection && espConnection.readyState === WebSocket.OPEN) {
          // Convert to ESP format: {"device": "fan", "state": true/false}
          const espCommand = {
            device: command.device === "kitchen_fan" ? "fan" : command.device,
            state: command.state === true
          };
          const jsonString = JSON.stringify(espCommand);
          espConnection.send(jsonString);
          console.log(`[WebSocket] ✓ Command sent to ESP:`, espCommand);
          console.log(`[WebSocket] Raw JSON:`, jsonString);
        } else {
          console.log(`[WebSocket] ⚠ No ESP connection for device: ${command.device} (broadcasting anyway)`);
        }

        // Simulate device state update (replace with actual ESP response handling)
        const stateValue = command.state === true ? "on" : "off";

        // Store device state in memory
        deviceStates.set(command.device, stateValue);
        console.log(`[WebSocket] Stored device state: ${command.device}=${stateValue}`);

        // Log device event
        const roomMap: Record<string, string> = {
          kitchen_fan: "Кухня",
          valve: "Ванная",
          hall_light: "Прихожая",
          office_light: "Кабинет",
          humidifier: "Кабинет",
        };
        eventStore.addDeviceEvent(command.device, stateValue === "on" ? "включён" : "выключен", roomMap[command.device] || "Система");

        const deviceState: DeviceState = {
          type: "device_state",
          device: command.device,
          parameter: command.action,
          stateValue: stateValue,
          timestamp: new Date().toISOString(),
        };

        console.log(`[WebSocket] Broadcasting device_state:`, {
          type: deviceState.type,
          device: deviceState.device,
          stateValue: stateValue,
          clientsCount: clients.size
        });
        broadcast(deviceState as unknown as BroadcastMessage);

        // Send acknowledgment
        ws.send(
          JSON.stringify({
            type: "ack",
            device: command.device,
            timestamp: new Date().toISOString(),
          }),
        );
        return;
      }

      // Handle robot_update from robot client
      if (message.type === "robot_update" && message.data) {
        const robotMessage = message as RobotUpdate;
        console.log(`[WebSocket] Robot update received:`, robotMessage.data);

        // Broadcast to all connected clients
        broadcast({
          type: "robot_update",
          data: robotMessage.data,
          timestamp: new Date().toISOString(),
        } as unknown as BroadcastMessage);

        // Send acknowledgment
        ws.send(
          JSON.stringify({
            type: "ack",
            source: "robot",
            timestamp: new Date().toISOString(),
          }),
        );
      }
      
      // Handle video frames from CV client
      if (message.type === "video_frame") {
        broadcast({
          type: "video_frame",
          room: message.room,
          data: message.data,
          timestamp: new Date().toISOString(),
        } as BroadcastMessage & { type: "video_frame"; room: string; data: string });
        return;
      }

      // Handle sensor data from ESP devices
      const sensorMessage = message as SensorMessage;

      // Validate API key for sensor messages
      if (!validateApiKey(sensorMessage.api_key)) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Unauthorized: Invalid API key",
            timestamp: new Date().toISOString(),
          }),
        );
        return;
      }

      // Handle sensor data
      if (sensorMessage.room && sensorMessage.sensor && sensorMessage.value !== undefined) {
        const deviceId =
          roomToDeviceMap[sensorMessage.room] || `esp_${sensorMessage.room}_01`;
        const { key, data: sensorData } = processSensorData(
          deviceId,
          sensorMessage.sensor,
          sensorMessage.value,
          sensorMessage.timestamp,
        );

        console.log(
          `[WebSocket] Sensor update: ${deviceId} - ${sensorMessage.sensor} = ${sensorMessage.value}`,
        );

        // Register device connection if not already tracked
        if (sensorMessage.room === "kitchen") {
          deviceConnections.set("kitchen_fan", ws);
        }

        // Broadcast to all connected clients (including sender)
        broadcast({
          type: "sensor_update",
          key,
          deviceId,
          sensorType: sensorMessage.sensor,
          data: sensorData,
          timestamp: new Date().toISOString(),
        });

        // Log event to Event Store
        let eventType: "info" | "warning" | "alert" = "info";
        if (sensorMessage.sensor === "gas") {
          const gasValue = typeof sensorMessage.value === "number" ? sensorMessage.value : parseFloat(String(sensorMessage.value));
          const gasStatus = getGasStatus(gasValue);
          if (gasStatus === "danger") eventType = "alert";
          else if (gasStatus === "warning") eventType = "warning";
        } else if (sensorMessage.sensor === "water_leak" && sensorMessage.value === "detected") {
          eventType = "alert";
        } else if (sensorMessage.sensor === "motion" && sensorMessage.value === "detected") {
          eventType = "info";
        }

        eventStore.addSensorEvent(
          sensorMessage.room,
          sensorMessage.sensor,
          typeof sensorMessage.value === "boolean"
            ? sensorMessage.value ? "detected" : "clear"
            : sensorMessage.value,
          eventType
        );

        // Send acknowledgment to sender
        ws.send(
          JSON.stringify({
            type: "ack",
            key,
            timestamp: new Date().toISOString(),
          }),
        );
      }
    } catch (error) {
      console.error("[WebSocket] Error parsing message:", error);
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Invalid message format",
          timestamp: new Date().toISOString(),
        }),
      );
    }
  });

  ws.on("close", () => {
    console.log(`[WebSocket] Client disconnected from ${clientIp}`);
    clients.delete(ws);

    // Remove device connections
    for (const [device, connection] of deviceConnections.entries()) {
      if (connection === ws) {
        deviceConnections.delete(device);
        console.log(`[WebSocket] Device disconnected: ${device}`);
      }
    }

    // Broadcast client count
    broadcast({
      type: "client_count",
      clientCount: clients.size,
      timestamp: new Date().toISOString(),
    });
  });

  ws.on("error", (error) => {
    console.error(`[WebSocket] Client error from ${clientIp}:`, error);
    clients.delete(ws);
  });

  // Send ping every 30 seconds to keep connection alive
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    } else {
      clearInterval(pingInterval);
    }
  }, 30000);

  ws.on("close", () => {
    clearInterval(pingInterval);
  });
});

// Start server
const PORT = process.env.WS_PORT || 3001;
const HOST = process.env.WS_HOST || "0.0.0.0";

server.listen(Number(PORT), HOST, () => {
  console.log(`[Server] WebSocket server running on ws://${HOST}:${PORT}`);
  console.log(
    `[Server] HTTP endpoint available at http://${HOST}:${PORT}/api/sensors`,
  );
  console.log(`[Server] Health check at http://${HOST}:${PORT}/health`);
  console.log(
    `[Server] API Key ${process.env.SENSOR_API_KEY ? "enabled" : "disabled"}`,
  );
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[Server] SIGTERM received, shutting down gracefully...");

  // Close all WebSocket connections
  clients.forEach((client) => {
    client.close();
  });

  // Close server
  server.close(() => {
    console.log("[Server] HTTP server closed");
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error(
      "[Server] Could not close connections in time, forcefully shutting down",
    );
    process.exit(1);
  }, 10000);
});

process.on("SIGINT", () => {
  console.log("[Server] SIGINT received, shutting down gracefully...");

  clients.forEach((client) => {
    client.close();
  });

  server.close(() => {
    console.log("[Server] HTTP server closed");
    process.exit(0);
  });
});
