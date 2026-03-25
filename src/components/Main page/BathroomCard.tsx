"use client";
import Link from "next/link";
import { Droplet } from "lucide-react";
import { useSensorData, useDeviceState } from "@/hooks/useSensorData";

export function BathroomCard() {
  const leakData = useSensorData("esp_bathroom_01", "water_leak");
  const valveState = useDeviceState("valve");

  const isDry = leakData.data?.value !== "detected";
  const valveOpen = valveState.state !== "closed";

  return (
    <Link href="/bathroom" className="block h-full">
      <section className="h-full flex flex-col justify-between rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 p-5 shadow-xl shadow-black/40 transition-all duration-300 hover:bg-white/10 hover:shadow-2xl hover:scale-[1.02]">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Ванная</h3>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>

          <p className="mt-2 text-xs uppercase tracking-wide text-gray-500">
            Защита от протечек
          </p>

          {/* Grid Cards */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {/* Leak Sensor */}
            <div className="bg-black/40 border border-white/5 rounded-2xl p-4">
              <Droplet className={`w-6 h-6 mb-3 ${!isDry ? "animate-pulse text-red-400" : ""}`} />
              <div className={`text-lg font-medium mb-1 ${isDry ? "text-cyan-400" : "text-red-400"}`}>
                {leakData.loading ? "..." : isDry ? "Сухо" : "АВАРИЯ"}
              </div>
              <div className="text-xs text-gray-500">Датчик протечки</div>
            </div>

            {/* Valve */}
            <div className={`bg-black/40 border border-white/5 rounded-2xl p-4 ${!isDry && "opacity-50"}`}>
              <div className={`w-8 h-8 mb-3 rounded-lg flex items-center justify-center ${valveOpen ? "bg-blue-500/20" : "bg-gray-700"}`}>
                <span className="text-xl">{isDry ? "🚰" : "🔒"}</span>
              </div>
              <div className={`text-lg font-medium mb-1 ${valveOpen ? "text-blue-400" : "text-gray-400"}`}>
                {valveState.loading ? "..." : valveOpen ? "Открыт" : "Закрыт"}
              </div>
              <div className="text-xs text-gray-500">Кран</div>
            </div>
          </div>
        </div>

        {/* Status Banner */}
        <div className={`mt-4 flex items-center justify-center gap-2 rounded-xl border py-3 ${
          isDry
            ? "border-emerald-500/30 bg-emerald-500/10"
            : "border-red-500/30 bg-red-500/10"
        }`}>
          {isDry ? (
            <>
              <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
              <span className="text-sm text-emerald-400">Система защиты активна</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 text-red-400 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
              <span className="text-sm text-red-400">Обнаружена протечка!</span>
            </>
          )}
        </div>
      </section>
    </Link>
  );
}
