import { NextRequest } from "next/server";
import { WebSocketServer, WebSocket } from "ws";
import { sensorStore, roomToDeviceMap } from "@/lib/sensor-store";

// Force dynamic rendering
export const dynamic = "force-dynamic";

// Global WebSocket server instance
let wss: WebSocketServer | null = null;
const clients = new Set<WebSocket>();

// Initialize WebSocket server
function getWebSocketServer(): WebSocketServer {
  if (!wss) {
    wss = new WebSocketServer({ noServer: true });

    wss.on("connection", (ws: WebSocket) => {
      console.log("[WebSocket] Client connected");
      clients.add(ws);

      // Send current sensor data on connection
      const allData = sensorStore.getAllAsObject();
      ws.send(
        JSON.stringify({
          type: "initial",
          data: allData,
          timestamp: new Date().toISOString(),
        })
      );

      ws.on("message", (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          console.log("[WebSocket] Received message:", message);

          // Handle sensor data from ESP devices
          if (message.room && message.sensor && message.value !== undefined) {
            const deviceId =
              roomToDeviceMap[message.room] || `esp_${message.room}_01`;
            const { key, data: sensorData } = sensorStore.processSensorData(
              deviceId,
              message.sensor,
              message.value,
              message.timestamp
            );

            console.log(
              `[WebSocket] Sensor update: ${deviceId} - ${message.sensor} = ${message.value}`
            );

            // Broadcast to all connected clients
            broadcast({
              type: "sensor_update",
              key,
              deviceId,
              sensorType: message.sensor,
              data: sensorData,
              timestamp: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.error("[WebSocket] Error parsing message:", error);
        }
      });

      ws.on("close", () => {
        console.log("[WebSocket] Client disconnected");
        clients.delete(ws);
      });

      ws.on("error", (error) => {
        console.error("[WebSocket] Client error:", error);
        clients.delete(ws);
      });
    });

    // Subscribe to sensor store changes
    sensorStore.subscribeToSensorEvents((event) => {
      broadcast({
        type: "sensor_update",
        ...event,
        timestamp: new Date().toISOString(),
      });
    });
  }

  return wss;
}

// Broadcast message to all connected clients
function broadcast(message: unknown) {
  const payload = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// Handle HTTP upgrade to WebSocket
export async function GET(request: NextRequest) {
  const upgradeHeader = request.headers.get("upgrade");

  if (upgradeHeader !== "websocket") {
    return new Response("Expected WebSocket upgrade", { status: 426 });
  }

  // For Next.js App Router, we need to return a special response
  // that signals the server to upgrade to WebSocket
  const server = (globalThis as any).__NEXT_WS_SERVER__;

  if (!server) {
    console.error("[WebSocket] Server not available");
    return new Response("WebSocket server not initialized", { status: 500 });
  }

  const wsServer = getWebSocketServer();

  // Handle the upgrade
  return new Response(null, {
    status: 101,
    headers: {
      Upgrade: "websocket",
      Connection: "Upgrade",
    },
  });
}

// Alternative: HTTP endpoint for ESP devices that can't use WebSocket
export async function POST(request: NextRequest) {
  try {
    // Validate API key if configured
    const apiKey = process.env.SENSOR_API_KEY;
    if (apiKey) {
      const requestKey = request.headers.get("X-API-Key");
      if (!requestKey || requestKey !== apiKey) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    const body = await request.json();
    const { room, sensor, value, timestamp } = body;

    // Validate required fields
    if (!room || !sensor || value === undefined) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: room, sensor, value" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const deviceId = roomToDeviceMap[room] || `esp_${room}_01`;
    const { key, data } = sensorStore.processSensorData(
      deviceId,
      sensor,
      value,
      timestamp
    );

    console.log(`[HTTP API] Received: ${deviceId} - ${sensor} = ${value}`);

    // Broadcast to WebSocket clients
    broadcast({
      type: "sensor_update",
      key,
      deviceId,
      sensorType: sensor,
      data,
      timestamp: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Data received and broadcasted",
        key,
        connectedClients: clients.size,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[HTTP API] Error processing sensor data:", error);
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}
