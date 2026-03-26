"use client";
import Link from "next/link";
import { useState, useRef, useCallback } from "react";
import { ChevronRight, Thermometer, Droplet, Flame, Lightbulb, Sun } from "lucide-react";
import { useSensorData, wsManager, useDeviceState } from "@/hooks/useSensorData";
import { useAmbientSound } from "@/hooks/useAmbientSound";
import { LIGHT_PRESETS } from "@/lib/office-light-presets";
import { CLIMATE_TARGETS, toEspThresholds } from "@/lib/office-climate-presets";

const OFFICE_DEVICE_ID = "esp_office_01";

type OfficeMode = "focus" | "rest" | "manual" | "off";

export function OfficeCard() {
  const [mode, setMode] = useState<OfficeMode>("focus");
  const [manualTemp, setManualTemp] = useState(CLIMATE_TARGETS.manual.temp);
  const [manualHumidity, setManualHumidity] = useState(CLIMATE_TARGETS.manual.humidity);
  const [manualBrightness, setManualBrightness] = useState(180);
  const [manualColorTemp, setManualColorTemp] = useState(4000);

  const climateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lightDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendLightCommand = useCallback((state: boolean, brightness?: number, colorTemp?: number) => {
    if (lightDebounceRef.current) clearTimeout(lightDebounceRef.current);
    lightDebounceRef.current = setTimeout(() => {
      wsManager.send({
        type: "device_command",
        device: "office_light",
        action: "set_state",
        state,
        ...(brightness !== undefined && { brightness }),
        ...(colorTemp !== undefined && { colorTemp }),
      });
    }, 150);
  }, []);

  const sendClimateThresholds = useCallback((targetTemp: number, targetHumidity: number) => {
    if (climateDebounceRef.current) clearTimeout(climateDebounceRef.current);
    climateDebounceRef.current = setTimeout(() => {
      wsManager.send({
        type: "settings_sync",
        device: "office",
        settings: toEspThresholds(targetTemp, targetHumidity),
      });
    }, 150);
  }, []);

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

  const { playModeSound } = useAmbientSound();
  const tempData = useSensorData(OFFICE_DEVICE_ID, "temperature");
  const humData = useSensorData(OFFICE_DEVICE_ID, "humidity");
  const humidifier = useDeviceState("office_humidifier");
  const conditioner = useDeviceState("window");

  const parseSensorValue = (val: number | boolean | string | undefined): number => {
    if (val === undefined || val === null) return 0;
    if (typeof val === "number") return val;
    const n = parseFloat(String(val));
    return isNaN(n) ? 0 : n;
  };

  const currentTemp = parseSensorValue(tempData.data?.value) || 22;
  const currentHumidity = parseSensorValue(humData.data?.value) || 45;
  const windowOpen = conditioner.isOn;
  const humidifierOn = humidifier.isOn;

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
                    const newMode = m as OfficeMode;
                    setMode(newMode);
                    playModeSound(newMode);
                    const preset = LIGHT_PRESETS[newMode];
                    wsManager.send({
                      type: "device_command",
                      device: "office_light",
                      action: "set_state",
                      state: preset.state,
                      ...(preset.brightness !== undefined && { brightness: preset.brightness }),
                      ...(preset.colorTemp !== undefined && { colorTemp: preset.colorTemp }),
                    });
                    if (newMode === "focus" || newMode === "rest") {
                      sendClimateThresholds(CLIMATE_TARGETS[newMode].temp, CLIMATE_TARGETS[newMode].humidity);
                    } else if (newMode === "manual") {
                      sendLightCommand(true, manualBrightness, manualColorTemp);
                      sendClimateThresholds(manualTemp, manualHumidity);
                    }
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
                        {`🌡 ${CLIMATE_TARGETS[mode as "focus" | "rest"].temp}°C`}
                      </span>
                      <span className={`text-xs ${getModeTextColor(mode)}`}>
                        {`💧 ${CLIMATE_TARGETS[mode as "focus" | "rest"].humidity}%`}
                      </span>
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-400 mb-3">Текущие показания</div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Thermometer className="w-4 h-4 text-orange-400" />
                    <span className="text-sm text-white">
                      {tempData.loading ? "..." : `${currentTemp.toFixed(1)}°C`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Droplet className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm text-white">
                      {humData.loading ? "..." : `${currentHumidity.toFixed(0)}%`}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">Кондиционер:</span>
                    <span className={windowOpen ? "text-blue-400" : "text-gray-400"}>
                      {windowOpen ? "Вкл" : "Выкл"}
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
                      onChange={(e) => {
                        const v = parseInt(e.target.value);
                        setManualTemp(v);
                        sendClimateThresholds(v, manualHumidity);
                      }}
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
                      onChange={(e) => {
                        const v = parseInt(e.target.value);
                        setManualHumidity(v);
                        sendClimateThresholds(manualTemp, v);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.preventDefault()}
                      className="w-full h-2 bg-black/40 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400"
                    />
                  </div>

                  {/* Device toggles */}
                  <div className="pt-2 border-t border-white/10" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                    <div className="text-xs text-gray-400 mb-2">Устройства</div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); conditioner.toggle(); }}
                        className={`p-2.5 rounded-xl border transition-all ${
                          windowOpen ? "bg-blue-500/20 border-blue-500" : "bg-black/40 border-white/10"
                        }`}
                      >
                        <Thermometer className="w-4 h-4 mx-auto mb-1" />
                        <span className="text-xs block">Кондиционер</span>
                        <span className="text-[10px] block text-gray-400">{windowOpen ? "Вкл" : "Выкл"}</span>
                      </button>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); humidifier.toggle(); }}
                        className={`p-2.5 rounded-xl border transition-all ${
                          humidifierOn ? "bg-cyan-500/20 border-cyan-500" : "bg-black/40 border-white/10"
                        }`}
                      >
                        <Droplet className="w-4 h-4 mx-auto mb-1" />
                        <span className="text-xs block">Увлажнитель</span>
                        <span className="text-[10px] block text-gray-400">{humidifierOn ? "Вкл" : "Выкл"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Light sliders */}
                  <div className="pt-2 border-t border-white/10" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb className="w-3.5 h-3.5 text-yellow-400" />
                      <span className="text-xs text-gray-400">Освещение</span>
                    </div>
                    <div className="space-y-2">
                      <div onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-400">Яркость</span>
                          <span className="text-xs text-amber-400 font-medium">{Math.round(manualBrightness / 2.55)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="255"
                          value={manualBrightness}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setManualBrightness(v);
                            sendLightCommand(true, v, manualColorTemp);
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.preventDefault()}
                          className="w-full h-2 bg-black/40 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1">
                            <Sun className="w-3 h-3 text-orange-300" />
                            <span className="text-xs text-gray-400">Цв. температура</span>
                          </div>
                          <span className="text-xs text-orange-300 font-medium">{manualColorTemp}K</span>
                        </div>
                        <input
                          type="range"
                          min="2700"
                          max="6500"
                          value={manualColorTemp}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setManualColorTemp(v);
                            sendLightCommand(true, manualBrightness, v);
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.preventDefault()}
                          className="w-full h-2 bg-black/40 rounded-lg appearance-none cursor-pointer accent-orange-400"
                        />
                      </div>
                    </div>
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
