"use client";
import { useSensorData } from "./useSensorData";

export interface UseFaceRecognitionResult {
  lastFace: string | null;
  lastFaceTime: string | null;
  isUnknown: boolean;
  connected: boolean;
}

// Specialized hook for face recognition
export function useFaceRecognition(deviceId: string): UseFaceRecognitionResult {
  const { data, loading, error, connected, refresh } = useSensorData(
    deviceId,
    "face_recognition",
  );

  // Get last detected face name
  const lastFace =
    data?.value !== undefined && data?.value !== null
      ? String(data.value)
      : null;

  // Check if face is unknown (CHUZHOY or Searching...)
  const isUnknown = lastFace === "CHUZHOY" || lastFace === "Searching...";

  // Get last face detection time
  const lastFaceTime = data?.timestamp || null;

  return {
    lastFace,
    lastFaceTime,
    isUnknown,
    connected,
  };
}
