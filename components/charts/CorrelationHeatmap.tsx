import { Card, Title } from "@tremor/react";

const LABELS: Record<string, string> = {
  aqi: "AQI",
  pm25: "PM2.5",
  pm10: "PM10",
  no2: "NO2",
  o3: "O3",
};

const POSITIVE = [43, 196, 187];
const NEGATIVE = [251, 113, 133]; 
const NEUTRAL = [32, 35, 45];

function cellColor(v: number | null): string {
  if (v === null) return "rgb(32,35,45)";
  const t = Math.min(1, Math.abs(v));
  const base = v >= 0 ? POSITIVE : NEGATIVE;
  const [r, g, b] = NEUTRAL.map((c, i) => Math.round(c + (base[i] - c) * t));
  return `rgb(${r},${g},${b})`;
}

function textColor(v: number | null): string {
  if (v === null) return "#565c6c";
  return Math.abs(v) > 0.35 ? "#0a0b0f" : "#e9eaed";
}

export default function CorrelationHeatmap({
  matrix,
}: {
  matrix: Record<string, Record<string, number | null>>;
}) {
  const cols = Object.keys(LABELS);
  return (
    <Card className="!bg-ink-100 !border-ink-200 !shadow-none !rounded-lg">
      <Title className="!font-display !text-ink-950">Matrice de corrélation</Title>
      <p className="text-xs text-ink-400 mb-4">Coefficient de Pearson entre AQI et polluants (période filtrée)</p>
      <div className="overflow-x-auto">
        <table className="border-collapse w-full text-center">
          <thead>
            <tr>
              <th className="text-xs font-mono text-ink-400 p-2"></th>
              {cols.map((c) => (
                <th key={c} className="text-xs font-mono text-ink-500 p-2">
                  {LABELS[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cols.map((r) => (
              <tr key={r}>
                <td className="text-xs font-mono text-ink-500 p-2 text-right pr-3">{LABELS[r]}</td>
                {cols.map((c) => {
                  const v = matrix[r]?.[c] ?? null;
                  return (
                    <td key={c} className="p-0">
                      <div
                        className="w-16 h-12 flex items-center justify-center text-xs font-mono rounded-sm m-0.5"
                        style={{ backgroundColor: cellColor(v), color: textColor(v) }}
                      >
                        {v === null ? "—" : v.toFixed(2)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
