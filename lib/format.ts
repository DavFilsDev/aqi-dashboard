/**
 * Date formatting helpers.
 *
 * Every format is pinned to UTC and every call is meant to happen on the
 * SERVER. A client component that calls `toLocaleString` during render gets
 * two different answers — one per timezone and one per ICU build — and React
 * reports the difference as a hydration mismatch (minified errors 425, 418
 * and 423). Server-side formatting sidesteps the problem entirely: the client
 * only ever receives a finished string.
 */

const UTC = "UTC";

const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", {
  timeZone: UTC,
  dateStyle: "medium",
  timeStyle: "short",
});

const dayFormat = new Intl.DateTimeFormat("fr-FR", {
  timeZone: UTC,
  day: "2-digit",
  month: "short",
});

const fullDateFormat = new Intl.DateTimeFormat("fr-FR", {
  timeZone: UTC,
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatUtcDateTime(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? `${dateTimeFormat.format(d)} UTC` : "—";
}

export function formatUtcDay(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? dayFormat.format(d) : "";
}

export function formatUtcDate(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? fullDateFormat.format(d) : "—";
}

export function toIsoString(value: string | number | Date | null | undefined): string | null {
  const d = toDate(value);
  return d ? d.toISOString() : null;
}
