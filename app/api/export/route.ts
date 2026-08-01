import { NextRequest, NextResponse } from "next/server";
import { parseFilters } from "@/lib/filters";
import { getExplorerRowsForExport } from "@/lib/queries";

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

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
