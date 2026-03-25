"use client";

import { useState } from "react";
import { RippleContainer } from "@/components/RippleContainer";

export function AutomationThresholds() {
  const [openTemp, setOpenTemp] = useState(25);
  const [closeTemp, setCloseTemp] = useState(19);
  const [humidity, setHumidity] = useState(39);

  return (
    <RippleContainer className="h-full flex flex-col justify-center rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 p-5 shadow-xl shadow-black/40 transition-all duration-300 hover:bg-white/10 hover:shadow-2xl cursor-pointer">
      <h3 className="text-lg font-semibold">Пороги автоматического управления</h3>

      {/* Температура открытия окна */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>Температура открытия окна</span>
          <span className="font-semibold text-orange-400">{openTemp}°C</span>
        </div>
        <input
          type="range"
          min="15"
          max="35"
          value={openTemp}
          onChange={(e) => setOpenTemp(Number(e.target.value))}
          className="mt-2 h-2 w-full appearance-none rounded-full bg-zinc-800 accent-orange-400 relative z-10"
        />
      </div>

      {/* Температура закрытия окна */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>Температура закрытия окна</span>
          <span className="font-semibold text-blue-400">{closeTemp}°C</span>
        </div>
        <input
          type="range"
          min="10"
          max="30"
          value={closeTemp}
          onChange={(e) => setCloseTemp(Number(e.target.value))}
          className="mt-2 h-2 w-full appearance-none rounded-full bg-zinc-800 accent-blue-400 relative z-10"
        />
      </div>

      {/* Влажность включения увлажнителя */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>Влажность включения увлажнителя</span>
          <span className="font-semibold text-cyan-400">{humidity}%</span>
        </div>
        <input
          type="range"
          min="20"
          max="70"
          value={humidity}
          onChange={(e) => setHumidity(Number(e.target.value))}
          className="mt-2 h-2 w-full appearance-none rounded-full bg-zinc-800 accent-cyan-400 relative z-10"
        />
      </div>
    </RippleContainer>
  );
}
