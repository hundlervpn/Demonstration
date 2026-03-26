"use client";
import { useState, useRef, useCallback } from "react";
import { PageTransition } from "@/components/PageTransition";
import { TopBar } from "@/components/TopBar";
import { Brain, Coffee, Settings2, Power, Thermometer, Droplet, Sun, Lightbulb } from "lucide-react";
import { useSensorData, wsManager, useDeviceState } from "@/hooks/useSensorData";
import { useAmbientSound } from "@/hooks/useAmbientSound";
import { LIGHT_PRESETS } from "@/lib/office-light-presets";
import { CLIMATE_TARGETS, toEspThresholds } from "@/lib/office-climate-presets";

const OFFICE_DEVICE_ID = "esp_office_01";

type EnvironmentMode = "focus" | "rest" | "manual" | "off";

export default function OfficePage() {
  const [mode, setMode] = useState<EnvironmentMode>("focus");

  // Real sensor data from WebSocket
  const tempData = useSensorData(OFFICE_DEVICE_ID, "temperature");
  const humData = useSensorData(OFFICE_DEVICE_ID, "humidity");
  const humidifier = useDeviceState("office_humidifier");
  const conditioner = useDeviceState("window");
  const { playModeSound } = useAmbientSound();

  // Parse sensor values (handle string/number types)
  const parseSensorValue = (value: number | boolean | string | undefined): number => {
    if (value === undefined || value === null) return 0;
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const currentTemp = parseSensorValue(tempData.data?.value);
  const currentHumidity = parseSensorValue(humData.data?.value);
  const windowOpen = conditioner.isOn;
  const humidifierOn = humidifier.isOn;

  // Manual mode target values
  const [manualTargetTemp, setManualTargetTemp] = useState(CLIMATE_TARGETS.manual.temp);
  const [manualTargetHumidity, setManualTargetHumidity] = useState(CLIMATE_TARGETS.manual.humidity);
  const [manualBrightness, setManualBrightness] = useState(180);
  const [manualColorTemp, setManualColorTemp] = useState(4000);

  const lightDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const climateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    }, 150); // debounce: ждём 150мс после последнего движения слайдера
  }, []);

  const handleModeChange = (newMode: EnvironmentMode) => {
    setMode(newMode);
    playModeSound(newMode);
    const preset = LIGHT_PRESETS[newMode];
    if (newMode === "manual") {
      sendLightCommand(true, manualBrightness, manualColorTemp);
      sendClimateThresholds(manualTargetTemp, manualTargetHumidity);
    } else if (newMode === "focus" || newMode === "rest") {
      sendLightCommand(preset.state, preset.brightness, preset.colorTemp);
      sendClimateThresholds(CLIMATE_TARGETS[newMode].temp, CLIMATE_TARGETS[newMode].humidity);
    } else {
      sendLightCommand(preset.state, preset.brightness, preset.colorTemp);
    }
  };

  const getModeColor = (currentMode: EnvironmentMode) => {
    switch (currentMode) {
      case "focus":
      case "rest":
        return "bg-cyan-500/20 border-cyan-500 text-cyan-400";
      case "manual":
        return "bg-amber-500/20 border-amber-500 text-amber-400";
      case "off":
        return "bg-red-500/20 border-red-500 text-red-400";
    }
  };

  const getModeLabel = (currentMode: EnvironmentMode) => {
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

  return (
    <PageTransition className="pb-20">
      <TopBar title="Кабинет" showSettings />

      <div className="p-5 max-w-md md:max-w-none mx-auto space-y-5">
        {/* Environment Mode Selector */}
        <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-xl shadow-black/40">
          <h3 className="text-lg font-semibold mb-4">Управление средой</h3>
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => handleModeChange("focus")}
              className={`p-3 rounded-xl transition-all border ${
                mode === "focus"
                  ? "bg-cyan-500/20 border-cyan-500"
                  : "bg-black/40 border-white/5 hover:bg-white/10"
              }`}
            >
              <Brain className={`w-6 h-6 mx-auto mb-2 ${mode === "focus" ? "text-cyan-400" : "text-gray-400"}`} />
              <span className="text-xs font-medium">Фокус</span>
            </button>
            <button
              onClick={() => handleModeChange("rest")}
              className={`p-3 rounded-xl transition-all border ${
                mode === "rest"
                  ? "bg-emerald-500/20 border-emerald-500"
                  : "bg-black/40 border-white/5 hover:bg-white/10"
              }`}
            >
              <Coffee className={`w-6 h-6 mx-auto mb-2 ${mode === "rest" ? "text-emerald-400" : "text-gray-400"}`} />
              <span className="text-xs font-medium">Отдых</span>
            </button>
            <button
              onClick={() => handleModeChange("manual")}
              className={`p-3 rounded-xl transition-all border ${
                mode === "manual"
                  ? "bg-amber-500/20 border-amber-500"
                  : "bg-black/40 border-white/5 hover:bg-white/10"
              }`}
            >
              <Settings2 className={`w-6 h-6 mx-auto mb-2 ${mode === "manual" ? "text-amber-400" : "text-gray-400"}`} />
              <span className="text-xs font-medium">Ручной</span>
            </button>
            <button
              onClick={() => handleModeChange("off")}
              className={`p-3 rounded-xl transition-all border ${
                mode === "off"
                  ? "bg-red-500/20 border-red-500"
                  : "bg-black/40 border-white/5 hover:bg-white/10"
              }`}
            >
              <Power className={`w-6 h-6 mx-auto mb-2 ${mode === "off" ? "text-red-400" : "text-gray-400"}`} />
              <span className="text-xs font-medium">Выкл</span>
            </button>
          </div>
        </section>

        {/* OFF state */}
        {mode === "off" && (
          <section className="bg-gray-700/20 border border-gray-700/30 rounded-3xl p-8 text-center">
            <Power className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg text-gray-400">Система выключена</h3>
            <p className="text-sm text-gray-500 mt-2">Выберите режим для активации</p>
          </section>
        )}

        {/* Active modes: current readings always visible */}
        {mode !== "off" && (
          <section className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-xl shadow-black/40 ${
            mode === "manual" ? "border-amber-500/30" : "border-cyan-500/30"
          }`}>
            <h3 className="text-lg font-semibold mb-4">
              {mode === "manual" ? "Ручное управление" : mode === "focus" ? "Режим «Фокус»" : "Режим «Отдых»"}
            </h3>

            {/* Current Readings */}
            <div className="bg-black/40 border border-white/5 rounded-2xl p-4 mb-4">
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

              {/* Target values for focus/relax */}
              {(mode === "focus" || mode === "rest") && (
                <div className="mt-3 pt-3 border-t border-cyan-500/20">
                  <div className="text-xs text-gray-400 mb-2">Целевые значения</div>
                  <div className="flex gap-4">
                    <span className={`text-sm ${mode === "focus" ? "text-cyan-400" : "text-emerald-400"}`}>
                      {`🌡 ${CLIMATE_TARGETS[mode as "focus" | "rest"].temp}°C`}
                    </span>
                    <span className={`text-sm ${mode === "focus" ? "text-cyan-400" : "text-emerald-400"}`}>
                      {`💧 ${CLIMATE_TARGETS[mode as "focus" | "rest"].humidity}%`}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Manual mode sliders */}
            {mode === "manual" && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">Целевая температура</span>
                    <span className="text-xs text-amber-400 font-medium">{manualTargetTemp}°C</span>
                  </div>
                  <input
                    type="range"
                    min="16"
                    max="28"
                    value={manualTargetTemp}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setManualTargetTemp(v);
                      sendClimateThresholds(v, manualTargetHumidity);
                    }}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gray-700"
                    style={{
                      background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${((manualTargetTemp - 16) / 12) * 100}%, #2a2a2a ${((manualTargetTemp - 16) / 12) * 100}%, #2a2a2a 100%)`
                    }}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">Целевая влажность</span>
                    <span className="text-xs text-amber-400 font-medium">{manualTargetHumidity}%</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="70"
                    value={manualTargetHumidity}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setManualTargetHumidity(v);
                      sendClimateThresholds(manualTargetTemp, v);
                    }}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gray-700"
                    style={{
                      background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${((manualTargetHumidity - 30) / 40) * 100}%, #2a2a2a ${((manualTargetHumidity - 30) / 40) * 100}%, #2a2a2a 100%)`
                    }}
                  />
                </div>

                {/* Device toggles */}
                <div className="pt-2 border-t border-white/10">
                  <div className="text-xs text-gray-400 mb-3">Устройства</div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => conditioner.toggle()}
                      className={`p-3 rounded-xl border transition-all ${
                        windowOpen ? "bg-blue-500/20 border-blue-500" : "bg-black/40 border-white/10"
                      }`}
                    >
                      <Thermometer className="w-5 h-5 mx-auto mb-1" />
                      <span className="text-xs block">Кондиционер</span>
                      <span className="text-[10px] block text-gray-400">{windowOpen ? "Вкл" : "Выкл"}</span>
                    </button>
                    <button
                      onClick={() => humidifier.toggle()}
                      className={`p-3 rounded-xl border transition-all ${
                        humidifierOn ? "bg-cyan-500/20 border-cyan-500" : "bg-black/40 border-white/10"
                      }`}
                    >
                      <Droplet className="w-5 h-5 mx-auto mb-1" />
                      <span className="text-xs block">Увлажнитель</span>
                      <span className="text-[10px] block text-gray-400">{humidifierOn ? "Вкл" : "Выкл"}</span>
                    </button>
                  </div>
                </div>

                {/* Light controls */}
                <div className="pt-2 border-t border-white/10">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="w-4 h-4 text-yellow-400" />
                    <span className="text-xs text-gray-400">Освещение (RGB-лента)</span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-2">
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
                        className="w-full h-2 rounded-full appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${(manualBrightness / 255) * 100}%, #2a2a2a ${(manualBrightness / 255) * 100}%, #2a2a2a 100%)`
                        }}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <Sun className="w-3.5 h-3.5 text-orange-300" />
                          <span className="text-xs text-gray-400">Цветовая температура</span>
                          <Sun className="w-3.5 h-3.5 text-blue-300" />
                        </div>
                        <span className="text-xs text-amber-400 font-medium">{manualColorTemp}K</span>
                      </div>
                      <input
                        type="range"
                        min="2700"
                        max="6500"
                        step="100"
                        value={manualColorTemp}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setManualColorTemp(v);
                          sendLightCommand(true, manualBrightness, v);
                        }}
                        className="w-full h-2 rounded-full appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, #ff9a3c, #fff4e0, #cce4ff)`
                        }}
                      />
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-orange-300">Тёплый</span>
                        <span className="text-[10px] text-blue-300">Холодный</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </PageTransition>
  );
}
