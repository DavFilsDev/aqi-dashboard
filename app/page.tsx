import { Suspense } from "react";
import FilterBar from "@/components/filters/FilterBar";
import KpiCard from "@/components/kpi/KpiCard";
import CityBarChart from "@/components/charts/CityBarChart";
import TimeSeriesChart from "@/components/charts/TimeSeriesChart";
import { parseFilters } from "@/lib/filters";
import { getAllCities, getCityStats, getDaysAboveThreshold, getOverviewKpis, getTimeSeries } from "@/lib/queries";
import { aqiColor } from "@/lib/aqi-scale";

export const dynamic = "force-dynamic";

async function OverviewContent({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const filters = parseFilters(searchParams);
  const [cities, cityStats, kpis, series, daysAbove] = await Promise.all([
    getAllCities(),
    getCityStats(filters),
    getOverviewKpis(filters),
    getTimeSeries(filters, "day"),
    getDaysAboveThreshold(filters, 4),
  ]);

  const globalAvg = kpis?.global_avg_aqi ? Number(kpis.global_avg_aqi) : null;
  const worst = cityStats[0];
  const best = cityStats[cityStats.length - 1];
  const totalPoints = Number(kpis?.total_points ?? 0);
  const rangeLabel =
    kpis?.min_date && kpis?.max_date
      ? `${new Date(kpis.min_date).toLocaleDateString("fr-FR")} → ${new Date(kpis.max_date).toLocaleDateString("fr-FR")}`
      : "—";

  return (
    <div className="space-y-6">
      <FilterBar cities={cities} config={{ city: true, date: true }} />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard
          label="AQI moyen global"
          value={globalAvg !== null ? globalAvg.toFixed(2) : "—"}
          accentColor={globalAvg !== null ? aqiColor(globalAvg) : undefined}
        />
        <KpiCard
          label="Ville la plus polluée"
          value={worst ? worst.city : "—"}
          sub={worst ? `AQI ${worst.avg_aqi.toFixed(2)}` : undefined}
          accentColor={worst ? aqiColor(worst.avg_aqi) : undefined}
        />
        <KpiCard
          label="Ville la moins polluée"
          value={best ? best.city : "—"}
          sub={best ? `AQI ${best.avg_aqi.toFixed(2)}` : undefined}
          accentColor={best ? aqiColor(best.avg_aqi) : undefined}
        />
        <KpiCard label="Jours AQI ≥ 4" value={String(daysAbove)} sub="Seuil « Poor » ou pire" />
        <KpiCard label="Période couverte" value={rangeLabel} />
        <KpiCard label="Points de données" value={totalPoints.toLocaleString("fr-FR")} sub="fact_aqi filtré" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CityBarChart data={cityStats} />
        <TimeSeriesChart data={series} />
      </div>
    </div>
  );
}

export default function OverviewPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse bg-ink-100 rounded-lg" />}>
      <OverviewContent searchParams={searchParams} />
    </Suspense>
  );
}
