import Link from "next/link";
import { Suspense } from "react";
import FilterBar from "@/components/filters/FilterBar";
import { parseFilters, filtersToSearchParams } from "@/lib/filters";
import { getAllCities, getExplorerRows } from "@/lib/queries";
import { aqiColor } from "@/lib/aqi-scale";
import { formatUtcDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const COLUMNS: { key: string; label: string; sortable: boolean }[] = [
  { key: "timestamp_utc", label: "Horodatage (UTC)", sortable: true },
  { key: "city", label: "Ville", sortable: true },
  { key: "aqi", label: "AQI", sortable: true },
  { key: "pm25", label: "PM2.5", sortable: true },
  { key: "pm10", label: "PM10", sortable: true },
  { key: "no2", label: "NO2", sortable: true },
  { key: "o3", label: "O3", sortable: true },
];

function sortHref(
  filters: ReturnType<typeof parseFilters>,
  key: string
): string {
  const nextDir = filters.sortBy === key && filters.sortDir === "asc" ? "desc" : "asc";
  const sp = filtersToSearchParams({ ...filters, sortBy: key, sortDir: nextDir, page: 1 });
  return `/explorer?${sp.toString()}`;
}

function pageHref(filters: ReturnType<typeof parseFilters>, page: number): string {
  const sp = filtersToSearchParams({ ...filters, page });
  return `/explorer?${sp.toString()}`;
}

async function ExplorerContent({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const filters = parseFilters(searchParams);
  const [cities, { rows, total }] = await Promise.all([getAllCities(), getExplorerRows(filters)]);

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 50;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const exportSp = filtersToSearchParams(filters);

  return (
    <div className="space-y-6">
      <FilterBar
        cities={cities}
        config={{ city: true, date: true, aqi: true, pollutants: true, dayType: true, hour: true }}
      />

      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-500">
          {total.toLocaleString("fr-FR")} lignes correspondent aux filtres
        </p>
        <a
          href={`/api/export?${exportSp.toString()}`}
          className="px-3 py-1.5 text-xs border border-ink-200 rounded-md hover:bg-ink-100"
        >
          Exporter en CSV
        </a>
      </div>

      <div className="bg-ink-100 border border-ink-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-200">
              {COLUMNS.map((c) => (
                <th key={c.key} className="text-left px-3 py-2 font-mono text-[11px] uppercase text-ink-500">
                  <Link href={sortHref(filters, c.key)} className="hover:text-ink-950">
                    {c.label}
                    {filters.sortBy === c.key && (filters.sortDir === "asc" ? " ↑" : " ↓")}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="text-center text-ink-400 py-10 text-sm">
                  Aucune ligne pour cette combinaison de filtres.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.fact_id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50">
                <td className="px-3 py-2 font-mono text-xs text-ink-600">
                  {formatUtcDateTime(r.timestamp_utc)}
                </td>
                <td className="px-3 py-2">{r.city}</td>
                <td className="px-3 py-2">
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1.5"
                    style={{ backgroundColor: aqiColor(r.aqi) }}
                  />
                  {r.aqi?.toFixed(2) ?? "—"}
                </td>
                <td className="px-3 py-2">{r.pm25?.toFixed(1) ?? "—"}</td>
                <td className="px-3 py-2">{r.pm10?.toFixed(1) ?? "—"}</td>
                <td className="px-3 py-2">{r.no2?.toFixed(1) ?? "—"}</td>
                <td className="px-3 py-2">{r.o3?.toFixed(1) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <Link
          href={pageHref(filters, Math.max(1, page - 1))}
          className={`px-3 py-1.5 border border-ink-200 rounded-md ${page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-ink-100"}`}
        >
          ← Précédent
        </Link>
        <span className="text-ink-500 font-mono text-xs">
          Page {page} / {totalPages}
        </span>
        <Link
          href={pageHref(filters, Math.min(totalPages, page + 1))}
          className={`px-3 py-1.5 border border-ink-200 rounded-md ${page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-ink-100"}`}
        >
          Suivant →
        </Link>
      </div>
    </div>
  );
}

export default function ExplorerPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse bg-ink-100 rounded-lg" />}>
      <ExplorerContent searchParams={searchParams} />
    </Suspense>
  );
}
