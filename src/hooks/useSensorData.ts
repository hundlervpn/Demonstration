"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { SensorData, getGasStatus } from "@/lib/sensor-store";

interface UseSensorDataResult {
  data: SensorData | null;
  loading: boolean;
  error: string | null;
  connected: boolean;
  refresh: () => void;
}

interface WebSocketMessage {
  type: "initial" | "sensor_update" | "client_count" | "error" | "ack" | "robot_update" | "device_state" | "video_frame";
  key?: string;
  deviceId?: string;
  sensorType?: string;
  room?: string;
  data?: SensorData | Record<string, SensorData> | RobotData | string;
  timestamp: string;
  clientCount?: number;
  message?: string;
  device?: string;
  parameter?: string;
  stateValue?: string;
}

interface RobotData {
  isActive: boolean;
  task: string;
  battery: number;
  location: string;
  cansCollected: number;
  isCharging?: boolean;
  imageUrl?: string;
}

// Global WebSocket connection manager
class WebSocketManager {
  private ws: WebSocket | null = null;
  private listeners: Set<(message: WebSocketMessage) => void> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private url: string;
  private isConnecting = false;

  constructor() {
    // WebSocket server URL (default: ws://localhost:3001)
    this.url =
      process.env.NEXT_PUBLIC_WS_URL ||
      (typeof window !== "undefined"
        ? `ws://${window.location.hostname}:3001`
        : "ws://localhost:3001");
  }

  connect() {
    if (
      this.isConnecting ||
      (this.ws && this.ws.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    this.isConnecting = true;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log("[WebSocket] Connected to server");
        this.reconnectAttempts = 0;
        this.isConnecting = false;
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.listeners.forEach((listener) => listener(message));
        } catch (error) {
          console.error("[WebSocket] Error parsing message:", error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("[WebSocket] Error:", error);
        this.isConnecting = false;
      };

      this.ws.onclose = () => {
        console.log("[WebSocket] Disconnected from server");
        this.isConnecting = false;
        this.attemptReconnect();
      };
    } catch (error) {
      console.error("[WebSocket] Connection error:", error);
      this.isConnecting = false;
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[WebSocket] Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `[WebSocket] Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
    );

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  subscribe(listener: (message: WebSocketMessage) => void) {
    this.listeners.add(listener);

    // Auto-connect when first listener subscribes
    if (this.listeners.size === 1) {
      this.connect();
    }

    return () => {
      this.listeners.delete(listener);

      // Auto-disconnect when no listeners remain
      if (this.listeners.size === 0) {
        this.disconnect();
      }
    };
  }

  send(message: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn("[WebSocket] Cannot send message - not connected");
    }
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
const wsManager = new WebSocketManager();

// Demo mode: mock data returned when WebSocket is unavailable
const MOCK_FALLBACK_MS = 2000;

const MOCK_SENSOR_DATA: Record<string, SensorData> = {
  esp_office_01_temperature: {
    value: 22.4,
    timestamp: new Date().toISOString(),
    history: Array.from({ length: 15 }, (_, i) => ({
      value: String(21 + Math.sin(i / 3) * 2),
      timestamp: new Date(Date.now() - i * 60000).toISOString(),
    })),
  },
  esp_office_01_humidity: {
    value: 47,
    timestamp: new Date().toISOString(),
    history: Array.from({ length: 15 }, (_, i) => ({
      value: String(45 + Math.cos(i / 4) * 5),
      timestamp: new Date(Date.now() - i * 60000).toISOString(),
    })),
  },
  esp_kitchen_01_gas: {
    value: 42,
    timestamp: new Date().toISOString(),
    history: Array.from({ length: 15 }, (_, i) => ({
      value: String(35 + Math.random() * 20),
      timestamp: new Date(Date.now() - i * 60000).toISOString(),
    })),
  },
  esp_hallway_01_motion: {
    value: "clear",
    timestamp: new Date().toISOString(),
    history: [
      { value: "detected", timestamp: new Date(Date.now() - 180000).toISOString() },
      { value: "clear", timestamp: new Date(Date.now() - 120000).toISOString() },
    ],
  },
  esp_bathroom_01_water_leak: {
    value: "dry",
    timestamp: new Date().toISOString(),
    history: [],
  },
};

const MOCK_DEVICE_STATES: Record<string, string> = {
  kitchen_fan: "off",
  office_humidifier: "off",
  window: "off",
  valve: "open",
  hall_light: "on",
  office_light: "on",
};

// Hook for generic sensor data
export function useSensorData(
  deviceId: string,
  sensorType: string,
): UseSensorDataResult {
  const [data, setData] = useState<SensorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const usedMockRef = useRef(false);

  const handleMessage = useCallback(
    (message: WebSocketMessage) => {
      if (message.type === "error") {
        setError(message.message || "Unknown error");
        return;
      }

      // Update connection status
      setConnected(true);
      setError(null);

      const sensorKey = `${deviceId}_${sensorType}`;

      // Handle initial data load
      if (message.type === "initial" && message.data) {
        const allData = message.data as Record<string, SensorData>;
        if (allData[sensorKey]) {
          setData(allData[sensorKey]);
          setLoading(false);
        }
      }

      // Handle sensor updates
      if (
        message.type === "sensor_update" &&
        message.key === sensorKey &&
        message.data
      ) {
        setData(message.data as SensorData);
        setLoading(false);
      }
    },
    [deviceId, sensorType],
  );

  useEffect(() => {
    setLoading(true);

    const unsubscribe = wsManager.subscribe(handleMessage);

    // Check connection status periodically
    const interval = setInterval(() => {
      setConnected(wsManager.isConnected() || false);
    }, 1000);

    // Mock data fallback: if no real data arrives, use demo values
    const mockTimeout = setTimeout(() => {
      if (!usedMockRef.current) {
        usedMockRef.current = true;
        const sensorKey = `${deviceId}_${sensorType}`;
        const mock = MOCK_SENSOR_DATA[sensorKey];
        if (mock) {
          setData(mock);
          setLoading(false);
          setConnected(true);
        }
      }
    }, MOCK_FALLBACK_MS);

    return () => {
      unsubscribe();
      clearInterval(interval);
      clearTimeout(mockTimeout);
    };
  }, [handleMessage, deviceId, sensorType]);

  const refresh = useCallback(() => {
    // Request fresh data from server
    wsManager.send({
      type: "request_data",
      deviceId,
      sensorType,
    });
  }, [deviceId, sensorType]);

  return { data, loading, error, connected, refresh };
}

// Specialized hook for gas sensor
export function useGasSensor(deviceId: string) {
  const { data, loading, error, connected, refresh } = useSensorData(
    deviceId,
    "gas",
  );

  // Parse value - handle string or number from ESP
  let gasValue = 0;
  if (data?.value !== undefined && data?.value !== null) {
    if (typeof data.value === "string") {
      gasValue = parseFloat(data.value);
      if (isNaN(gasValue)) gasValue = 0;
    } else if (typeof data.value === "number") {
      gasValue = data.value;
    }
  }

  const status = getGasStatus(gasValue);
  const isSafe = status === "safe";

  return {
    value: gasValue,
    isSafe,
    status,
    timestamp: data?.timestamp,
    history: data?.history || [],
    loading,
    error,
    connected,
    refresh,
    hasData: !!data,
  };
}

// Specialized hook for motion sensor
export function useMotionSensor(deviceId: string) {
  const { data, loading, error, connected, refresh } = useSensorData(
    deviceId,
    "motion",
  );

  // Handle string values from ESP: "detected", "clear"
  const isDetected =
    data?.value === true ||
    data?.value === 1 ||
    data?.value === "1" ||
    data?.value === "detected";

  // Find last motion detection time
  const lastMotionEvent = data?.history?.find(
    (h) =>
      h.value === true ||
      h.value === 1 ||
      h.value === "1" ||
      h.value === "detected",
  );
  const lastMotionTime = lastMotionEvent?.timestamp;

  return {
    isDetected,
    lastMotionTime,
    timestamp: data?.timestamp,
    history: data?.history || [],
    loading,
    error,
    connected,
    refresh,
  };
}

// Hook for multiple sensors
export function useMultipleSensors(
  sensors: Array<{ deviceId: string; sensorType: string }>,
) {
  const [allData, setAllData] = useState<Record<string, SensorData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const handleMessage = useCallback(
    (message: WebSocketMessage) => {
      if (message.type === "error") {
        setError(message.message || "Unknown error");
        return;
      }

      setConnected(true);
      setError(null);

      // Handle initial data load
      if (message.type === "initial" && message.data) {
        const initialData = message.data as Record<string, SensorData>;
        const relevantData: Record<string, SensorData> = {};

        sensors.forEach(({ deviceId, sensorType }) => {
          const key = `${deviceId}_${sensorType}`;
          if (initialData[key]) {
            relevantData[key] = initialData[key];
          }
        });

        setAllData(relevantData);
        setLoading(false);
      }

      // Handle sensor updates
      if (message.type === "sensor_update" && message.key && message.data) {
        setAllData((prev) => ({
          ...prev,
          [message.key!]: message.data as SensorData,
        }));
        setLoading(false);
      }
    },
    [sensors],
  );

  useEffect(() => {
    setLoading(true);

    const unsubscribe = wsManager.subscribe(handleMessage);

    const interval = setInterval(() => {
      setConnected(wsManager.isConnected() || false);
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [handleMessage]);

  return { allData, loading, error, connected };
}

// Hook for robot data (read-only)
export function useRobotData() {
  const [data, setData] = useState<RobotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const handleMessage = useCallback(
    (message: WebSocketMessage) => {
      if (message.type === "error") {
        setError(message.message || "Unknown error");
        return;
      }

      setConnected(true);
      setError(null);

      // Handle robot updates
      if (message.type === "robot_update" && message.data) {
        setData(message.data as RobotData);
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    setLoading(true);

    const unsubscribe = wsManager.subscribe(handleMessage);

    const interval = setInterval(() => {
      setConnected(wsManager.isConnected() || false);
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [handleMessage]);

  return { data, loading, error, connected };
}

// Export WebSocket manager for advanced usage
export { wsManager };
export type { RobotData };

// Hook for device state control
export function useDeviceState(deviceId: string) {
  const [state, setState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const deviceIdRef = useRef(deviceId);
  const stateRef = useRef(state);
  const commandIdRef = useRef(0); // Track command order to ignore stale responses
  const usedMockRef = useRef(false);

  // Keep refs in sync
  useEffect(() => {
    deviceIdRef.current = deviceId;
  }, [deviceId]);

  useEffect(() => {
    stateRef.current = state;
    console.log(`[Client] State updated for ${deviceIdRef.current}:`, state, `isOn: ${state === "on"}`);
  }, [state]);

  const handleMessage = useCallback(
    (message: WebSocketMessage) => {
      if (message.type === "error") {
        setError(message.message || "Unknown error");
        return;
      }

      setConnected(true);
      setError(null);

      // Handle device state updates - use ref to avoid dependency cycle
      if (message.type === "device_state") {
        console.log(`[Client] device_state received:`, {
          messageDevice: message.device,
          ourDevice: deviceIdRef.current,
          stateValue: message.stateValue,
          matches: message.device === deviceIdRef.current
        });
        if (message.device === deviceIdRef.current) {
          // Ignore stale responses - if our optimistic state already differs, we have a newer command pending
          const currentState = stateRef.current;
          if (currentState !== null && currentState !== message.stateValue) {
            console.log(`[Client] ⚠ Ignoring stale response: got ${message.stateValue}, but current optimistic state is ${currentState}`);
            return;
          }
          console.log(`[Client] ✓ MATCH! Updating state for ${deviceIdRef.current}:`, message.stateValue);
          setState(message.stateValue || null);
          setLoading(false);
        } else {
          console.log(`[Client] ✗ SKIP! Device ${message.device} != ${deviceIdRef.current}`);
        }
      }
    },
    [], // Empty dependencies - uses ref instead
  );

  useEffect(() => {
    setLoading(true);

    const unsubscribe = wsManager.subscribe(handleMessage);

    const interval = setInterval(() => {
      setConnected(wsManager.isConnected() || false);
    }, 1000);

    // Mock data fallback for device states
    const mockTimeout = setTimeout(() => {
      if (!usedMockRef.current) {
        usedMockRef.current = true;
        const mock = MOCK_DEVICE_STATES[deviceIdRef.current];
        if (mock !== undefined) {
          stateRef.current = mock;
          setState(mock);
          setLoading(false);
          setConnected(true);
        }
      }
    }, MOCK_FALLBACK_MS);

    return () => {
      unsubscribe();
      clearInterval(interval);
      clearTimeout(mockTimeout);
    };
  }, [handleMessage]); // Only depends on stable handleMessage

  const toggle = useCallback(() => {
    // Use ref to get CURRENT state instead of stale closure state
    // Treat null as "off" - fan starts in off state
    const currentState = stateRef.current ?? "off";
    const newState = currentState === "on" ? "off" : "on";
    console.log(`[Client] Toggle called: deviceId=${deviceIdRef.current}, currentState=${currentState}, newState=${newState}, isOn=${state === "on"}`);
    // Optimistic update - immediately update both ref and React state
    stateRef.current = newState;
    setState(newState);
    wsManager.send({
      type: "device_command",
      device: deviceIdRef.current,
      action: "set_state",
      state: newState === "on",
    });
    console.log(`[Client] Command sent: type=device_command, device=${deviceIdRef.current}, state=${newState === "on"}`);
  }, []); // No dependencies - uses refs

  const setOn = useCallback(() => {
    console.log(`[Client] Set ON for ${deviceIdRef.current}`);
    // Optimistic update - both ref and React state
    stateRef.current = "on";
    setState("on");
    wsManager.send({
      type: "device_command",
      device: deviceIdRef.current,
      action: "set_state",
      state: true,
    });
  }, []); // No dependencies - uses ref

  const setOff = useCallback(() => {
    console.log(`[Client] Set OFF for ${deviceIdRef.current}`);
    // Optimistic update - both ref and React state
    stateRef.current = "off";
    setState("off");
    wsManager.send({
      type: "device_command",
      device: deviceIdRef.current,
      action: "set_state",
      state: false,
    });
  }, []); // No dependencies - uses ref

  return {
    state,
    isOn: state === "on",
    isOff: state === "off",
    loading,
    error,
    connected,
    toggle,
    setOn,
    setOff,
  };
}
