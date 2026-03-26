export const CLIMATE_TARGETS = {
  focus:  { temp: 20, humidity: 45 },
  rest:   { temp: 23, humidity: 55 },
  manual: { temp: 21, humidity: 50 },
} as const;

export function toEspThresholds(targetTemp: number, targetHumidity: number) {
  return {
    temp_open_threshold: targetTemp + 2,
    temp_close_threshold: targetTemp - 2,
    humidity_min: targetHumidity,
  };
}
