"use client";
import Link from "next/link";
import { Lightbulb } from "lucide-react";
import { useMotionSensor, useDeviceState } from "@/hooks/useSensorData";

export function HallwayCard() {
  const { isDetected } = useMotionSensor("esp_hallway_01");
  const lightState = useDeviceState("hall_light");

  // Default to auto mode if not set
  const autoMode = lightState.state !== "manual";
  const brightness = 75; // Would need to get from lightState if available

  return (
    <Link href="/hallway" className="block h-full">
      <section className="h-full flex flex-col justify-between rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 p-5 shadow-xl shadow-black/40 transition-all duration-300 hover:bg-white/10 hover:shadow-2xl hover:scale-[1.02]">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Прихожая</h3>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>

          <p className="mt-2 text-xs uppercase tracking-wide text-gray-500">
            Освещение
          </p>

          {/* Light Control */}
          <div className="mt-4 bg-black/40 border border-white/5 rounded-2xl p-4" onClick={(e) => e.preventDefault()}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${lightState.isOn ? "bg-amber-500/20" : "bg-gray-700"}`}>
                <Lightbulb className={`w-5 h-5 ${lightState.isOn ? "text-amber-400" : "text-gray-500"}`} />
              </div>
              <div>
                <div className={`text-lg font-light ${lightState.isOn ? "text-amber-400" : "text-gray-400"}`}>
                  {lightState.loading ? "..." : lightState.isOn ? "ВКЛ" : "ВЫКЛ"}
                </div>
                <div className="text-xs text-gray-500">Статус</div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Яркость</span>
              <span className="text-lg font-light">{brightness}%</span>
            </div>

            <input
              type="range"
              min="0"
              max="100"
              value={brightness}
              readOnly
              className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gray-700"
              style={{
                background: `linear-gradient(to right, #fbbf24 0%, #fbbf24 ${brightness}%, #333 ${brightness}%, #333 100%)`
              }}
            />
          </div>

          {/* Motion Indicator */}
          <div className="mt-4 flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${isDetected ? "bg-green-500 animate-pulse" : "bg-gray-500"}`}
            />
            <span className="text-sm text-gray-400">
              {isDetected ? "Движение обнаружено" : "Движения нет"}
            </span>
          </div>
        </div>

        {/* Mode Indicator */}
        {autoMode ? (
          <div className="mt-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 2v11h3v9l7-12h-4l4-8z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-blue-400">
                По датчику движения
              </div>
              <div className="text-xs text-gray-500">Активный режим</div>
            </div>
          </div>
        ) : (
          <div className="mt-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              <div>
                <div className="text-sm font-medium text-amber-400">Ручное управление</div>
                <div className="text-xs text-gray-500">Автоматизация отключена</div>
              </div>
            </div>
          </div>
        )}
      </section>
    </Link>
  );
}
