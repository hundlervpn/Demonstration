"use client";
import { Battery, Package, MapPin, Cpu } from "lucide-react";
import { useRobotData } from "@/hooks/useSensorData";

export function RobotCard() {
  const { data, loading, connected } = useRobotData();

  // Default values when no data
  const isActive = data?.isActive ?? false;
  const task = data?.task ?? "Ожидание";
  const battery = data?.battery ?? 0;
  const location = data?.location ?? "Неизвестно";
  const cansCollected = data?.cansCollected ?? 0;
  const isCharging = data?.isCharging ?? false;

  // Battery color based on level
  const batteryColor = battery > 50 ? "text-green-400" : battery > 20 ? "text-yellow-400" : "text-red-400";

  return (
    <section className="h-full flex flex-col rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 p-5 shadow-xl shadow-black/40 transition-all duration-300 hover:bg-white/10 hover:shadow-2xl hover:scale-[1.02]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
            <Cpu className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Робот</h3>
            <p className="text-xs text-gray-500 uppercase tracking-wider">
              {loading ? "Подключение..." : connected ? "Автономный агент" : "Отключен"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isActive ? "bg-green-500 animate-pulse" : "bg-gray-500"}`} />
          <span className={`text-xs ${isActive ? "text-green-400" : "text-gray-400"}`}>
            {loading ? "..." : isActive ? "Активен" : "Ожидает"}
          </span>
        </div>
      </div>

      {/* Status Grid */}
      <div className="grid grid-cols-2 gap-3 flex-1">
        {/* Current Task - full width */}
        <div className="bg-black/40 border border-white/5 rounded-2xl p-3 col-span-2">
          <div className="text-xs text-gray-500 mb-1">Текущая задача</div>
          <div className="text-sm text-white">{loading ? "..." : task}</div>
        </div>

        {/* Battery */}
        <div className="bg-black/40 border border-white/5 rounded-2xl p-3 flex items-center gap-3">
          <Battery className={`w-5 h-5 flex-shrink-0 ${isCharging ? "text-blue-400 animate-pulse" : batteryColor}`} />
          <div>
            <div className="text-xs text-gray-500">{isCharging ? "Заряжается" : "Заряд"}</div>
            <div className={`text-sm font-medium ${batteryColor}`}>{loading ? "..." : `${battery}%`}</div>
          </div>
        </div>

        {/* Cans counter */}
        <div className="bg-black/40 border border-white/5 rounded-2xl p-3 flex items-center gap-3">
          <Package className="w-5 h-5 text-yellow-400 flex-shrink-0" />
          <div>
            <div className="text-xs text-gray-500">Банок собрано</div>
            <div className="text-sm font-medium text-yellow-400">{loading ? "..." : `${cansCollected} шт.`}</div>
          </div>
        </div>

        {/* Location - full width */}
        <div className="bg-black/40 border border-white/5 rounded-2xl p-3 flex items-center gap-3 col-span-2">
          <MapPin className="w-5 h-5 text-blue-400 flex-shrink-0" />
          <div>
            <div className="text-xs text-gray-500">Местоположение</div>
            <div className="text-sm text-white">{loading ? "..." : location}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
