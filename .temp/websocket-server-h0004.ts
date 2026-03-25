/**
 * Temporary WebSocket Server for H-0004 Validation
 *
 * Implements device_id field support with backward compatibility.
 * This is a FORK of websocket-server.ts with H-0004 applied.
 *
 * H-0004 Changes:
 * 1. SensorMessage: room is now optional, device_id added
 * 2. Message validation: prioritizes device_id, falls back to room
 * 3. ESP devices: continue using room field (unchanged)
 * 4. Robot devices: use device_id field directly
 */

import { WebSocketServer, WebSocket } from "ws";
import http from "http";

// Types
interface SensorData {
  value: number | boolean | string;
  timestamp: string;
  history: Array<{ value: number | boolean | string; timestamp: string }>;
}

// H-0004: Modified interface - room is now optional, device_id added
interface SensorMessage {
  room?: string;              // Changed from required to optional
  device_id?: string;         // New optional field
  sensor: string;
  value: number | boolean | string;
  timestamp?: number | string;
  api_key?: string;
}

interface BroadcastMessage {
  type: "initial" | "sensor_update" | "client_count";
  key?: string;
  deviceId?: string;
  sensorType?: string;
  data?: SensorData | Record<string, SensorData>;
  timestamp: string;
  clientCount?: number;
}

// In-memory storage
const sensorDataStore = new Map<string, SensorData>();
const clients = new Set<WebSocket>();
const MAX_HISTORY_LENGTH = 100;

// Room to device mapping (unchanged for ESP compatibility)
const roomToDeviceMap: Record<string, string> = {
  kitchen: "esp_kitchen_01",
  hallway: "esp_hallway_01",
  bathroom: "esp_bathroom_01",
  "living-room": "esp_livingroom_01",
  office: "esp_office_01",
  street: "esp_street_01",
};

// Process incoming sensor data (unchanged)
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

// Broadcast message to all connected clients (unchanged)
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

// Send current sensor data to a specific client (unchanged)
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
}

// Validate API key (unchanged)
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
        h0004_implemented: true,
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
      const message: SensorMessage = JSON.parse(data.toString());

      // Validate API key
      if (!validateApiKey(message.api_key)) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Unauthorized: Invalid API key",
            timestamp: new Date().toISOString(),
          }),
        );
        return;
      }

      // H-0004: Modified validation logic - prioritize device_id, fall back to room
      if (message.sensor && message.value !== undefined) {
        // New fallback chain: device_id → room mapping → default
        const deviceId =
          message.device_id ||
          (message.room && roomToDeviceMap[message.room]) ||
          (message.room && `esp_${message.room}_01`);

        if (!deviceId) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Either device_id or room field is required",
              timestamp: new Date().toISOString(),
            }),
          );
          return;
        }

        const { key, data: sensorData } = processSensorData(
          deviceId,
          message.sensor,
          message.value,
          message.timestamp,
        );

        console.log(
          `[WebSocket] Sensor update: ${deviceId} - ${message.sensor} = ${message.value}`,
        );

        // Broadcast to all connected clients (including sender)
        broadcast({
          type: "sensor_update",
          key,
          deviceId,
          sensorType: message.sensor,
          data: sensorData,
          timestamp: new Date().toISOString(),
        });

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

// Start server (use different port to avoid conflict with main server)
const PORT = process.env.WS_PORT || 3002;  // Default to 3002 for testing
const HOST = process.env.WS_HOST || "0.0.0.0";

server.listen(Number(PORT), HOST, () => {
  console.log(`[Server] H-0004 Test Server running on ws://${HOST}:${PORT}`);
  console.log(
    `[Server] HTTP endpoint available at http://${HOST}:${PORT}/api/sensors`,
  );
  console.log(`[Server] Health check at http://${HOST}:${PORT}/health`);
  console.log(
    `[Server] API Key ${process.env.SENSOR_API_KEY ? "enabled" : "disabled"}`,
  );
  console.log(`[Server] H-0004 (device_id support): IMPLEMENTED`);
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
