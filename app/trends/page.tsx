import { Suspense } from "react";
import FilterBar from "@/components/filters/FilterBar";
import TimeSeriesChart from "@/components/charts/TimeSeriesChart";
import HourBarChart from "@/components/charts/HourBarChart";
import WeekdayCompareChart from "@/components/charts/WeekdayCompareChart";
import { parseFilters } from "@/lib/filters";
import { getAllCities, getHourlyAverages, getTimeSeries, getWeekdayVsWeekend } from "@/lib/queries";

export const dynamic = "force-dynamic";

async function TrendsContent({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const filters = parseFilters(searchParams);
  const [cities, series, hourly, dayType] = await Promise.all([
    getAllCities(),
    getTimeSeries(filters, "day"),
    getHourlyAverages(filters),
    getWeekdayVsWeekend(filters),
  ]);

  return (
    <div className="space-y-6">
      <FilterBar
        cities={cities}
        config={{ city: true, date: true, aqi: true, pollutants: true, dayType: true, hour: true }}
      />
      <TimeSeriesChart data={series} title="AQI dans le temps" subtitle="Selon les filtres actifs" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HourBarChart data={hourly} />
        <WeekdayCompareChart data={dayType} />
      </div>
    </div>
  );
}

export default function TrendsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse bg-ink-100 rounded-lg" />}>
      <TrendsContent searchParams={searchParams} />
    </Suspense>
  );
}
