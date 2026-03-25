"use client";
import Link from "next/link";
import { Wind, Flame } from "lucide-react";
import { useGasSensor, useDeviceState } from "@/hooks/useSensorData";

const GAS_DEVICE_ID = "esp_kitchen_01";
const FAN_DEVICE_ID = "kitchen_fan";

export function KitchenCard() {
  const { value, isSafe, status } = useGasSensor(GAS_DEVICE_ID);
  const fanState = useDeviceState(FAN_DEVICE_ID);

  const gasSafe = isSafe;
  const fanOn = fanState.isOn;

  return (
    <Link href="/kitchen" className="block h-full">
      <section className="h-full flex flex-col justify-between rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 p-5 shadow-xl shadow-black/40 transition-all duration-300 hover:bg-white/10 hover:shadow-2xl hover:scale-[1.02]">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Кухня</h3>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>

          <p className="mt-2 text-xs uppercase tracking-wide text-gray-500">
            Контроль газа и вентиляция
          </p>

          {/* Grid Cards */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {/* Gas Sensor */}
            <div className="bg-black/40 border border-white/5 rounded-2xl p-4">
              <Flame className="w-6 h-6 mb-3" />
              <div className={`text-lg font-medium mb-1 ${gasSafe ? "text-green-400" : "text-red-400"}`}>
                {gasSafe ? "Норма" : "Опасно"}
              </div>
              <div className="text-xs text-gray-500">Уровень газа</div>
            </div>

            {/* Fan */}
            <div className="bg-black/40 border border-white/5 rounded-2xl p-4">
              <div className={`w-8 h-8 mb-3 rounded-lg flex items-center justify-center ${fanOn ? "bg-green-500/20" : "bg-gray-700"}`}>
                <Wind className={`w-5 h-5 ${fanOn ? "text-green-400" : "text-gray-400"}`} />
              </div>
              <div className={`text-lg font-medium mb-1 ${fanOn ? "text-green-400" : "text-gray-400"}`}>
                {fanOn ? "Вкл" : "Выкл"}
              </div>
              <div className="text-xs text-gray-500">Вентилятор</div>
            </div>
          </div>
        </div>

        {/* Status Banner */}
        <div className={`mt-4 flex items-center justify-center gap-2 rounded-xl border py-3 ${
          gasSafe
            ? "border-emerald-500/30 bg-emerald-500/10"
            : "border-red-500/30 bg-red-500/10"
        }`}>
          {gasSafe ? (
            <>
              <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
              <span className="text-sm text-emerald-400">
                Автоматический контроль активен
              </span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
              <span className="text-sm text-red-400">
                Обнаружена утечка газа!
              </span>
            </>
          )}
        </div>
      </section>
    </Link>
  );
}
