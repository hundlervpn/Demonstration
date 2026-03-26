export interface SensorReading {
  device_id: string;
  sensor_type: SensorType;
  value: number | boolean | string;
  timestamp: string;
  history: Array<{ value: number | boolean | string; timestamp: string }>;
}

export type SensorType =
  | "gas"
  | "motion"
  | "temperature"
  | "humidity"
  | "water_leak"
  | "face_recognition"
  | string;

export interface SensorData {
  value: number | boolean | string;
  timestamp: string;
  history: Array<{ value: number | boolean | string; timestamp: string }>;
}

export interface SensorUpdateEvent {
  key: string;
  data: SensorData;
  deviceId: string;
  sensorType: string;
}

type SensorEventListener = (event: SensorUpdateEvent) => void;

class SensorStore {
  private data: Map<string, SensorData> = new Map();
  private listeners: Set<() => void> = new Set();
  private sensorEventListeners: Set<SensorEventListener> = new Set();
  private MAX_HISTORY_LENGTH = 100;

  set(key: string, reading: SensorData) {
    this.data.set(key, reading);
    this.notify();
    this.notifySensorEvent(key, reading);
  }

  get(key: string): SensorData | undefined {
    return this.data.get(key);
  }

  getValue(key: string): number | boolean | string | undefined {
    return this.data.get(key)?.value;
  }

  getAll(): Map<string, SensorData> {
    return new Map(this.data);
  }

  getAllAsObject(): Record<string, SensorData> {
    const obj: Record<string, SensorData> = {};
    this.data.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }

  getHistory(
    key: string,
    limit = 10,
  ): Array<{ value: number | boolean | string; timestamp: string }> {
    const data = this.data.get(key);
    if (!data) return [];
    return data.history.slice(0, limit);
  }

  subscribe(callback: () => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Subscribe to sensor update events (for WebSocket broadcasting)
  subscribeToSensorEvents(callback: SensorEventListener) {
    this.sensorEventListeners.add(callback);
    return () => this.sensorEventListeners.delete(callback);
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  private notifySensorEvent(key: string, data: SensorData) {
    const [deviceId, ...sensorParts] = key.split("_");
    const sensorType = sensorParts.join("_");

    const event: SensorUpdateEvent = {
      key,
      data,
      deviceId,
      sensorType,
    };

    this.sensorEventListeners.forEach((cb) => cb(event));
  }

  clear() {
    this.data.clear();
    this.notify();
  }

  // Process incoming sensor data
  processSensorData(
    deviceId: string,
    sensorType: string,
    value: number | boolean | string,
    timestamp?: string | number,
  ) {
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

    const existing = this.data.get(key);
    const history = existing?.history || [];

    // Add to history
    history.unshift({ value: value.toString(), timestamp: formattedTimestamp });
    if (history.length > this.MAX_HISTORY_LENGTH) {
      history.pop();
    }

    // Store sensor data - convert value to number if it's a numeric string
    const numericValue = typeof value === "string" ? parseFloat(value) : value;
    const finalValue = isNaN(numericValue as number) ? value : numericValue;

    const sensorData: SensorData = {
      value: finalValue,
      timestamp: formattedTimestamp,
      history,
    };

    this.set(key, sensorData);

    return { key, data: sensorData };
  }
}

export const sensorStore = new SensorStore();

// Helper functions for specific sensor types
export const sensorKeys = {
  gas: (deviceId: string) => `${deviceId}_gas`,
  motion: (deviceId: string) => `${deviceId}_motion`,
  temperature: (deviceId: string) => `${deviceId}_temperature`,
  humidity: (deviceId: string) => `${deviceId}_humidity`,
  water_leak: (deviceId: string) => `${deviceId}_water_leak`,
};

// Map room names to device IDs
export const roomToDeviceMap: Record<string, string> = {
  kitchen: "esp_kitchen_01",
  hallway: "esp_hallway_01",
  bathroom: "esp_bathroom_01",
  "living-room": "esp_livingroom_01",
  office: "esp_office_01",
  street: "esp_street_01",
};

// Gas sensor thresholds (ppm)
export const GAS_THRESHOLD_SAFE = 360;
export const GAS_THRESHOLD_WARNING = 400;

export function getGasStatus(value: number): "safe" | "warning" | "danger" {
  if (value < GAS_THRESHOLD_SAFE) return "safe";
  if (value < GAS_THRESHOLD_WARNING) return "warning";
  return "danger";
}

// Motion sensor helpers
export function isMotionDetected(value: number | boolean | string): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string")
    return (
      value === "1" || value.toLowerCase() === "true" || value === "detected"
    );
  return false;
}
