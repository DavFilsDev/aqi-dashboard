import { formatUtcDate, formatUtcDateTime } from "@/lib/format";

const NUMERIC_STRING = /^-?\d+(\.\d+)?$/;

function isMidnightUtc(d: Date): boolean {
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
}

export function normaliseRowValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    return isMidnightUtc(value) ? formatUtcDate(value) : formatUtcDateTime(value);
  }
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    return NUMERIC_STRING.test(value) && Number.isFinite(Number(value)) ? Number(value) : value;
  }
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

export function normaliseRows(
  rows: Record<string, unknown>[],
  limit: number
): Record<string, unknown>[] {
  return rows.slice(0, limit).map((row) => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) out[key] = normaliseRowValue(value);
    return out;
  });
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((row) => headers.map((h) => escape(row[h])).join(","))].join("\n");
}
