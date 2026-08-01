import Link from "next/link";
import { Suspense } from "react";
import { Card, Text, Title } from "@tremor/react";
import FilterBar from "@/components/filters/FilterBar";
import { parseFilters } from "@/lib/filters";
import { getAllCities, getCityStats } from "@/lib/queries";
import { aqiColor, aqiLabel } from "@/lib/aqi-scale";

export const dynamic = "force-dynamic";

async function CitiesContent({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const filters = parseFilters(searchParams);
  const cities = await getAllCities();
  const stats = await getCityStats(filters);
  const statByKey = new Map(stats.map((s) => [`${s.city}|${s.country}`, s]));

  return (
    <div className="space-y-6">
      <FilterBar cities={cities} config={{ city: true, date: true }} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cities.map((c) => {
          const s = statByKey.get(`${c.city}|${c.country}`);
          return (
            <Link key={c.city_id} href={`/cities/${c.city_id}`}>
              <Card className="!bg-ink-100 !border-ink-200 !shadow-none !rounded-lg hover:!border-ink-400 transition-colors relative overflow-hidden h-full">
                <div
                  className="absolute top-0 left-0 w-1 h-full"
                  style={{ backgroundColor: s ? aqiColor(s.avg_aqi) : "#2f333f" }}
                />
                <Title className="!font-display !text-ink-950">{c.city}</Title>
                <Text className="!text-ink-400 !text-xs">{c.country}</Text>
                <div className="mt-3">
                  <Text className="!text-ink-500 !text-sm">
                    AQI moyen : <span className="font-medium text-ink-950">{s ? s.avg_aqi.toFixed(2) : "—"}</span>
                  </Text>
                  <Text className="!text-ink-400 !text-xs">{s ? aqiLabel(s.avg_aqi) : "Pas de données"}</Text>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function CitiesPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse bg-ink-100 rounded-lg" />}>
      <CitiesContent searchParams={searchParams} />
    </Suspense>
  );
}
