"use client"
import { BarChart, Card, Title } from "@tremor/react";
import { HourPoint } from "@/types/aqi";
import EmptyState from "./EmptyState";

export default function HourBarChart({ data }: { data: HourPoint[] }) {
  if (data.length === 0) return <EmptyState />;
  const chartData = data.map((d) => ({
    hour: `${d.hour}h`,
    "AQI moyen": Number(d.avg_aqi.toFixed(2)),
  }));
  return (
    <Card className="!bg-ink-100 !border-ink-200 !shadow-none !rounded-lg">
      <Title className="!font-display !text-ink-950">AQI moyen par heure de la journée</Title>
      <p className="text-xs text-ink-400 mb-4">Repère les pics liés aux heures de pointe (0–23h)</p>
      <BarChart
        data={chartData}
        index="hour"
        categories={["AQI moyen"]}
        colors={["amber"]}
        showLegend={false}
        className="h-72"
        valueFormatter={(v) => v.toFixed(2)}
      />
    </Card>
  );
}
