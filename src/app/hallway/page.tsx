"use client";
import { useState } from "react";
import { PageTransition } from "@/components/PageTransition";
import { TopBar } from "@/components/TopBar";
import { Lightbulb, Zap, Pause, Play } from "lucide-react";
import { useMotionSensor } from "@/hooks/useSensorData";

const HALLWAY_DEVICE_ID = "esp_hallway_01";

export default function HallwayPage() {
  const { isDetected } = useMotionSensor(HALLWAY_DEVICE_ID);

  const [brightness, setBrightness] = useState(75);
  const [isOn, setIsOn] = useState(true);
  const [autoMode, setAutoMode] = useState(true);
  const [timeout, setTimeout] = useState(5);

  const brightnessPresets = [
    { label: "Слабо", value: 25 },
    { label: "Средне", value: 50 },
    { label: "Ярко", value: 100 },
  ];

  const handlePresetClick = (value: number) => {
    setBrightness(value);
    setAutoMode(false);
    setIsOn(value > 0);
  };

  const handleBrightnessChange = (value: number) => {
    setBrightness(value);
    setAutoMode(false);
    setIsOn(value > 0);
  };

  return (
    <PageTransition className="pb-20">
      <TopBar title="Прихожая" showSettings />

      <div className="p-5 max-w-md md:max-w-none mx-auto space-y-5">
        {/* Light Control */}
        <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-xl shadow-black/40">
          <h3 className="text-lg font-semibold mb-4">Освещение</h3>

          {/* Power Button with Glow Effect */}
          <button
            onClick={() => {
              setIsOn(!isOn);
              if (!isOn) setBrightness(brightness > 0 ? brightness : 50);
              else setBrightness(0);
            }}
            className={`w-full p-4 rounded-2xl flex items-center justify-center gap-3 transition-all ${
              isOn
                ? "bg-amber-500/20 border-2 border-amber-500 shadow-lg shadow-amber-500/30"
                : "bg-black/40 border border-white/5 hover:bg-white/10"
            }`}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center">
              <Lightbulb className={`w-6 h-6 ${isOn ? "text-amber-400" : "text-gray-500"}`} />
            </div>
            <div className="text-left">
              <div className={`text-lg font-bold ${isOn ? "text-amber-400" : "text-gray-400"}`}>
                {isOn ? "ВКЛ" : "ВЫКЛ"}
              </div>
              <div className="text-xs text-gray-500">
                {isOn ? "Свет включён" : "Свет выключен"}
              </div>
            </div>
          </button>

          {/* Brightness Presets */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {brightnessPresets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePresetClick(preset.value)}
                className={`p-3 rounded-xl transition-all border ${
                  brightness === preset.value && isOn
                    ? "bg-amber-500/20 border-amber-500"
                    : "bg-black/40 border-white/5 hover:bg-white/10"
                }`}
              >
                <div className="text-sm font-medium">{preset.label}</div>
                <div className="text-xs text-gray-500">{preset.value}%</div>
              </button>
            ))}
          </div>

          {/* Brightness Slider */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Яркость</span>
              <span className={`text-sm font-bold ${isOn ? "text-amber-400" : "text-gray-500"}`}>
                {brightness}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={brightness}
              onChange={(e) => handleBrightnessChange(Number(e.target.value))}
              disabled={!isOn}
              className={`w-full h-2 rounded-full appearance-none cursor-pointer ${
                !isOn ? "opacity-50" : ""
              }`}
              style={{
                background: isOn
                  ? `linear-gradient(to right, #fbbf24 0%, #fbbf24 ${brightness}%, #333 ${brightness}%, #333 100%)`
                  : "#333"
              }}
            />
          </div>
        </section>

        {/* Motion Sensor */}
        <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-xl shadow-black/40">
          <h3 className="text-lg font-semibold mb-4">Датчик движения</h3>

          <div className={`flex items-center gap-3 p-4 rounded-2xl ${
            isDetected
              ? "bg-emerald-500/10 border border-emerald-500/30"
              : "bg-black/40 border border-white/5"
          }`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isDetected ? "bg-emerald-500/20" : "bg-gray-700"
            }`}>
              <Zap className={`w-6 h-6 ${isDetected ? "text-emerald-400 animate-pulse" : "text-gray-500"}`} />
            </div>
            <div>
              <div className={`text-lg font-bold ${isDetected ? "text-emerald-400" : "text-gray-400"}`}>
                {isDetected ? "Обнаружено" : "Нет"}
              </div>
              <div className="text-xs text-gray-500">
                {isDetected ? "Движение зафиксировано" : "Движения не обнаружено"}
              </div>
            </div>
          </div>
        </section>

        {/* Automation */}
        <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-xl shadow-black/40">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Автоматизация</h3>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${autoMode ? "bg-blue-400" : "bg-amber-400"}`} />
              <span className={`text-sm font-medium ${autoMode ? "text-blue-400" : "text-amber-400"}`}>
                {autoMode ? "Активна" : "Пауза"}
              </span>
            </div>
          </div>

          <div className={`flex items-center justify-between p-4 rounded-2xl ${
            autoMode
              ? "bg-blue-500/10 border border-blue-500/30"
              : "bg-amber-500/10 border border-amber-500/30"
          }`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center">
                <Zap className={`w-6 h-6 ${autoMode ? "text-blue-400" : "text-amber-400"}`} />
              </div>
              <div>
                <div className="text-sm font-medium">
                  {autoMode ? "По датчику движения" : "Автоматизация приостановлена"}
                </div>
                <div className="text-xs text-gray-500">
                  {autoMode ? "Автоматическое включение" : "Фиксированные настройки"}
                </div>
              </div>
            </div>

            <button
              onClick={() => setAutoMode(!autoMode)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                autoMode
                  ? "bg-amber-500 hover:bg-amber-600"
                  : "bg-blue-500 hover:bg-blue-600"
              }`}
            >
              {autoMode ? (
                <Pause className="w-5 h-5 text-black" />
              ) : (
                <Play className="w-5 h-5 text-black" />
              )}
            </button>
          </div>

          {/* Automation Timeout */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Таймаут автоматизации</span>
              <span className="text-sm text-blue-400 font-medium">{timeout} мин</span>
            </div>
            <input
              type="range"
              min="1"
              max="30"
              value={timeout}
              onChange={(e) => setTimeout(Number(e.target.value))}
              disabled={!autoMode}
              className={`w-full h-2 rounded-full appearance-none cursor-pointer ${
                !autoMode ? "opacity-50" : ""
              }`}
              style={{
                background: autoMode
                  ? `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((timeout - 1) / 29) * 100}%, #333 ${((timeout - 1) / 29) * 100}%, #333 100%)`
                  : "#333"
              }}
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1 мин</span>
              <span>30 мин</span>
            </div>
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
