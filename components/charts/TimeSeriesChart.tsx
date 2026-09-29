"use client"
import { Card, LineChart, Title } from "@tremor/react";
import { TimePoint } from "@/types/aqi";
import EmptyState from "./EmptyState";

export default function TimeSeriesChart({
  data,
  title = "AQI moyen global dans le temps",
  subtitle = "Moyenne journalière sur l'ensemble des villes filtrées",
}: {
  data: TimePoint[];
  title?: string;
  subtitle?: string;
}) {
  if (data.length === 0) return <EmptyState />;
  const chartData = data.map((d) => ({
    date: d.label ?? d.bucket,
    "AQI moyen": Number(d.avg_aqi?.toFixed?.(2) ?? d.avg_aqi),
  }));
  return (
    <Card className="!bg-ink-100 !border-ink-200 !shadow-none !rounded-lg">
      <Title className="!font-display !text-ink-950">{title}</Title>
      <p className="text-xs text-ink-400 mb-4">{subtitle}</p>
      <LineChart
        data={chartData}
        index="date"
        categories={["AQI moyen"]}
        colors={["cyan"]}
        showLegend={false}
        className="h-72"
        valueFormatter={(v) => v.toFixed(2)}
      />
    </Card>
  );
}
