import { RippleContainer } from "@/components/RippleContainer";
import { Lightbulb, Thermometer } from "lucide-react";

interface ManualControlsProps {
  temperature: number;
  loading?: boolean;
  onLightToggle?: () => void;
  onClimateChange?: (value: number) => void;
}

export function ManualControls({ temperature, loading, onLightToggle, onClimateChange }: ManualControlsProps) {
  return (
    <section className="h-full flex flex-col justify-center rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 p-5 shadow-xl shadow-black/40 transition-all duration-300 hover:bg-white/10 hover:shadow-2xl">
      <h3 className="text-lg font-semibold">Ручное управление</h3>

      <div className="mt-4 grid grid-cols-2 gap-4 flex-1">
        {/* Освещение */}
        <RippleContainer
          onClick={onLightToggle}
          className="flex flex-col justify-center rounded-2xl border border-white/10 bg-black/40 p-5 text-center cursor-pointer hover:bg-white/10 transition-colors"
        >
          <Lightbulb className="mx-auto h-7 w-7 text-yellow-400" />
          <h4 className="mt-3 text-base font-medium">Освещение</h4>
          <p className="mt-1 text-sm text-gray-500">Авто</p>
        </RippleContainer>

        {/* Климат */}
        <RippleContainer className="flex flex-col justify-center rounded-2xl border border-white/10 bg-black/40 p-5 text-center cursor-pointer hover:bg-white/10 transition-colors">
          <Thermometer className="mx-auto h-7 w-7 text-blue-400" />
          <h4 className="mt-3 text-base font-medium">Климат</h4>
          <p className="mt-1 text-sm text-gray-500">
            {loading ? "..." : `${temperature.toFixed(0)}°C`}
          </p>
        </RippleContainer>
      </div>
    </section>
  );
}
