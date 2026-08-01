import { Card, Metric, Text } from "@tremor/react";

export default function KpiCard({
  label,
  value,
  sub,
  accentColor,
}: {
  label: string;
  value: string;
  sub?: string;
  accentColor?: string;
}) {
  return (
    <Card className="!bg-ink-100 !border-ink-200 !shadow-none !rounded-lg relative overflow-hidden">
      {accentColor && (
        <div
          className="absolute top-0 left-0 w-1 h-full"
          style={{ backgroundColor: accentColor }}
        />
      )}
      <Text className="!text-ink-500 !font-mono !text-[11px] !uppercase !tracking-wider">
        {label}
      </Text>
      <Metric className="!font-display !text-ink-950 !mt-1">{value}</Metric>
      {sub && <Text className="!text-ink-400 !text-xs !mt-1">{sub}</Text>}
    </Card>
  );
}
