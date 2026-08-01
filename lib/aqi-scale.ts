export const AQI_LABELS: Record<number, string> = {
  1: "Good",
  2: "Fair",
  3: "Moderate",
  4: "Poor",
  5: "Very Poor",
};

export const AQI_HEX: Record<number, string> = {
  1: "#6b9080",
  2: "#a4ac86",
  3: "#e0b04a",
  4: "#d1793d",
  5: "#b3432b",
};

export function aqiBucket(aqi: number | null | undefined): number {
  if (aqi === null || aqi === undefined || Number.isNaN(aqi)) return 0;
  return Math.min(5, Math.max(1, Math.round(aqi)));
}

export function aqiColor(aqi: number | null | undefined): string {
  const b = aqiBucket(aqi);
  return b === 0 ? "#a3a3a3" : AQI_HEX[b];
}

export function aqiLabel(aqi: number | null | undefined): string {
  const b = aqiBucket(aqi);
  return b === 0 ? "No data" : AQI_LABELS[b];
}
