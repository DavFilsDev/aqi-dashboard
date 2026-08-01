"use client"
import { BarChart, Card, Title } from "@tremor/react";
import { DayTypePoint } from "@/types/aqi";
import EmptyState from "./EmptyState";

export default function WeekdayCompareChart({ data }: { data: DayTypePoint[] }) {
  if (data.length === 0) return <EmptyState />;
  const chartData = data.map((d) => ({
    type: d.day_type === "Weekday" ? "Semaine" : "Week-end",
    "AQI moyen": Number(d.avg_aqi.toFixed(2)),
  }));
  return (
    <Card className="!bg-ink-100 !border-ink-200 !shadow-none !rounded-lg">
      <Title className="!font-display !text-ink-950">Semaine vs week-end</Title>
      <p className="text-xs text-ink-400 mb-4">Comparaison de l'AQI moyen</p>
      <BarChart
        data={chartData}
        index="type"
        categories={["AQI moyen"]}
        colors={["teal"]}
        showLegend={false}
        className="h-64"
        valueFormatter={(v) => v.toFixed(2)}
      />
    </Card>
  );
}
