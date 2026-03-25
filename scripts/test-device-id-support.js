/**
 * Test Script for H-0004: device_id Field Support
 *
 * Validates that WebSocket server supports both:
 * 1. Robot messages with device_id field
 * 2. ESP messages with room field (backward compatibility)
 *
 * Usage:
 *   node test-device-id-support.js                    # Runs all tests
 *   node test-device-id-support.js [ws_url]           # Custom WebSocket URL
 *
 * Example:
 *   node test-device-id-support.js ws://192.168.1.100:3001
 */

const WebSocket = require("ws");

// Default WebSocket server URL
const DEFAULT_WS_URL = "ws://localhost:3001";

// Get command line arguments
const args = process.argv.slice(2);
const ws_url =
  args.find((arg) => arg.startsWith("ws://") || arg.startsWith("wss://")) ||
  DEFAULT_WS_URL;

// Test cases for H-0004
const test_cases = [
  {
    name: "Robot: device_id field",
    description: "Robot sends message with explicit device_id",
    message: {
      device_id: "robot_01",
      sensor: "status",
      value: "cleaning",
      timestamp: Date.now(),
    },
    expected_key: "robot_01_status",
  },
  {
    name: "Robot: battery sensor",
    description: "Robot sends battery level via device_id",
    message: {
      device_id: "robot_01",
      sensor: "battery",
      value: 85,
      timestamp: Date.now(),
    },
    expected_key: "robot_01_battery",
  },
  {
    name: "ESP: room field (kitchen)",
    description: "ESP device sends via room field (backward compat)",
    message: {
      room: "kitchen",
      sensor: "gas",
      value: 250,
      timestamp: Date.now(),
    },
    expected_key: "esp_kitchen_01_gas",
  },
  {
    name: "ESP: room field (hallway)",
    description: "Another ESP device via room field",
    message: {
      room: "hallway",
      sensor: "motion",
      value: "detected",
      timestamp: Date.now(),
    },
    expected_key: "esp_hallway_01_motion",
  },
  {
    name: "Robot: can_count sensor",
    description: "Robot sends can count via device_id",
    message: {
      device_id: "robot_01",
      sensor: "can_count",
      value: 3,
      timestamp: Date.now(),
    },
    expected_key: "robot_01_can_count",
  },
];

let current_test_index = 0;
let passed_tests = 0;
let failed_tests = 0;
let ws = null;

/**
 * Run a single test case
 */
function run_test_case(test_case) {
  console.log(`\n━━━ Test ${current_test_index + 1}/${test_cases.length}: ${test_case.name} ━━━`);
  console.log(`   Description: ${test_case.description}`);
  console.log(`   Expected key: ${test_case.expected_key}`);

  ws.send(JSON.stringify(test_case.message));
  console.log(`   → Sent: ${JSON.stringify(test_case.message)}`);
}

/**
 * Validate received message
 */
function validate_response(received) {
  const test_case = test_cases[current_test_index];

  console.log(`   ← Received: ${JSON.stringify(received)}`);

  // Check if we received an ACK for our message
  if (received.type === "ack") {
    if (received.key === test_case.expected_key) {
      console.log(`   ✓ PASS: Sensor key matches expected ${test_case.expected_key}`);
      passed_tests++;
    } else {
      console.log(`   ✗ FAIL: Expected key ${test_case.expected_key}, got ${received.key}`);
      failed_tests++;
    }
  } else if (received.type === "sensor_update") {
    if (received.key === test_case.expected_key) {
      console.log(`   ✓ PASS: Sensor key matches expected ${test_case.expected_key}`);
      passed_tests++;
    } else {
      console.log(`   ✗ FAIL: Expected key ${test_case.expected_key}, got ${received.key}`);
      failed_tests++;
    }
  } else if (received.type === "error") {
    console.log(`   ✗ FAIL: Server error: ${received.message}`);
    failed_tests++;
  } else {
    // For other message types (initial, client_count), we'll just log and continue
    console.log(`   ℹ Info: Received ${received.type} message (not validating key)`);
  }
}

/**
 * Move to next test case
 */
function next_test() {
  current_test_index++;

  if (current_test_index < test_cases.length) {
    // Small delay before next test
    setTimeout(() => {
      run_test_case(test_cases[current_test_index]);
    }, 500);
  } else {
    // All tests completed
    finish_tests();
  }
}

/**
 * Finish and show results
 */
function finish_tests() {
  console.log("\n━━━ Test Results ━━━");
  console.log(`  Total tests: ${test_cases.length}`);
  console.log(`  Passed: ${passed_tests}`);
  console.log(`  Failed: ${failed_tests}`);
  console.log(`  Success rate: ${((passed_tests / test_cases.length) * 100).toFixed(1)}%`);

  if (passed_tests === test_cases.length) {
    console.log("\n✓ All tests PASSED - H-0004 validated!");
  } else {
    console.log("\n✗ Some tests FAILED - H-0004 needs refinement");
  }

  ws.close();
}

/**
 * Connect and start testing
 */
function connect_and_test() {
  console.log("━━━ H-0004: device_id Field Support Validation ━━━");
  console.log(`   WebSocket URL: ${ws_url}`);
  console.log(`   Total test cases: ${test_cases.length}`);

  ws = new WebSocket(ws_url);

  ws.on("open", () => {
    console.log("\n✓ Connected to WebSocket server\n");

    // Start first test
    run_test_case(test_cases[0]);
  });

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data);

      // Handle different message types
      if (message.type === "ack" || message.type === "sensor_update") {
        validate_response(message);
        // Move to next test after receiving ACK
        next_test();
      } else if (message.type === "error") {
        validate_response(message);
        next_test();
      }
      // Skip validation for initial and client_count messages
    } catch (error) {
      console.error(`   ✗ Error parsing message: ${error.message}`);
      failed_tests++;
    }
  });

  ws.on("error", (error) => {
    console.error(`\n✗ WebSocket error: ${error.message}`);
    failed_tests = test_cases.length;
    console.log("\n✗ Test ABORTED - Server connection failed");
    process.exit(1);
  });

  ws.on("close", () => {
    console.log("\n✓ Connection closed");
  });
}

// Handle Ctrl+C
process.on("SIGINT", () => {
  console.log("\n\n⚠ Test interrupted by user");
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close();
  }
  process.exit(0);
});

// Start testing
connect_and_test();
