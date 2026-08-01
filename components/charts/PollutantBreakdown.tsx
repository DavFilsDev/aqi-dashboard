import { BarChart, Card, Title } from "@tremor/react";

export default function PollutantBreakdown({
  pm25,
  pm10,
  no2,
  o3,
}: {
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
}) {
  const data = [
    { pollutant: "PM2.5", "µg/m³": pm25 !== null ? Number(pm25.toFixed(1)) : 0 },
    { pollutant: "PM10", "µg/m³": pm10 !== null ? Number(pm10.toFixed(1)) : 0 },
    { pollutant: "NO2", "µg/m³": no2 !== null ? Number(no2.toFixed(1)) : 0 },
    { pollutant: "O3", "µg/m³": o3 !== null ? Number(o3.toFixed(1)) : 0 },
  ];
  return (
    <Card className="!bg-ink-100 !border-ink-200 !shadow-none !rounded-lg">
      <Title className="!font-display !text-ink-950">Répartition des polluants</Title>
      <p className="text-xs text-ink-400 mb-4">Moyenne sur la période filtrée (µg/m³)</p>
      <BarChart
        data={data}
        index="pollutant"
        categories={["µg/m³"]}
        colors={["fuchsia"]}
        showLegend={false}
        className="h-64"
      />
    </Card>
  );
}
