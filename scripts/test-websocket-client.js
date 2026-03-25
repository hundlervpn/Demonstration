/**
 * WebSocket Test Client
 *
 * Automatically sends test sensor data to WebSocket server for testing.
 * Motion sensor messages have 6-second delay (simulates PIR behavior).
 * Other sensors are sent immediately.
 *
 * Usage:
 *   node test-websocket-client.js                    # Single test (5 messages)
 *   node test-websocket-client.js --infinite         # Infinite test (repeats)
 *   node test-websocket-client.js [ws_url]           # Custom WebSocket URL
 *   node test-websocket-client.js [ws_url] --infinite # Custom URL + infinite mode
 *
 * Example:
 *   node test-websocket-client.js ws://192.168.1.100:3001 --infinite
 */

const WebSocket = require("ws");

// Default WebSocket server URL
const DEFAULT_WS_URL = "ws://localhost:3001";

// Get command line arguments
const args = process.argv.slice(2);
const ws_url =
  args.find((arg) => arg.startsWith("ws://") || arg.startsWith("wss://")) ||
  DEFAULT_WS_URL;
const infinite_mode = args.includes("--infinite");

// Test messages for each room with different sensors
const test_messages = [
  {
    room: "kitchen",
    sensor: "gas",
    value: 250,
    delay: 0,
  },
  {
    room: "hallway",
    sensor: "motion",
    value: "detected",
    delay: 6000,
  },
  {
    room: "bathroom",
    sensor: "water_leak",
    value: false,
    delay: 0,
  },
  {
    room: "office",
    sensor: "humidity",
    value: 65,
    delay: 0,
  },
  {
    room: "hallway",
    sensor: "motion",
    value: "clear",
    delay: 6000,
  },
];

let messages_sent = 0;
let messages_received = 0;
let cumulative_delay = 0;
let cycle_count = 0;
let timers = [];

// Cleanup function to close all timers and connection
function cleanup(ws) {
  console.log("\n🛑 Stopping test client...");

  // Clear all pending timers
  timers.forEach((timer) => clearTimeout(timer));
  timers = [];

  // Close WebSocket connection
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close();
  }

  console.log(`✓ Test stopped`);
  console.log(`  Cycles completed: ${cycle_count}`);
  console.log(`  Total messages sent: ${messages_sent}`);
  console.log(`  Total messages received: ${messages_received}`);

  process.exit(0);
}

/**
 * Send a single batch of test messages
 */
function send_test_batch(ws) {
  const start_delay = cumulative_delay;

  test_messages.forEach((msg, index) => {
    cumulative_delay += msg.delay;

    const timer = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        return;
      }

      const message_with_timestamp = {
        ...msg,
        timestamp: Date.now(),
      };

      ws.send(JSON.stringify(message_with_timestamp));
      messages_sent++;

      console.log(
        `✓ Sent: ${JSON.stringify({
          room: msg.room,
          sensor: msg.sensor,
          value: msg.value,
        })}`,
      );

      // After last message in batch
      if (index === test_messages.length - 1) {
        if (!infinite_mode) {
          // Single mode: close connection after delay
          const close_timer = setTimeout(() => {
            console.log(`\n✓ All tests completed!`);
            console.log(`  Messages sent: ${messages_sent}`);
            console.log(`  Messages received: ${messages_received}`);
            ws.close();
          }, 2000);
          timers.push(close_timer);
        } else {
          // Infinite mode: reset delay and start next cycle
          cycle_count++;
          cumulative_delay = start_delay; // Reset to start of cycle
          console.log(`\n--- Cycle ${cycle_count + 1} starting ---\n`);
          send_test_batch(ws);
        }
      }
    }, cumulative_delay - start_delay); // Use relative delay from batch start

    timers.push(timer);
  });
}

/**
 * Connect to WebSocket server and start testing
 */
function connect_and_test() {
  console.log(`✓ Connecting to ${ws_url}...`);
  console.log(
    `✓ Mode: ${infinite_mode ? "INFINITE (repeats)" : "SINGLE (5 messages)"}`,
  );
  console.log(`✓ Motion delay: 6 seconds between messages\n`);

  const ws = new WebSocket(ws_url);

  ws.on("open", () => {
    console.log("✓ Connected!\n");

    // Start sending test messages
    send_test_batch(ws);
  });

  ws.on("message", (data) => {
    messages_received++;

    try {
      const message = JSON.parse(data);
      console.log(`⬇ Received: ${JSON.stringify(message)}`);
    } catch (error) {
      console.log(`⬇ Received (raw): ${data}`);
    }
  });

  ws.on("error", (error) => {
    console.error(`✗ Error: ${error.message}`);
    cleanup(ws);
  });

  ws.on("close", (code, reason) => {
    console.log(`\n✓ Connection closed (code: ${code})`);
    cleanup(ws);
  });
}

// Handle Ctrl+C (SIGINT)
process.on("SIGINT", () => {
  // Signal will be handled in cleanup() via the active ws connection
  console.log("\n\n⚠ Received interrupt signal...");
  cleanup(null);
});

// Start testing
connect_and_test();
