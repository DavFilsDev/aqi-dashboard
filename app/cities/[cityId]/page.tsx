import { notFound } from "next/navigation";
import { Suspense } from "react";
import FilterBar from "@/components/filters/FilterBar";
import KpiCard from "@/components/kpi/KpiCard";
import TimeSeriesChart from "@/components/charts/TimeSeriesChart";
import PollutantBreakdown from "@/components/charts/PollutantBreakdown";
import { parseFilters } from "@/lib/filters";
import { getAllCities, getCityDetail } from "@/lib/queries";
import { aqiColor } from "@/lib/aqi-scale";

export const dynamic = "force-dynamic";

async function CityDetailContent({
  cityId,
  searchParams,
}: {
  cityId: number;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = parseFilters(searchParams);
  const [cities, detail] = await Promise.all([getAllCities(), getCityDetail(cityId, filters)]);

  if (!detail.city) notFound();

  const avgAqi = detail.stats?.avg_aqi ? Number(detail.stats.avg_aqi) : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl">{detail.city.city}</h2>
        <p className="text-ink-400 text-sm">{detail.city.country}</p>
      </div>

      <FilterBar cities={cities} config={{ date: true, aqi: true, pollutants: true, dayType: true, hour: true }} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="AQI moyen"
          value={avgAqi !== null ? avgAqi.toFixed(2) : "—"}
          accentColor={avgAqi !== null ? aqiColor(avgAqi) : undefined}
        />
        <KpiCard label="Points de données" value={String(detail.stats?.n ?? 0)} />
        <KpiCard label="PM2.5 moyen" value={detail.stats?.pm25 ? `${Number(detail.stats.pm25).toFixed(1)} µg/m³` : "—"} />
        <KpiCard label="PM10 moyen" value={detail.stats?.pm10 ? `${Number(detail.stats.pm10).toFixed(1)} µg/m³` : "—"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TimeSeriesChart
          data={detail.series}
          title={`AQI dans le temps — ${detail.city.city}`}
          subtitle="Moyenne journalière"
        />
        <PollutantBreakdown
          pm25={detail.stats?.pm25 ? Number(detail.stats.pm25) : null}
          pm10={detail.stats?.pm10 ? Number(detail.stats.pm10) : null}
          no2={detail.stats?.no2 ? Number(detail.stats.no2) : null}
          o3={detail.stats?.o3 ? Number(detail.stats.o3) : null}
        />
      </div>
    </div>
  );
}

export default function CityDetailPage({
  params,
  searchParams,
}: {
  params: { cityId: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const cityId = Number(params.cityId);
  if (!Number.isFinite(cityId)) notFound();

  return (
    <Suspense fallback={<div className="h-96 animate-pulse bg-ink-100 rounded-lg" />}>
      <CityDetailContent cityId={cityId} searchParams={searchParams} />
    </Suspense>
  );
}
