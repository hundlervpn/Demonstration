"use client";
import { Camera, User, UserX, Wifi, WifiOff } from "lucide-react";
import { useFaceRecognition } from "@/hooks/useFaceRecognition";
import { useVideoStream } from "@/hooks/useVideoStream";

export function StreetCameraCard() {
  const { lastFace, isUnknown, connected: faceConnected } = useFaceRecognition("esp_street_01");
  const { frame, connected: videoConnected } = useVideoStream("street");
  const connected = faceConnected || videoConnected;

  const getFaceStatusText = () => {
    if (lastFace === null) return "Нет данных";
    if (isUnknown) return "Неизвестное лицо";
    return lastFace;
  };

  const getFaceStatusColor = () => {
    if (lastFace === null) return "text-gray-400";
    if (isUnknown) return "text-amber-400";
    return "text-green-400";
  };

  return (
    <section className="h-full rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl shadow-black/40 overflow-hidden">
      <div className="relative h-full min-h-[16rem]">
        {/* Video Stream or Placeholder */}
        {frame ? (
          <img
            src={frame}
            alt="Camera"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              {connected ? (
                <Camera className="w-16 h-16 text-zinc-500" />
              ) : (
                <WifiOff className="w-16 h-16 text-zinc-600" />
              )}
              <span className="text-gray-500 text-sm">
                {connected ? "Камера активна" : "Нет соединения"}
              </span>
            </div>
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Live Indicator */}
        <div className={`absolute top-4 left-4 px-3 py-1.5 rounded-full flex items-center gap-2 ${connected ? "bg-red-500" : "bg-gray-600"}`}>
          {connected && <div className="w-2 h-2 bg-white rounded-full animate-pulse" />}
          <span className="text-xs font-medium text-white">
            {connected ? "ЭФИР" : "ОФФЛАЙН"}
          </span>
        </div>

        {/* Connection Status */}
        <div className="absolute top-4 right-4">
          {connected ? (
            <Wifi className="w-5 h-5 text-green-400" />
          ) : (
            <WifiOff className="w-5 h-5 text-red-400" />
          )}
        </div>

        {/* Bottom Info */}
        <div className="absolute bottom-6 left-6 right-6">
          <h2 className="text-2xl font-light mb-2">Камера на улице</h2>
          <div className="flex items-center gap-2">
            {lastFace !== null && !isUnknown && <User className={`w-4 h-4 ${getFaceStatusColor()}`} />}
            {lastFace !== null && isUnknown && <UserX className={`w-4 h-4 ${getFaceStatusColor()}`} />}
            <p className={`text-sm ${getFaceStatusColor()}`}>
              Последнее распознавание: {getFaceStatusText()}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
