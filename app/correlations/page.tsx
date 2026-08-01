import { Suspense } from "react";
import FilterBar from "@/components/filters/FilterBar";
import CorrelationHeatmap from "@/components/charts/CorrelationHeatmap";
import ScatterPlot from "@/components/charts/ScatterPlot";
import { parseFilters } from "@/lib/filters";
import { getAllCities, getCorrelationMatrix, getScatterData } from "@/lib/queries";

export const dynamic = "force-dynamic";

async function CorrelationsContent({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const filters = parseFilters(searchParams);
  const [cities, matrix, scatter] = await Promise.all([
    getAllCities(),
    getCorrelationMatrix(filters),
    getScatterData(filters),
  ]);

  return (
    <div className="space-y-6">
      <FilterBar cities={cities} config={{ city: true, date: true }} />
      <CorrelationHeatmap matrix={matrix} />
      <ScatterPlot data={scatter} />
    </div>
  );
}

export default function CorrelationsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse bg-ink-100 rounded-lg" />}>
      <CorrelationsContent searchParams={searchParams} />
    </Suspense>
  );
}
