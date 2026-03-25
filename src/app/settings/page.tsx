"use client";
import { TopBar } from "@/components/TopBar";
import { PageTransition } from "@/components/PageTransition";
import { Send, Database, CheckCircle2, UserPlus, Trash2, Sliders, Check } from "lucide-react";
import { useState } from "react";

type FaceRole = "admin" | "resident" | "guest" | "courier" | "technician";

interface FaceProfile {
  id: string;
  name: string;
  role: FaceRole;
  addedDate: string;
}

export default function SettingsPage() {
  const [notifications, setNotifications] = useState([
    { id: 'water', label: "Протечки воды", checked: true },
    { id: 'gas', label: "Утечка газа", checked: true },
    { id: 'faces', label: "Неизвестные лица", checked: true },
    { id: 'system', label: "Системные события", checked: false },
  ]);

  const [faceProfiles, setFaceProfiles] = useState<FaceProfile[]>([
    { id: '1', name: "Администратор", role: "admin", addedDate: "24.02.2026" },
    { id: '2', name: "Адам", role: "resident", addedDate: "23.02.2026" },
  ]);

  const [tempDelta, setTempDelta] = useState(1.5);
  const [humidityDelta, setHumidityDelta] = useState(5);

  const toggleNotification = (id: string) => {
    setNotifications(notifications.map(n =>
      n.id === id ? { ...n, checked: !n.checked } : n
    ));
  };

  const getRoleLabel = (role: FaceRole) => {
    switch (role) {
      case "admin": return "Администратор";
      case "resident": return "Житель";
      case "guest": return "Гость";
      case "courier": return "Курьер";
      case "technician": return "Техник";
      default: return role;
    }
  };

  const getRoleColor = (role: FaceRole) => {
    switch (role) {
      case "admin": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "resident": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "guest": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "courier": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "technician": return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
      default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const deleteProfile = (id: string) => {
    setFaceProfiles(profiles => profiles.filter(p => p.id !== id));
  };

  const addProfile = () => {
    if (faceProfiles.length >= 10) return;
    const newId = (faceProfiles.length + 1).toString();
    setFaceProfiles([...faceProfiles, {
      id: newId,
      name: "Новый профиль",
      role: "guest",
      addedDate: new Date().toLocaleDateString('ru-RU')
    }]);
  };

  return (
    <PageTransition className="pb-20">
      <TopBar title="Настройки" />

      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5 max-w-md md:max-w-none mx-auto">
        {/* CV Face Recognition */}
        <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 h-full flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-medium">База лиц для распознавания</h2>
              <p className="text-sm text-gray-400">{faceProfiles.length}/10 профилей</p>
            </div>
          </div>

          <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex-1 mb-4 space-y-3">
            {faceProfiles.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-3xl mb-2">👤</div>
                <div className="text-sm">Нет профилей</div>
              </div>
            ) : (
              faceProfiles.map((profile) => (
                <div key={profile.id} className="flex items-center justify-between bg-black/30 rounded-xl p-3">
                  <div className="flex-1">
                    <div className="text-sm text-white font-medium">{profile.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded-md text-xs border ${getRoleColor(profile.role)}`}>
                        {getRoleLabel(profile.role)}
                      </span>
                      <span className="text-xs text-gray-500">{profile.addedDate}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteProfile(profile.id)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          <label
            className={`w-full py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer ${
              faceProfiles.length >= 10
                ? "bg-gray-700/50 text-gray-500 cursor-not-allowed"
                : "bg-purple-500 hover:bg-purple-600 text-white"
            }`}
          >
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && faceProfiles.length < 10) {
                  addProfile();
                }
              }}
              disabled={faceProfiles.length >= 10}
              className="hidden"
            />
            <UserPlus className="w-5 h-5" />
            {faceProfiles.length >= 10 ? "Достигнут лимит (10)" : "Добавить профиль"}
          </label>
        </section>

        {/* Climate Delta */}
        <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 h-full flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
              <Sliders className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-medium">Пороги климата</h2>
              <p className="text-sm text-gray-400">Допустимые отклонения</p>
            </div>
          </div>

          <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex-1 space-y-6">
            {/* Temperature Delta */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-orange-400">🌡</span>
                  <span className="text-sm text-gray-300">Дельта температуры</span>
                </div>
                <span className="text-lg font-medium text-white">{tempDelta}°C</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="5"
                step="0.5"
                value={tempDelta}
                onChange={(e) => setTempDelta(parseFloat(e.target.value))}
                className="w-full h-2 bg-black/40 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>±0.5°C</span>
                <span>±5°C</span>
              </div>
            </div>

            {/* Humidity Delta */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-cyan-400">💧</span>
                  <span className="text-sm text-gray-300">Дельта влажности</span>
                </div>
                <span className="text-lg font-medium text-white">{humidityDelta}%</span>
              </div>
              <input
                type="range"
                min="2"
                max="15"
                value={humidityDelta}
                onChange={(e) => setHumidityDelta(parseInt(e.target.value))}
                className="w-full h-2 bg-black/40 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>±2%</span>
                <span>±15%</span>
              </div>
            </div>

            {/* Calculated values example */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mt-4">
              <div className="text-xs text-gray-400 mb-2">Пример расчётных значений (режим Фокус)</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Температура:</span>
                  <span className="text-white ml-2">{(20 - tempDelta).toFixed(1)} - {(20 + tempDelta).toFixed(1)}°C</span>
                </div>
                <div>
                  <span className="text-gray-500">Влажность:</span>
                  <span className="text-white ml-2">{45 - humidityDelta} - {45 + humidityDelta}%</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Telegram */}
        <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 h-full flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <Send className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-medium">Telegram уведомления</h2>
              <p className="text-sm text-gray-400">Настройка оповещений</p>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Chat ID</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                defaultValue="123456789"
                className="flex-1 w-full bg-black/40 border border-white/5 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <button className="bg-blue-500 hover:bg-blue-600 text-white font-medium px-6 py-3 rounded-xl transition-colors shrink-0 whitespace-nowrap">
                Сохранить
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">Узнайте свой Chat ID у бота @userinfobot в Telegram</p>
          </div>

          <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex-1">
            <h3 className="font-medium mb-4 text-gray-200">Типы уведомлений</h3>
            <div className="space-y-3">
              {notifications.map((item) => (
                <label key={item.id} className="flex items-center justify-between cursor-pointer group">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="text-gray-400 group-hover:text-gray-300 transition-colors">🔔</div>
                    <span className="text-gray-300">{item.label}</span>
                  </div>
                  <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${item.checked ? 'bg-blue-500' : 'bg-white/10'}`}>
                    {item.checked && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </div>
                </label>
              ))}
            </div>
          </div>
        </section>

        {/* Служебная информация */}
        <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 h-full flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
              <Database className="w-5 h-5 text-[#00c853]" />
            </div>
            <div>
              <h2 className="text-lg font-medium">Служебная информация</h2>
              <p className="text-sm text-gray-400">Статус системы</p>
            </div>
          </div>

          <div className="space-y-3 flex-1">
            <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-[#00c853]">📶</div>
                <div>
                  <div className="font-medium text-gray-200">Состояние подключения</div>
                  <div className="text-xs text-gray-400">WebSocket сервер</div>
                </div>
              </div>
              <div className="bg-emerald-500/20 text-[#00c853] text-xs px-3 py-1 rounded-full">Online</div>
            </div>

            <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-blue-400">🕒</div>
                <div>
                  <div className="font-medium text-gray-200">Последняя синхронизация</div>
                  <div className="text-xs text-gray-400">Обновление данных</div>
                </div>
              </div>
              <div className="text-sm text-gray-400">2 минуты назад</div>
            </div>

            <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-purple-400">🛡️</div>
                <div>
                  <div className="font-medium text-gray-200">ESP32 устройства</div>
                  <div className="text-xs text-gray-400">Подключенные контроллеры</div>
                </div>
              </div>
              <div className="text-sm text-gray-400">4 активных</div>
            </div>
          </div>
        </section>

        {/* О системе */}
        <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 h-full flex flex-col md:col-span-2">
          <h3 className="text-lg font-medium mb-4 text-gray-300">О системе</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4 text-sm flex-1">
              <div className="flex justify-between border-b border-zinc-800 pb-3">
                <span className="text-gray-400">Версия системы</span>
                <span className="text-gray-300">0.1.0</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800 pb-3">
                <span className="text-gray-400">Дата сборки</span>
                <span className="text-gray-300">24.02.2026</span>
              </div>
              <div className="flex justify-between pb-2">
                <span className="text-gray-400">Лицензия</span>
                <span className="text-gray-300">MIT</span>
              </div>
            </div>

            <div className="space-y-4 text-sm flex-1">
              <div className="flex justify-between border-b border-zinc-800 pb-3">
                <span className="text-gray-400">WebSocket</span>
                <span className="text-green-400">Online</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800 pb-3">
                <span className="text-gray-400">ESP устройств</span>
                <span className="text-gray-300">4</span>
              </div>
              <div className="flex justify-between pb-2">
                <span className="text-gray-400">Режим</span>
                <span className="text-gray-300">MVP</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
