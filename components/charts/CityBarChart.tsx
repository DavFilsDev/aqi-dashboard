"use client"
import { BarChart, Card, Title } from "@tremor/react";
import { CityStat } from "@/types/aqi";
import EmptyState from "./EmptyState";

export default function CityBarChart({ data }: { data: CityStat[] }) {
  if (data.length === 0) return <EmptyState />;

  const sortedData = [...data].sort((a, b) => Number(b.avg_aqi ?? 0) - Number(a.avg_aqi ?? 0));
  const chartData = sortedData.map((d) => {
    const avgAqi = Number(d.avg_aqi);
    const safeAqi = Number.isFinite(avgAqi) ? avgAqi : 0;

    return { name: d.city, "AQI moyen": Number(safeAqi.toFixed(2)) };
  });

  return (
    <Card className="!bg-ink-100 !border-ink-200 !shadow-none !rounded-lg">
      <Title className="!font-display !text-ink-950">AQI moyen par ville</Title>
      <p className="text-xs text-ink-400 mb-4">Trié du plus pollué au moins pollué (échelle OpenWeather, 1–5)</p>
      <BarChart
        data={chartData}
        index="name"
        categories={["AQI moyen"]}
        colors={["violet"]}
        layout="vertical"
        showLegend={false}
        className="h-80"
        valueFormatter={(v) => (typeof v === "number" ? v.toFixed(2) : "0.00")}
      />
    </Card>
  );
}
