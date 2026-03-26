import * as fs from "fs";
import * as path from "path";

export interface Event {
  id: string;
  timestamp: string;
  room: string;
  type: "info" | "warning" | "alert";
  message: string;
}

export interface EventFilters {
  room?: string;
  type?: ("info" | "warning" | "alert")[];
  dateFrom?: string;
  dateTo?: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const EVENTS_FILE = path.join(DATA_DIR, "events.json");
const MAX_EVENTS = 1000;
const DEFAULT_DAYS_TO_KEEP = 30;

class EventStore {
  private events: Event[] = [];
  private initialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.initialized) return;

    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // Load existing events
    if (fs.existsSync(EVENTS_FILE)) {
      try {
        const data = fs.readFileSync(EVENTS_FILE, "utf-8");
        this.events = JSON.parse(data);
      } catch (error) {
        console.error("[EventStore] Error loading events:", error);
        this.events = [];
      }
    }

    this.initialized = true;
  }

  private save() {
    try {
      fs.writeFileSync(EVENTS_FILE, JSON.stringify(this.events, null, 2));
    } catch (error) {
      console.error("[EventStore] Error saving events:", error);
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  addEvent(event: Omit<Event, "id">): Event {
    const newEvent: Event = {
      ...event,
      id: this.generateId(),
    };

    // Add to beginning
    this.events.unshift(newEvent);

    // Trim to max size
    if (this.events.length > MAX_EVENTS) {
      this.events = this.events.slice(0, MAX_EVENTS);
    }

    this.save();
    console.log(`[EventStore] Event added: ${event.type} - ${event.room} - ${event.message}`);

    return newEvent;
  }

  getEvents(filters?: EventFilters): Event[] {
    let result = [...this.events];

    if (filters) {
      // Filter by room
      if (filters.room && filters.room !== "all") {
        result = result.filter((e) => e.room === filters.room);
      }

      // Filter by type
      if (filters.type && filters.type.length > 0) {
        result = result.filter((e) => filters.type!.includes(e.type));
      }

      // Filter by date range
      if (filters.dateFrom) {
        const fromTime = new Date(filters.dateFrom).getTime();
        result = result.filter((e) => new Date(e.timestamp).getTime() >= fromTime);
      }

      if (filters.dateTo) {
        const toTime = new Date(filters.dateTo).getTime();
        // Include end of day
        result = result.filter(
          (e) => new Date(e.timestamp).getTime() <= toTime + 24 * 60 * 60 * 1000 - 1
        );
      }
    }

    return result;
  }

  clearOldEvents(daysToKeep: number = DEFAULT_DAYS_TO_KEEP): number {
    const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
    const originalLength = this.events.length;

    this.events = this.events.filter(
      (e) => new Date(e.timestamp).getTime() >= cutoffTime
    );

    const removed = originalLength - this.events.length;
    if (removed > 0) {
      this.save();
      console.log(`[EventStore] Cleared ${removed} old events`);
    }

    return removed;
  }

  // Convenience methods for common event types
  addSensorEvent(
    room: string,
    sensor: string,
    value: string | number,
    type: "info" | "warning" | "alert" = "info"
  ): Event {
    const roomNames: Record<string, string> = {
      kitchen: "Кухня",
      hallway: "Прихожая",
      bathroom: "Ванная",
      office: "Кабинет",
      "living-room": "Гостиная",
      street: "Улица",
    };

    const sensorMessages: Record<string, (v: string | number) => string> = {
      gas: (v) => `Уровень газа: ${v} ppm`,
      motion: (v) => v === "detected" ? "Движение обнаружено" : "Движения нет",
      temperature: (v) => `Температура: ${v}°C`,
      humidity: (v) => `Влажность: ${v}%`,
      water_leak: (v) => v === "detected" ? "Обнаружена протечка!" : "Протечка устранена",
    };

    const message = sensorMessages[sensor]?.(value) ?? `${sensor}: ${value}`;

    return this.addEvent({
      timestamp: new Date().toISOString(),
      room: roomNames[room] || room,
      type,
      message,
    });
  }

  addDeviceEvent(
    device: string,
    action: string,
    room: string = "Система"
  ): Event {
    const deviceNames: Record<string, string> = {
      fan: "Вентилятор",
      valve: "Кран",
      light: "Свет",
      humidifier: "Увлажнитель",
      window: "Окно",
      office_light: "Свет в кабинете",
      hall_light: "Свет в прихожей",
      kitchen_fan: "Вентилятор кухни",
    };

    const deviceName = deviceNames[device] || device;

    return this.addEvent({
      timestamp: new Date().toISOString(),
      room,
      type: "info",
      message: `${deviceName}: ${action}`,
    });
  }
}

// Singleton instance
export const eventStore = new EventStore();
