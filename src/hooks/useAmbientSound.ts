"use client";
import { useRef, useCallback } from "react";

type OfficeMode = "focus" | "rest" | "manual" | "off";

// Synthesize a short tone using Web Audio API
// This avoids needing audio asset files
function playTone(
  ctx: AudioContext,
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  gain = 0.15
) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);

  gainNode.gain.setValueAtTime(gain, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

const MODE_SOUNDS: Record<OfficeMode, (ctx: AudioContext) => void> = {
  focus: (ctx) => {
    // Two ascending tones — "focus activated"
    playTone(ctx, 440, 0.15, "sine", 0.12);
    setTimeout(() => playTone(ctx, 660, 0.2, "sine", 0.1), 160);
  },
  rest: (ctx) => {
    // Soft descending tones — "relax"
    playTone(ctx, 528, 0.25, "sine", 0.1);
    setTimeout(() => playTone(ctx, 396, 0.35, "sine", 0.08), 270);
  },
  manual: (ctx) => {
    // Single neutral click
    playTone(ctx, 370, 0.1, "triangle", 0.08);
  },
  off: (ctx) => {
    // Descending fade — "system off"
    playTone(ctx, 330, 0.1, "sine", 0.1);
    setTimeout(() => playTone(ctx, 220, 0.2, "sine", 0.06), 110);
  },
};

export function useAmbientSound() {
  const ctxRef = useRef<AudioContext | null>(null);

  const getContext = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (!ctxRef.current) {
      try {
        ctxRef.current = new AudioContext();
      } catch {
        return null;
      }
    }
    return ctxRef.current;
  }, []);

  const playModeSound = useCallback(
    (mode: OfficeMode) => {
      const ctx = getContext();
      if (!ctx) return;

      // Resume context if suspended (browser autoplay policy)
      const play = () => MODE_SOUNDS[mode]?.(ctx);
      if (ctx.state === "suspended") {
        ctx.resume().then(play).catch(() => {});
      } else {
        play();
      }
    },
    [getContext]
  );

  return { playModeSound };
}
