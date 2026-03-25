"use client";
import { useFaceRecognition } from "@/hooks/useFaceRecognition";
import { RippleContainer } from "@/components/RippleContainer";

export function CameraCard() {
  const { lastFace, isUnknown, connected } = useFaceRecognition("esp_street_01");

  const getStatusColor = () => {
    if (lastFace === null) return "text-gray-500";
    if (isUnknown) return "text-amber-500";
    return "text-green-500";
  };

  const getStatusText = () => {
    if (lastFace === null) return "Ожидание данных";
    if (isUnknown) return "Неизвестное лицо";
    return lastFace;
  };

  const getConnectionStatus = () => {
    if (connected) return "text-green-500";
    return "text-red-500";
  };

  const getConnectionText = () => {
    if (connected) return "Подключено";
    return "Нет соединения";
  };

  return (
    <RippleContainer className="h-full flex flex-col justify-center rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 p-8 text-center shadow-xl shadow-black/40 transition-all duration-300 hover:bg-white/10 hover:shadow-2xl cursor-pointer">
      <div className="flex justify-center">
        <svg className="h-12 w-12 text-zinc-600" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
      </div>
      <h3 className="mt-4 text-lg font-semibold">Уличная камера</h3>
      <p className={`mt-1 text-sm ${getConnectionStatus()}`}>{getConnectionText()}</p>
      <div className="mt-4 p-3 rounded-xl bg-black/40 border border-white/5">
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
          Последнее распознавание
        </div>
        <div className={`text-2xl font-bold ${getStatusColor()}`}>
          {getStatusText()}
        </div>
      </div>
    </RippleContainer>
  );
}
