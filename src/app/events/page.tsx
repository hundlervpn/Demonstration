"use client";
import { useState, useEffect } from "react";
import { TopBar } from "@/components/TopBar";
import { PageTransition } from "@/components/PageTransition";
import { Search, Filter, Calendar, User, UserX } from "lucide-react";
import { wsManager } from "@/hooks/useSensorData";

interface LogEvent {
  id: number;
  time: string;
  date: string;
  room: string;
  type: "info" | "warning" | "alert";
  message: string;
  sensorType?: string;
}

export default function EventsPage() {
  const [filterRoom, setFilterRoom] = useState<string>("all");
  const [filterType, setFilterType] = useState<string[]>(["info", "warning", "alert"]);
  const [searchTerm, setSearchTerm] = useState("");

  const rooms = ["all", "Прихожая", "Кабинет", "Кухня", "Ванная", "Улица"];

  const [events, setEvents] = useState<LogEvent[]>([
    { id: 1, time: "17:24", date: "23.02.2026", room: "Кабинет", type: "info", message: "Активирован режим «Фокус»" },
    { id: 2, time: "16:15", date: "23.02.2026", room: "Улица", type: "info", message: "Распознан пользователь: Администратор", sensorType: "face_recognition" },
    { id: 3, time: "15:32", date: "23.02.2026", room: "Прихожая", type: "warning", message: "Автоматизация приостановлена" },
    { id: 4, time: "14:30", date: "23.02.2026", room: "Прихожая", type: "info", message: "Датчик движения активирован" },
    { id: 5, time: "12:15", date: "23.02.2026", room: "Кухня", type: "info", message: "Вентилятор включен вручную" },
    { id: 6, time: "11:20", date: "23.02.2026", room: "Ванная", type: "info", message: "Датчик протечки: проверка успешна" },
    { id: 7, time: "09:00", date: "23.02.2026", room: "Прихожая", type: "info", message: "Свет выключен по сценарию «Утренний»" },
    { id: 8, time: "07:00", date: "23.02.2026", room: "Прихожая", type: "info", message: "Свет включён по сценарию «Утренний» (100%)" },
    { id: 9, time: "23:45", date: "22.02.2026", room: "Улица", type: "warning", message: "Температура превысила порог (26°C)" },
    { id: 10, time: "23:45", date: "22.02.2026", room: "Улица", type: "info", message: "Распознано неизвестное лицо", sensorType: "face_recognition" },
    { id: 11, time: "23:30", date: "22.02.2026", room: "Улица", type: "alert", message: "Отправлено уведомление в Telegram со снимком" },
    { id: 12, time: "18:30", date: "22.02.2026", room: "Кухня", type: "alert", message: "ТРЕВОГА: Обнаружена утечка газа!" },
    { id: 13, time: "18:30", date: "22.02.2026", room: "Кухня", type: "info", message: "Вентилятор включён автоматически" },
    { id: 14, time: "18:30", date: "22.02.2026", room: "Кухня", type: "alert", message: "Отправлено экстренное уведомление в Telegram" },
    { id: 15, time: "14:20", date: "22.02.2026", room: "Ванная", type: "alert", message: "АВАРИЯ: Обнаружена протечка!" },
    { id: 16, time: "14:20", date: "22.02.2026", room: "Ванная", type: "info", message: "Кран автоматически перекрыт" },
    { id: 17, time: "14:20", date: "22.02.2026", room: "Ванная", type: "alert", message: "Отправлено уведомление в Telegram" },
  ]);

  // Handle WebSocket messages for real-time face recognition events
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === "sensor_update" && message.data) {
        const { sensorType, data } = message;

        if (sensorType === "face_recognition") {
          const timestamp = new Date(data.timestamp);
          const time = timestamp.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
          const date = timestamp.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });

          const faceName = String(data.value);
          const isUnknown = faceName === "CHUZHOY" || faceName === "Searching...";

          const newEvent: LogEvent = {
            id: Date.now(),
            time,
            date,
            room: "Улица",
            type: isUnknown ? "warning" : "info",
            message: isUnknown
              ? `Неизвестное лицо: ${faceName}`
              : `Распознан пользователь: ${faceName}`,
            sensorType: "face_recognition",
          };

          setEvents((prev) => [newEvent, ...prev].slice(0, 100));
        }
      }
    };

    const unsubscribe = wsManager.subscribe(handleMessage);
    return () => unsubscribe();
  }, []);

  const filteredEvents = events.filter((event) => {
    const roomMatch = filterRoom === "all" || event.room === filterRoom;
    const typeMatch = filterType.includes(event.type);
    const searchMatch =
      searchTerm === "" ||
      event.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.room.toLowerCase().includes(searchTerm.toLowerCase());

    return roomMatch && typeMatch && searchMatch;
  });

  const getTypeColor = (type: string) => {
    switch (type) {
      case "info":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "warning":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "alert":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "info":
        return "Инфо";
      case "warning":
        return "Предупреждение";
      case "alert":
        return "Тревога";
      default:
        return type;
    }
  };

  const getFaceIcon = (event: LogEvent) => {
    if (event.sensorType === "face_recognition") {
      if (event.message.includes("Неизвестное")) {
        return <UserX className="w-4 h-4 text-amber-400 flex-shrink-0" />;
      }
      return <User className="w-4 h-4 text-green-400 flex-shrink-0" />;
    }
    return null;
  };

  return (
    <PageTransition className="pb-20">
      <TopBar title="Журнал событий" />

      <div className="p-5 max-w-md md:max-w-none mx-auto space-y-5">
        {/* Search */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-4 flex items-center gap-3 shadow-xl shadow-black/40">
          <Search className="w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Поиск по событиям..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500"
          />
        </div>

        {/* Filters */}
        <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-xl shadow-black/40">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-500" />
            <h3 className="text-lg font-medium">Фильтры</h3>
          </div>

          {/* Room Filter */}
          <div>
            <div className="text-sm text-gray-400 mb-3">По комнате</div>
            <div className="flex gap-2 flex-wrap">
              {rooms.map((room) => (
                <button
                  key={room}
                  onClick={() => setFilterRoom(room)}
                  className={`px-4 py-2 rounded-xl text-sm transition-all ${
                    filterRoom === room
                      ? "bg-blue-500 text-white"
                      : "bg-black/40 text-gray-400 hover:bg-white/10"
                  }`}
                >
                  {room === "all" ? "Все комнаты" : room}
                </button>
              ))}
            </div>
          </div>

          {/* Type Filter */}
          <div className="mt-4">
            <div className="text-sm text-gray-400 mb-3">По типу</div>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: "info", label: "Информация" },
                { value: "warning", label: "Предупреждения" },
                { value: "alert", label: "Тревоги" },
              ].map((type) => (
                <button
                  key={type.value}
                  onClick={() => {
                    if (filterType.includes(type.value)) {
                      setFilterType(filterType.filter((t) => t !== type.value));
                    } else {
                      setFilterType([...filterType, type.value]);
                    }
                  }}
                  className={`px-4 py-2 rounded-xl text-sm transition-all ${
                    filterType.includes(type.value)
                      ? "bg-purple-500 text-white"
                      : "bg-black/40 text-gray-400 hover:bg-white/10"
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Events List */}
        <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-xl shadow-black/40">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">События ({filteredEvents.length})</h3>
            <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
              <Calendar className="w-4 h-4" />
              Выбрать период
            </button>
          </div>

          {filteredEvents.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-3">🔍</div>
              <div>События не найдены</div>
              <div className="text-sm mt-2">
                Попробуйте изменить фильтры или поисковый запрос
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEvents.map((event) => (
                <div
                  key={event.id}
                  className="bg-black/40 border border-white/5 rounded-2xl p-4 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="text-sm text-gray-500 min-w-[80px] flex-shrink-0">
                      <div>{event.time}</div>
                      <div className="text-xs">{event.date}</div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm text-gray-400">{event.room}</span>
                        <span className="text-gray-600">•</span>
                        <div
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium ${getTypeColor(
                            event.type,
                          )}`}
                        >
                          {getTypeLabel(event.type)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-white break-words">
                        {getFaceIcon(event)}
                        <span>{event.message}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Stats */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-xl shadow-black/40">
            <div className="text-3xl font-light mb-1 text-blue-400">
              {events.filter((e) => e.type === "info").length}
            </div>
            <div className="text-xs text-blue-400">Информация</div>
          </div>
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-xl shadow-black/40">
            <div className="text-3xl font-light mb-1 text-yellow-400">
              {events.filter((e) => e.type === "warning").length}
            </div>
            <div className="text-xs text-yellow-400">Предупреждения</div>
          </div>
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-xl shadow-black/40">
            <div className="text-3xl font-light mb-1 text-red-400">
              {events.filter((e) => e.type === "alert").length}
            </div>
            <div className="text-xs text-red-400">Тревоги</div>
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
