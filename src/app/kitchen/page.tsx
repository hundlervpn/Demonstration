"use client";
import { useState, useEffect, useRef } from "react";
import { PageTransition } from "@/components/PageTransition";
import { TopBar } from "@/components/TopBar";
import { Wind, CheckCircle2, AlertTriangle } from "lucide-react";
import { useGasSensor, useDeviceState } from "@/hooks/useSensorData";

const GAS_DEVICE_ID = "esp_kitchen_01";
const FAN_DEVICE_ID = "kitchen_fan";

export default function KitchenPage() {
  const { value, isSafe, status, loading, hasData, history } = useGasSensor(GAS_DEVICE_ID);
  const fanState = useDeviceState(FAN_DEVICE_ID);

  const [fanAuto, setFanAuto] = useState(true);
  const [simulateLeak, setSimulateLeak] = useState(false);

  // Use refs to avoid stale closures in effect
  const isSafeRef = useRef(isSafe);
  const hasDataRef = useRef(hasData);
  const fanAutoRef = useRef(fanAuto);
  const simulateLeakRef = useRef(simulateLeak);
  const fanIsOnRef = useRef(fanState.isOn);

  useEffect(() => {
    isSafeRef.current = isSafe;
    hasDataRef.current = hasData;
    fanAutoRef.current = fanAuto;
    simulateLeakRef.current = simulateLeak;
    fanIsOnRef.current = fanState.isOn;
  });

  const fanIsOn = fanState.isOn;

  // Auto mode: turn fan on when gas level is unsafe, off when safe
  useEffect(() => {
    const auto = fanAutoRef.current;
    const data = hasDataRef.current;
    const safe = isSafeRef.current;
    const leak = simulateLeakRef.current;
    const on = fanIsOnRef.current;

    console.log(`[Kitchen] Auto effect: auto=${auto}, hasData=${data}, isSafe=${safe}, simulateLeak=${leak}, isOn=${on}, gas=${value}`);

    if (!auto || !data) return;

    const shouldBeOn = !safe || leak;
    console.log(`[Kitchen] shouldBeOn=${shouldBeOn}, currentIsOn=${on}`);

    if (shouldBeOn && !on) {
      console.log(`[Kitchen] Auto mode: turning fan ON`);
      fanState.setOn();
    } else if (!shouldBeOn && on) {
      console.log(`[Kitchen] Auto mode: turning fan OFF`);
      fanState.setOff();
    }
  }, [isSafe, hasData, fanAuto, simulateLeak, fanState.isOn, value]);

  // Debug logging
  console.log(`[Kitchen] Render: fanState.state=${fanState.state}, fanState.isOn=${fanState.isOn}, fanIsOn=${fanIsOn}, fanAuto=${fanAuto}`);

  // Debug logging
  useEffect(() => {
    console.log(`[KitchenPage] fanState.state=${fanState.state}, fanState.isOn=${fanState.isOn}, fanIsOn=${fanIsOn}, fanAuto=${fanAuto}`);
  }, [fanState.state, fanState.isOn, fanIsOn, fanAuto]);

  const getStatusText = () => {
    if (simulateLeak) return "Опасно";
    if (loading) return "Загрузка...";
    if (!hasData) return "Нет данных";
    if (status === "safe") return "Норма";
    if (status === "warning") return "Внимание";
    return "Опасно";
  };

  const getStatusColor = () => {
    if (simulateLeak) return "text-red-400";
    if (status === "safe") return "text-green-400";
    if (status === "warning") return "text-yellow-400";
    return "text-red-400";
  };

  const getStatusBgColor = () => {
    if (simulateLeak) return "bg-red-500/20 border-red-500";
    if (status === "safe") return "bg-green-500/20 border-green-500";
    if (status === "warning") return "bg-yellow-500/20 border-yellow-500";
    return "bg-red-500/20 border-red-500";
  };

  // Build chart data from real sensor history (last 15 readings)
  const getHistoryData = (): number[] => {
    if (history.length === 0) return [40, 45, 42, 50, 48, 45, 43, 40, 42, 45, 48, 50, 45, 42, 40];
    const recent = history.slice(0, 15).reverse();
    const values = recent.map((h) => {
      const v = typeof h.value === "string" ? parseFloat(h.value) : Number(h.value);
      return isNaN(v) ? 0 : v;
    });
    const maxVal = Math.max(...values, 1);
    // Scale to percentage height (5% min so bars are always visible)
    return values.map((v) => Math.max(5, Math.round((v / maxVal) * 95)));
  };

  return (
    <PageTransition className="pb-20">
      <TopBar title="Кухня" showSettings />

      <div className="p-5 max-w-md md:max-w-none mx-auto space-y-5">
        {/* Gas Sensor Status */}
        <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-xl shadow-black/40">
          <h3 className="text-lg font-semibold mb-4">Датчик газа</h3>

          <div className={`flex items-center gap-4 p-6 rounded-2xl ${getStatusBgColor()} border border-opacity-30`}>
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              isSafe && !simulateLeak ? "bg-green-500/20" : "bg-red-500/20"
            }`}>
              <Wind className={`w-8 h-8 ${getStatusColor()}`} />
            </div>
            <div className="flex-1">
              <div className={`text-4xl font-bold ${getStatusColor()}`}>
                {getStatusText()}
              </div>
              <div className="text-sm text-gray-400 mt-1">
                {loading
                  ? "Получение данных..."
                  : hasData
                    ? `Уровень: ${Math.round(value)} ppm`
                    : "Ожидание данных от ESP..."}
              </div>
            </div>
          </div>
        </section>

        {/* History Chart */}
        <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-xl shadow-black/40">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">История показаний</h3>
            <div className="text-xs text-gray-500">Последние 15 минут</div>
          </div>

          <div className="flex items-end gap-1 h-32">
            {getHistoryData().map((h: number, i: number) => {
              // Color based on percentage (green < 40%, yellow 40–70%, red > 70%)
              let barColor = "bg-green-400";
              if (h > 70) barColor = "bg-red-400";
              else if (h > 40) barColor = "bg-yellow-400";

              return (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm transition-all"
                  style={{
                    height: `${h}%`,
                  }}
                >
                  <div className={`w-full rounded-t-sm ${barColor}`} style={{ height: `${h}%` }} />
                </div>
              );
            })}
          </div>

          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>15 мин назад</span>
            <span>Сейчас</span>
          </div>
        </section>

        {/* Fan Control */}
        <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-xl shadow-black/40">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Вентиляция</h3>
            <button
              onClick={() => {
                if (!fanAuto) {
                  setFanAuto(true);
                  fanState.setOff();
                }
              }}
              disabled={fanAuto}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                fanAuto
                  ? "bg-blue-500/20 cursor-default"
                  : "bg-amber-500/20 hover:bg-amber-500/30 cursor-pointer"
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${fanAuto ? "bg-blue-400" : "bg-amber-400"}`} />
              <span className={`text-xs font-medium ${fanAuto ? "text-blue-400" : "text-amber-400"}`}>
                {fanAuto ? "Авто" : "Ручное"}
              </span>
              {!fanAuto && (
                <span className="text-xs text-gray-500">← авто</span>
              )}
            </button>
          </div>

          <button
            onClick={() => {
              console.log(`[KitchenPage] Button clicked: fanAuto=${fanAuto}, fanState.state=${fanState.state}, fanIsOn=${fanIsOn}`);
              if (fanAuto) {
                // AUTO mode: switch to MANUAL and turn fan ON
                console.log(`[KitchenPage] Switching from AUTO to MANUAL and turning ON`);
                setFanAuto(false);
                fanState.setOn();
              } else {
                // MANUAL mode: toggle fan
                console.log(`[KitchenPage] Calling fanState.toggle()...`);
                fanState.toggle();
              }
            }}
            className={`w-full p-4 rounded-2xl flex items-center justify-center gap-4 transition-all ${
              fanIsOn
                ? "bg-green-500/20 border border-green-500 text-green-400"
                : "bg-black/40 border border-white/5 text-gray-400 hover:bg-white/10"
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${fanIsOn ? "bg-green-500/20" : "bg-gray-700"}`}>
              <Wind className={`w-6 h-6 ${fanIsOn && !isSafe ? "animate-spin" : ""}`} />
            </div>
            <div className="text-left">
              <div className={`text-lg font-bold ${fanIsOn ? "text-green-400" : "text-gray-400"}`}>
                {fanIsOn ? "ВКЛ" : "ВЫКЛ"}
              </div>
              <div className="text-xs text-gray-500">
                {fanAuto
                  ? "Автоматическое включение при утечке"
                  : fanState.loading
                    ? "Загрузка..."
                    : "Ручное управление"}
              </div>
            </div>
          </button>
        </section>

        {/* Alert Banner */}
        {(status !== "safe" || simulateLeak) && (
          <section className={`border rounded-3xl p-4 ${
            simulateLeak
              ? "bg-red-500 border-red-500"
              : "bg-yellow-500/20 border-yellow-500/30"
          }`}>
            <div className="flex items-center gap-3">
              <AlertTriangle className={`w-6 h-6 ${simulateLeak ? "text-white animate-pulse" : "text-yellow-400"}`} />
              <div>
                <div className={`font-bold ${simulateLeak ? "text-white" : "text-yellow-400"}`}>
                  {simulateLeak ? "ВНИМАНИЕ! Симуляция утечки газа" : "ВНИМАНИЕ! Обнаружена утечка газа"}
                </div>
                <div className={`text-sm mt-1 ${simulateLeak ? "text-red-100" : "text-yellow-300"}`}>
                  {simulateLeak
                    ? "Это тестовый режим. Нажмите кнопку ниже для сброса."
                    : "Немедленно проветрите помещение и перекройте газовый кран."}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Safe State Banner */}
        {status === "safe" && !simulateLeak && (
          <section className="bg-emerald-500/10 border border-emerald-500/30 rounded-3xl p-4">
            <div className="flex items-center gap-3 text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
              <div>
                <div className="font-bold">Автоматический контроль активен</div>
                <div className="text-sm text-emerald-300">
                  Система мониторит уровень газа в реальном времени
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Simulate Button */}
        <button
          onClick={() => setSimulateLeak(!simulateLeak)}
          className={`w-full py-4 rounded-2xl font-medium transition-all ${
            simulateLeak
              ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
              : "bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30"
          }`}
        >
          {simulateLeak ? "Сбросить симуляцию" : "Симулировать утечку"}
        </button>
      </div>
    </PageTransition>
  );
}
