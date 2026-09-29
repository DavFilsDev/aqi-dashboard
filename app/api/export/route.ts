import { NextRequest, NextResponse } from "next/server";
import { parseFilters } from "@/lib/filters";
import { getExplorerRowsForExport } from "@/lib/queries";
import { toCsv } from "@/lib/rows";

export async function GET(req: NextRequest) {
  const searchParams: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((v, k) => (searchParams[k] = v));
  const filters = parseFilters(searchParams);

  const rows = await getExplorerRowsForExport(filters);
  const csv = toCsv(rows as unknown as Record<string, unknown>[]);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="aqi-explorer-export.csv"`,
    },
  });
}
