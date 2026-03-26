"use client";

import { useState } from "react";
import { RippleContainer } from "@/components/RippleContainer";

interface AutomationThresholdsProps {
  currentHumidity: number;
  loading?: boolean;
  onThresholdChange?: (focusTemp: number, restTemp: number, humidity: number) => void;
}

export function AutomationThresholds({ currentHumidity, loading, onThresholdChange }: AutomationThresholdsProps) {
  const [focusTemp, setFocusTemp] = useState(20);
  const [restTemp, setRestTemp] = useState(23);
  const [humidity, setHumidity] = useState(40);

  const handleChange = () => {
    if (onThresholdChange) {
      onThresholdChange(focusTemp, restTemp, humidity);
    }
  };

  return (
    <RippleContainer className="h-full flex flex-col justify-center rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 p-5 shadow-xl shadow-black/40 transition-all duration-300 hover:bg-white/10 hover:shadow-2xl cursor-pointer">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Пороги автоматизации</h3>
        {!loading && (
          <span className="text-xs text-gray-500">
            Сейчас: {currentHumidity.toFixed(0)}%
          </span>
        )}
      </div>

      {/* Температура режима "Фокус" */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>Температура режима «Фокус»</span>
          <span className="font-semibold text-blue-400">{focusTemp}°C</span>
        </div>
        <input
          type="range"
          min="15"
          max="25"
          value={focusTemp}
          onChange={(e) => { setFocusTemp(Number(e.target.value)); handleChange(); }}
          className="mt-2 h-2 w-full appearance-none rounded-full bg-zinc-800 accent-blue-400 relative z-10"
        />
      </div>

      {/* Температура режима "Отдых" */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>Температура режима «Отдых»</span>
          <span className="font-semibold text-emerald-400">{restTemp}°C</span>
        </div>
        <input
          type="range"
          min="20"
          max="30"
          value={restTemp}
          onChange={(e) => { setRestTemp(Number(e.target.value)); handleChange(); }}
          className="mt-2 h-2 w-full appearance-none rounded-full bg-zinc-800 accent-emerald-400 relative z-10"
        />
      </div>

      {/* Влажность */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>Целевая влажность</span>
          <span className="font-semibold text-cyan-400">{humidity}%</span>
        </div>
        <input
          type="range"
          min="30"
          max="60"
          value={humidity}
          onChange={(e) => { setHumidity(Number(e.target.value)); handleChange(); }}
          className="mt-2 h-2 w-full appearance-none rounded-full bg-zinc-800 accent-cyan-400 relative z-10"
        />
      </div>
    </RippleContainer>
  );
}
