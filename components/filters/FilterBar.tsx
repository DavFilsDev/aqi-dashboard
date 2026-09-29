"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { City, Filters } from "@/types/aqi";
import { DATE_PRESETS, parseFilters, filtersToSearchParams } from "@/lib/filters";

export interface FilterBarConfig {
  city?: boolean;
  date?: boolean;
  aqi?: boolean;
  pollutants?: boolean;
  dayType?: boolean;
  hour?: boolean;
}

export default function FilterBar({
  cities,
  config = { city: true, date: true },
}: {
  cities: City[];
  config?: FilterBarConfig;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const spObj = useMemo(() => {
    const obj: Record<string, string> = {};
    searchParams.forEach((v, k) => (obj[k] = v));
    return obj;
  }, [searchParams]);

  const filters = parseFilters(spObj);

  function push(next: Partial<typeof filters>) {
    const merged = { ...filters, ...next, page: next.page ?? 1 };
    const sp = filtersToSearchParams(merged);
    startTransition(() => {
      router.push(`${pathname}?${sp.toString()}`);
    });
  }

  const citiesByCountry = useMemo(() => {
    const map = new Map<string, City[]>();
    for (const c of cities) {
      const bucket = map.get(c.country);
      if (bucket) bucket.push(c);
      else map.set(c.country, [c]);
    }
    return map;
  }, [cities]);

  function toggleCity(key: string) {
    const next = filters.cities.includes(key)
      ? filters.cities.filter((c) => c !== key)
      : [...filters.cities, key];
    push({ cities: next });
  }

  function applyPreset(days: number | null) {
    if (days === null) {
      push({ from: null, to: null });
      return;
    }
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    push({ from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) });
  }

  function reset() {
    router.push(pathname);
  }

  return (
    <div className="bg-ink-100 border border-ink-200 rounded-lg p-4 mb-6">
      <div className="flex flex-wrap gap-6 items-start">
        {config.city && (
          <div className="min-w-[220px]">
            <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-500 mb-1.5">
              Villes
            </label>
            <details className="relative">
              <summary className="cursor-pointer list-none px-3 py-1.5 border border-ink-200 rounded-md text-sm bg-ink-50 hover:bg-ink-100 select-none">
                {filters.cities.length === 0
                  ? "Toutes les villes"
                  : `${filters.cities.length} sélectionnée(s)`}
              </summary>
              <div className="absolute z-10 mt-1 w-64 bg-ink-100 border border-ink-200 rounded-md shadow-lg p-3 max-h-72 overflow-y-auto scrollbar-thin">
                {[...citiesByCountry.entries()].map(([country, list]) => (
                  <div key={country} className="mb-2 last:mb-0">
                    <div className="font-mono text-[10px] uppercase text-ink-400 mb-1">
                      {country}
                    </div>
                    {list.map((c) => {
                      const key = `${c.city}|${c.country}`;
                      const checked = filters.cities.includes(key);
                      return (
                        <label
                          key={key}
                          className="flex items-center gap-2 py-0.5 text-sm cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCity(key)}
                            className="accent-primary-500"
                          />
                          {c.city}
                        </label>
                      );
                    })}
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}

        {config.date && (
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-500 mb-1.5">
              Période
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {DATE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p.days)}
                  className="px-2.5 py-1 text-xs border border-ink-200 rounded-md hover:bg-ink-100"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input
                type="date"
                value={filters.from ?? ""}
                onChange={(e) => push({ from: e.target.value || null })}
                className="text-xs border border-ink-200 rounded-md px-2 py-1"
              />
              <input
                type="date"
                value={filters.to ?? ""}
                onChange={(e) => push({ to: e.target.value || null })}
                className="text-xs border border-ink-200 rounded-md px-2 py-1"
              />
            </div>
          </div>
        )}

        {config.aqi && (
          <div className="min-w-[180px]">
            <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-500 mb-1.5">
              Sévérité AQI ({filters.aqiMin}–{filters.aqiMax})
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={filters.aqiMin}
                onChange={(e) =>
                  push({ aqiMin: Math.min(Number(e.target.value), filters.aqiMax) })
                }
                className="w-20 accent-primary-500"
              />
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={filters.aqiMax}
                onChange={(e) =>
                  push({ aqiMax: Math.max(Number(e.target.value), filters.aqiMin) })
                }
                className="w-20 accent-primary-500"
              />
            </div>
          </div>
        )}

        {config.dayType && (
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-500 mb-1.5">
              Type de jour
            </label>
            <div className="flex border border-ink-200 rounded-md overflow-hidden text-xs">
              {(["all", "weekday", "weekend"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => push({ dayType: d })}
                  className={`px-2.5 py-1.5 ${
                    filters.dayType === d
                      ? "bg-primary-500 text-ink-50 font-medium"
                      : "bg-ink-50 hover:bg-ink-100"
                  }`}
                >
                  {d === "all" ? "Tous" : d === "weekday" ? "Semaine" : "Week-end"}
                </button>
              ))}
            </div>
          </div>
        )}

        {config.hour && (
          <div className="min-w-[200px]">
            <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-500 mb-1.5">
              Heure ({filters.hourMin}h–{filters.hourMax}h)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={23}
                value={filters.hourMin}
                onChange={(e) =>
                  push({ hourMin: Math.min(Number(e.target.value), filters.hourMax) })
                }
                className="w-20 accent-primary-500"
              />
              <input
                type="range"
                min={0}
                max={23}
                value={filters.hourMax}
                onChange={(e) =>
                  push({ hourMax: Math.max(Number(e.target.value), filters.hourMin) })
                }
                className="w-20 accent-primary-500"
              />
            </div>
          </div>
        )}

        <div className="ml-auto self-center">
          <button
            onClick={reset}
            className="px-3 py-1.5 text-xs border border-ink-200 rounded-md text-ink-500 hover:bg-ink-100"
          >
            Réinitialiser les filtres
          </button>
        </div>
      </div>

      {config.pollutants && (
        <details
          className="mt-4 pt-3 border-t border-ink-100"
          open={advancedOpen}
          onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-wider text-ink-500 select-none">
            Filtres avancés (seuils polluants)
          </summary>
          <div className="flex flex-wrap gap-4 mt-3">
            {(["pm25Min", "pm10Min", "no2Min", "o3Min"] as const).map((key) => (
              <div key={key}>
                <label className="block text-[10px] font-mono uppercase text-ink-400 mb-1">
                  {key.replace("Min", "").toUpperCase()} min
                </label>
                <input
                  type="number"
                  min={0}
                  value={filters[key] ?? ""}
                  onChange={(e) => {
                    const value = e.target.value === "" ? null : Number(e.target.value);
                    push({ [key]: value } as Partial<Filters>);
                  }}
                  className="w-24 text-xs border border-ink-200 rounded-md px-2 py-1"
                  placeholder="—"
                />
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
