"use client";
import { useState, useEffect } from "react";
import { PageTransition } from "@/components/PageTransition";
import { TopBar } from "@/components/TopBar";
import { Droplet, CheckCircle2, AlertTriangle, Lock, Unlock } from "lucide-react";

export default function BathroomPage() {
  const [isDry, setIsDry] = useState(true);
  const [valveOpen, setValveOpen] = useState(true);
  const [simulateLeak, setSimulateLeak] = useState(false);

  // Автоматически закрывать кран при симуляции протечки
  useEffect(() => {
    if (simulateLeak) {
      setValveOpen(false);
    }
  }, [simulateLeak]);

  const handleReset = () => {
    setSimulateLeak(false);
    setIsDry(true);
    setValveOpen(true);
  };

  return (
    <PageTransition className="pb-20">
      <TopBar title="Ванная" showSettings />

      <div className="p-5 max-w-md md:max-w-none mx-auto space-y-5">
        {/* Leak Sensor Status */}
        <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-xl shadow-black/40">
          <h3 className="text-lg font-semibold mb-4">Датчик протечки</h3>

          <div className={`flex items-center gap-4 p-6 rounded-2xl ${
            isDry && !simulateLeak
              ? "bg-cyan-500/20 border border-cyan-500"
              : "bg-red-500/20 border border-red-500"
          } border-opacity-30`}>
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              isDry && !simulateLeak ? "bg-cyan-500/20" : "bg-red-500/20"
            }`}>
              <Droplet className={`w-8 h-8 ${isDry && !simulateLeak ? "text-cyan-400" : "text-red-400 animate-pulse"}`} />
            </div>
            <div className="flex-1">
              <div className={`text-4xl font-bold ${isDry && !simulateLeak ? "text-cyan-400" : "text-red-400"}`}>
                {isDry && !simulateLeak ? "Сухо" : "АВАРИЯ"}
              </div>
              <div className="text-sm text-gray-400 mt-1">
                {isDry && !simulateLeak
                  ? "Нормальное состояние"
                  : "Обнаружена протечка воды!"}
              </div>
            </div>
          </div>
        </section>

        {/* Valve Status */}
        <section className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-xl shadow-black/40 ${
          !isDry || simulateLeak ? "opacity-50" : ""
        }`}>
          <h3 className="text-lg font-semibold mb-4">Запорный механизм</h3>

          <div className={`flex items-center gap-4 p-6 rounded-2xl ${
            valveOpen && isDry
              ? "bg-blue-500/20 border border-blue-500"
              : "bg-gray-700/50 border border-white/5"
          }`}>
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              valveOpen && isDry ? "bg-blue-500/20" : "bg-gray-700"
            }`}>
              {valveOpen && isDry ? (
                <Unlock className="w-8 h-8 text-blue-400" />
              ) : (
                <Lock className="w-8 h-8 text-gray-500" />
              )}
            </div>
            <div className="flex-1">
              <div className={`text-4xl font-bold ${valveOpen && isDry ? "text-blue-400" : "text-gray-400"}`}>
                {valveOpen && isDry ? "Открыт" : "Закрыт"}
              </div>
              <div className="text-sm text-gray-400 mt-1">
                {valveOpen && isDry
                  ? "Нормальное состояние"
                  : !isDry || simulateLeak
                    ? "Автоматически перекрыт из-за аварии"
                    : "Кран перекрыт"}
              </div>
            </div>
          </div>
        </section>

        {/* Emergency Control */}
        <section className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-xl shadow-black/40 ${
          !isDry || simulateLeak ? "opacity-50" : ""
        }`}>
          <h3 className="text-lg font-semibold mb-4">Аварийное управление</h3>

          <button
            onClick={handleReset}
            disabled={!isDry || simulateLeak}
            className={`w-full p-4 rounded-2xl flex items-center justify-center gap-4 transition-all ${
              isDry && !simulateLeak
                ? "bg-emerald-500/20 border border-emerald-500 text-emerald-400"
                : "bg-gray-700/50 border border-white/5 text-gray-400"
            }`}
          >
            <CheckCircle2 className="w-6 h-6" />
            <div className="text-left">
              <div className="text-lg font-bold">Сбросить аварию</div>
              <div className="text-xs text-gray-400">
                {!isDry || simulateLeak
                  ? "Доступно только после устранения причины протечки"
                  : "Открыть запорный механизм и восстановить нормальный режим"}
              </div>
            </div>
          </button>
        </section>

        {/* Alert Banner */}
        {(!isDry || simulateLeak) && (
          <section className="bg-red-500 border border-red-500 rounded-3xl p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-white animate-pulse" />
              <div>
                <div className="font-bold text-white">
                  {simulateLeak
                    ? "ВНИМАНИЕ! Симуляция протечки"
                    : "ВНИМАНИЕ! Обнаружена протечка воды"}
                </div>
                <div className={`text-sm mt-1 ${simulateLeak ? "text-red-100" : "text-red-100"}`}>
                  {simulateLeak
                    ? "Это тестовый режим. Нажмите кнопку сброса для возврата в норму."
                    : "Система автоматически перекрыла воду. Немедленно устраните причину протечки и нажмите сброс."}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Safe State Banner */}
        {isDry && !simulateLeak && (
          <section className="bg-emerald-500/10 border border-emerald-500/30 rounded-3xl p-4">
            <div className="flex items-center gap-3 text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
              <div>
                <div className="font-bold">Система защиты активна</div>
                <div className="text-sm text-emerald-300">
                  Датчик контролирует наличие влаги каждые 2 секунды
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Simulate Button */}
        <button
          onClick={() => setSimulateLeak(!simulateLeak)}
          disabled={!isDry}
          className={`w-full py-4 rounded-2xl font-medium transition-all ${
            simulateLeak
              ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
              : "bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30"
          } ${!isDry ? "opacity-50" : ""}`}
        >
          {simulateLeak ? "Сбросить симуляцию" : "Симулировать протечку"}
        </button>
      </div>
    </PageTransition>
  );
}
