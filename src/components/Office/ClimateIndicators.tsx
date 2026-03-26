import { RippleContainer } from "@/components/RippleContainer";
import { Thermometer, Droplet } from "lucide-react";

interface ClimateIndicatorsProps {
  temperature: number;
  humidity: number;
  loading?: boolean;
}

export function ClimateIndicators({ temperature, humidity, loading }: ClimateIndicatorsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 h-full">
      {/* Температура */}
      <RippleContainer className="h-full flex flex-col justify-center rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 p-5 shadow-xl shadow-black/40 transition-all duration-300 hover:bg-white/10 hover:shadow-2xl cursor-pointer">
        <Thermometer className="h-6 w-6 text-orange-400" />
        <div className="mt-3 text-3xl font-semibold">
          {loading ? "..." : `${temperature.toFixed(1)}°`}
        </div>
        <div className="text-sm text-gray-500">Температура</div>
      </RippleContainer>

      {/* Влажность */}
      <RippleContainer className="h-full flex flex-col justify-center rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 p-5 shadow-xl shadow-black/40 transition-all duration-300 hover:bg-white/10 hover:shadow-2xl cursor-pointer">
        <Droplet className="h-6 w-6 text-cyan-400" />
        <div className="mt-3 text-3xl font-semibold">
          {loading ? "..." : `${humidity.toFixed(0)}%`}
        </div>
        <div className="text-sm text-gray-500">Влажность</div>
      </RippleContainer>
    </div>
  );
}
