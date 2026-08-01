"use client";

import { Card, Title } from "@tremor/react";
import { aqiColor } from "@/lib/aqi-scale";
import EmptyState from "./EmptyState";

export default function ScatterPlot({ data }: { data: { pm25: number; aqi: number }[] }) {
  if (data.length === 0) return <EmptyState />;

  const width = 640;
  const height = 320;
  const pad = 40;
  const maxPm25 = Math.max(...data.map((d) => d.pm25), 1) * 1.05;
  const maxAqi = 5;

  const x = (v: number) => pad + (v / maxPm25) * (width - pad * 2);
  const y = (v: number) => height - pad - (v / maxAqi) * (height - pad * 2);

  return (
    <Card className="!bg-ink-100 !border-ink-200 !shadow-none !rounded-lg">
      <Title className="!font-display !text-ink-950">PM2.5 vs AQI</Title>
      <p className="text-xs text-ink-400 mb-4">
        Chaque point est une mesure horaire ({data.length} points échantillonnés)
      </p>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#2f333f" />
        <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#2f333f" />
        <text x={width / 2} y={height - 6} textAnchor="middle" className="fill-ink-400" fontSize="11">
          PM2.5 (µg/m³)
        </text>
        <text
          x={-height / 2}
          y={12}
          textAnchor="middle"
          className="fill-ink-400"
          fontSize="11"
          transform="rotate(-90)"
        >
          AQI
        </text>
        {data.map((d, i) => (
          <circle
            key={i}
            cx={x(d.pm25)}
            cy={y(d.aqi)}
            r={3}
            fill={aqiColor(d.aqi)}
            opacity={0.6}
          />
        ))}
      </svg>
    </Card>
  );
}
