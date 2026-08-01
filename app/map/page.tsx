import { Suspense } from "react";
import { Card, Title } from "@tremor/react";
import FilterBar from "@/components/filters/FilterBar";
import AqiMap from "@/components/map/AqiMap";
import { parseFilters } from "@/lib/filters";
import { getAllCities, getMapStats } from "@/lib/queries";

export const dynamic = "force-dynamic";

async function MapContent({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const filters = parseFilters(searchParams);
  const [cities, mapStats] = await Promise.all([getAllCities(), getMapStats(filters)]);

  return (
    <div className="space-y-6">
      <FilterBar cities={cities} config={{ city: true, date: true }} />
      <Card className="!bg-ink-100 !border-ink-200 !shadow-none !rounded-lg">
        <Title className="!font-display !text-ink-950">Carte des 9 villes</Title>
        <p className="text-xs text-ink-400 mb-4">
          Taille et couleur du marqueur = AQI moyen sur la période filtrée
        </p>
        <AqiMap data={mapStats} />
      </Card>
    </div>
  );
}

export default function MapPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse bg-ink-100 rounded-lg" />}>
      <MapContent searchParams={searchParams} />
    </Suspense>
  );
}
