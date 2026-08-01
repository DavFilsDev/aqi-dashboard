export interface City {
  city_id: number;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
}

export interface FactRow {
  fact_id: number;
  city: string;
  country: string;
  timestamp_utc: string;
  date: string;
  hour: number;
  day_of_week: number;
  is_weekend: boolean;
  aqi: number | null;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
}

export interface Filters {
  cities: string[];
  from: string | null;
  to: string | null;
  aqiMin: number;
  aqiMax: number;
  pm25Min: number | null;
  pm10Min: number | null;
  no2Min: number | null;
  o3Min: number | null;
  dayType: "all" | "weekday" | "weekend";
  hourMin: number;
  hourMax: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export const DEFAULT_FILTERS: Filters = {
  cities: [],
  from: null,
  to: null,
  aqiMin: 1,
  aqiMax: 5,
  pm25Min: null,
  pm10Min: null,
  no2Min: null,
  o3Min: null,
  dayType: "all",
  hourMin: 0,
  hourMax: 23,
  sortBy: "timestamp_utc",
  sortDir: "desc",
  page: 1,
  pageSize: 50,
};

export interface CityStat {
  city: string;
  country: string;
  avg_aqi: number;
  avg_pm25: number;
  n: number;
}

export interface TimePoint {
  bucket: string;
  avg_aqi: number;
}

export interface HourPoint {
  hour: number;
  avg_aqi: number;
}

export interface DayTypePoint {
  day_type: "Weekday" | "Weekend";
  avg_aqi: number;
}

export interface AskResponse {
  sql: string;
  rows: Record<string, unknown>[];
  summary: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sql?: string;
  rows?: Record<string, unknown>[];
}
