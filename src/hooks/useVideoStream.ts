"use client";
import { useState, useEffect } from "react";
import { wsManager } from "./useSensorData";

interface VideoFrameMessage {
  type: "video_frame";
  room: string;
  data: string;
  timestamp: string;
}

export function useVideoStream(room: string) {
  const [frame, setFrame] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === "video_frame" && message.room === room) {
        setFrame(`data:image/jpeg;base64,${message.data}`);
        setConnected(true);
      }
    };

    const unsubscribe = wsManager.subscribe(handleMessage);

    const interval = setInterval(() => {
      setConnected(wsManager.isConnected() || false);
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [room]);

  return { frame, connected };
}
