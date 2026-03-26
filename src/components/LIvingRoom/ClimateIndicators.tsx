import { RippleContainer } from "@/components/RippleContainer";

export function ClimateIndicators() {
  return (
    <div className="grid grid-cols-2 gap-4 h-full">
      {/* Температура */}
      <RippleContainer className="h-full flex flex-col justify-center rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 p-5 shadow-xl shadow-black/40 transition-all duration-300 hover:bg-white/10 hover:shadow-2xl cursor-pointer">
        <svg className="h-6 w-6 text-orange-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M15 13V5c0-1.66-1.34-3-3-3S9 3.34 9 5v8c-1.21.91-2 2.37-2 4 0 2.76 2.24 5 5 5s5-2.24 5-5c0-1.63-.79-3.09-2-4zm-4-8c0-.55.45-1 1-1s1 .45 1 1v4h-2V5z"/>
        </svg>
        <div className="mt-3 text-3xl font-semibold">22°</div>
        <div className="text-sm text-gray-500">Температура</div>
        <div className="mt-2 text-sm text-emerald-400">+1.5°</div>
      </RippleContainer>

      {/* Влажность */}
      <RippleContainer className="h-full flex flex-col justify-center rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 p-5 shadow-xl shadow-black/40 transition-all duration-300 hover:bg-white/10 hover:shadow-2xl cursor-pointer">
        <svg className="h-6 w-6 text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8zm0 18c-3.35 0-6-2.57-6-6.2 0-2.34 1.95-5.44 6-9.14 4.05 3.7 6 6.79 6 9.14 0 3.63-2.65 6.2-6 6.2z"/>
        </svg>
        <div className="mt-3 text-3xl font-semibold">45%</div>
        <div className="text-sm text-gray-500">Влажность</div>
        <div className="mt-2 text-sm text-red-400">-3%</div>
      </RippleContainer>
    </div>
  );
}
