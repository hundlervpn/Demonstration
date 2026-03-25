"use client";
import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Thermometer, Droplet, Flame } from "lucide-react";

type OfficeMode = "focus" | "rest" | "manual" | "off";

export function OfficeCard() {
  const [mode, setMode] = useState<OfficeMode>("focus");
  const [manualTemp, setManualTemp] = useState(22);
  const [manualHumidity, setManualHumidity] = useState(45);

  const getModeColor = (currentMode: OfficeMode) => {
    switch (currentMode) {
      case "focus":
      case "rest":
        return "bg-cyan-500/20 border-cyan-500";
      case "manual":
        return "bg-amber-500/20 border-amber-500";
      case "off":
        return "bg-red-500/20 border-red-500";
    }
  };

  const getModeTextColor = (currentMode: OfficeMode) => {
    switch (currentMode) {
      case "focus":
      case "rest":
        return "text-cyan-400";
      case "manual":
        return "text-amber-400";
      case "off":
        return "text-red-400";
    }
  };

  const getModeLabel = (currentMode: OfficeMode) => {
    switch (currentMode) {
      case "focus":
        return "Фокус";
      case "rest":
        return "Отдых";
      case "manual":
        return "Ручной";
      case "off":
        return "Выкл";
    }
  };

  // Mock data - will be replaced with real WebSocket data
  const currentTemp = 22;
  const currentHumidity = 45;
  const windowOpen = false;
  const humidifierOn = false;

  return (
    <Link href="/office" className="block h-full">
      <section className="h-full flex flex-col rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 p-5 shadow-xl shadow-black/40 transition-all duration-300 hover:bg-white/10 hover:shadow-2xl hover:scale-[1.02]">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Кабинет</h3>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>

          <p className="mt-2 text-xs uppercase tracking-wide text-gray-500">
            Климат и атмосфера
          </p>

          {/* Mode Selector */}
          <div className="mt-4">
            <div className="grid grid-cols-4 gap-2">
              {["focus", "rest", "manual", "off"].map((m) => (
                <button
                  key={m}
                  onClick={(e) => {
                    e.preventDefault();
                    setMode(m as OfficeMode);
                  }}
                  className={`p-2.5 rounded-xl transition-all border ${
                    mode === m
                      ? getModeColor(m as OfficeMode)
                      : "bg-black/40 border-white/5 hover:bg-white/10"
                  }`}
                >
                  {m === "focus" && (
                    <svg className="w-5 h-5 mx-auto mb-1 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3" />
                      <circle cx="12" cy="12" r="8" />
                    </svg>
                  )}
                  {m === "rest" && (
                    <span className="text-xl mb-1 block">☕</span>
                  )}
                  {m === "manual" && (
                    <svg className="w-5 h-5 mx-auto mb-1 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                  )}
                  {m === "off" && (
                    <svg className="w-5 h-5 mx-auto mb-1 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v10M18.36 6.64a9 9 0 1 1-12.73 0" />
                    </svg>
                  )}
                  <div className="text-xs text-gray-400">{getModeLabel(m as OfficeMode)}</div>
                </button>
              ))}
            </div>
          </div>

          {/* OFF state */}
          {mode === "off" && (
            <div className="mt-4 bg-gray-700/20 rounded-2xl p-3 text-center">
              <div className="text-sm text-gray-400">Система выключена</div>
            </div>
          )}

          {/* Active modes */}
          {mode !== "off" && (
            <div className="mt-4">
              {/* Current Readings */}
              <div className={`rounded-2xl p-4 border ${
                mode === "manual"
                  ? "bg-amber-500/10 border-amber-500/30"
                  : "bg-cyan-500/10 border-cyan-500/30"
              }`}>
                {/* Target values for auto modes */}
                {(mode === "focus" || mode === "rest") && (
                  <div className="mb-3 pb-3 border-b border-cyan-500/20">
                    <div className="text-xs text-gray-400 mb-1">Целевые значения</div>
                    <div className="flex gap-4">
                      <span className={`text-xs ${getModeTextColor(mode)}`}>
                        {mode === "focus" ? "🌡 20°C" : "🌡 23°C"}
                      </span>
                      <span className={`text-xs ${getModeTextColor(mode)}`}>
                        {mode === "focus" ? "💧 45%" : "💧 55%"}
                      </span>
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-400 mb-3">Текущие показания</div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Thermometer className="w-4 h-4 text-orange-400" />
                    <span className="text-sm text-white">{currentTemp}°C</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Droplet className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm text-white">{currentHumidity}%</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">Окно:</span>
                    <span className={windowOpen ? "text-blue-400" : "text-gray-400"}>
                      {windowOpen ? "Открыто" : "Закрыто"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">Увлажнитель:</span>
                    <span className={humidifierOn ? "text-cyan-400" : "text-gray-400"}>
                      {humidifierOn ? "Вкл" : "Выкл"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Manual mode indicators */}
              {mode === "manual" && (
                <div className="mt-3 space-y-3">
                  <div className="text-xs text-amber-400 mb-2">Ручное управление параметрами</div>

                  {/* Temperature Slider */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Thermometer className="w-4 h-4 text-orange-400" />
                        <span className="text-xs text-gray-400">Температура</span>
                      </div>
                      <span className="text-sm text-white font-medium">{manualTemp}°C</span>
                    </div>
                    <input
                      type="range"
                      min="16"
                      max="28"
                      value={manualTemp}
                      onChange={(e) => setManualTemp(parseInt(e.target.value))}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.preventDefault()}
                      className="w-full h-2 bg-black/40 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400"
                    />
                  </div>

                  {/* Humidity Slider */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Droplet className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs text-gray-400">Влажность</span>
                      </div>
                      <span className="text-sm text-white font-medium">{manualHumidity}%</span>
                    </div>
                    <input
                      type="range"
                      min="30"
                      max="70"
                      value={manualHumidity}
                      onChange={(e) => setManualHumidity(parseInt(e.target.value))}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.preventDefault()}
                      className="w-full h-2 bg-black/40 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </Link>
  );
}
