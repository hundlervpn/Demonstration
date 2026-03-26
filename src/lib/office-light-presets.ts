export type LightPreset = { state: boolean; brightness?: number; colorTemp?: number };

export const LIGHT_PRESETS: Record<string, LightPreset> = {
  focus:  { state: true,  brightness: 220, colorTemp: 5500 },
  rest:   { state: true,  brightness: 140, colorTemp: 2700 },
  manual: { state: true,  brightness: 180, colorTemp: 4000 },
  off:    { state: false },
};
