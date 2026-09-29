import { DEFAULT_FILTERS, Filters } from "@/types/aqi";

export function parseFilters(
  searchParams: Record<string, string | string[] | undefined>
): Filters {
  const get = (k: string): string | undefined => {
    const v = searchParams[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const cityParam = get("city");
  const cities = cityParam ? cityParam.split(",").filter(Boolean) : DEFAULT_FILTERS.cities;

  const dayTypeRaw = get("dayType");
  const dayType: Filters["dayType"] =
    dayTypeRaw === "weekday" || dayTypeRaw === "weekend" ? dayTypeRaw : "all";

  const num = (key: string, fallback: number): number => {
    const raw = get(key);
    if (raw === undefined) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  };

  const numOrNull = (key: string): number | null => {
    const raw = get(key);
    if (raw === undefined || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  return {
    cities,
    from: get("from") ?? null,
    to: get("to") ?? null,
    aqiMin: num("aqiMin", DEFAULT_FILTERS.aqiMin),
    aqiMax: num("aqiMax", DEFAULT_FILTERS.aqiMax),
    pm25Min: numOrNull("pm25Min"),
    pm10Min: numOrNull("pm10Min"),
    no2Min: numOrNull("no2Min"),
    o3Min: numOrNull("o3Min"),
    dayType,
    hourMin: num("hourMin", DEFAULT_FILTERS.hourMin),
    hourMax: num("hourMax", DEFAULT_FILTERS.hourMax),
    sortBy: get("sortBy") ?? DEFAULT_FILTERS.sortBy,
    sortDir: get("sortDir") === "asc" ? "asc" : "desc",
    page: num("page", DEFAULT_FILTERS.page ?? 1),
    pageSize: num("pageSize", DEFAULT_FILTERS.pageSize ?? 50),
  };
}

export function filtersToSearchParams(filters: Partial<Filters>): URLSearchParams {
  const sp = new URLSearchParams();
  if (filters.cities && filters.cities.length > 0)
    sp.set("city", filters.cities.join(","));
  if (filters.from) sp.set("from", filters.from);
  if (filters.to) sp.set("to", filters.to);
  if (filters.aqiMin !== undefined && filters.aqiMin !== DEFAULT_FILTERS.aqiMin)
    sp.set("aqiMin", String(filters.aqiMin));
  if (filters.aqiMax !== undefined && filters.aqiMax !== DEFAULT_FILTERS.aqiMax)
    sp.set("aqiMax", String(filters.aqiMax));
  if (filters.pm25Min !== null && filters.pm25Min !== undefined)
    sp.set("pm25Min", String(filters.pm25Min));
  if (filters.pm10Min !== null && filters.pm10Min !== undefined)
    sp.set("pm10Min", String(filters.pm10Min));
  if (filters.no2Min !== null && filters.no2Min !== undefined)
    sp.set("no2Min", String(filters.no2Min));
  if (filters.o3Min !== null && filters.o3Min !== undefined)
    sp.set("o3Min", String(filters.o3Min));
  if (filters.dayType && filters.dayType !== "all")
    sp.set("dayType", filters.dayType);
  if (filters.hourMin !== undefined && filters.hourMin !== DEFAULT_FILTERS.hourMin)
    sp.set("hourMin", String(filters.hourMin));
  if (filters.hourMax !== undefined && filters.hourMax !== DEFAULT_FILTERS.hourMax)
    sp.set("hourMax", String(filters.hourMax));
  if (filters.sortBy && filters.sortBy !== DEFAULT_FILTERS.sortBy)
    sp.set("sortBy", filters.sortBy);
  if (filters.sortDir && filters.sortDir !== DEFAULT_FILTERS.sortDir)
    sp.set("sortDir", filters.sortDir);
  if (filters.page && filters.page !== 1) sp.set("page", String(filters.page));
  if (
    filters.pageSize &&
    filters.pageSize !== DEFAULT_FILTERS.pageSize
  )
    sp.set("pageSize", String(filters.pageSize));
  return sp;
}

export const DATE_PRESETS = [
  { label: "7 jours", days: 7 },
  { label: "30 jours", days: 30 },
  { label: "3 mois", days: 90 },
  { label: "Tout", days: null },
] as const;
