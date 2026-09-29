import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPool, queryWithRetry } from "@/lib/db";
import { getGroq, getModelIds } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 30_000;
let cached: { at: number; body: unknown } | null = null;

function secretsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

async function probeDatabase() {
  const started = Date.now();
  try {
    const { rows } = await queryWithRetry(
      getPool(),
      `SELECT (SELECT COUNT(*) FROM dim_city)::int AS cities,
              (SELECT COUNT(*) FROM fact_aqi)::bigint AS facts,
              (SELECT MAX(timestamp_utc) FROM dim_time) AS last_refresh`
    );
    const r = rows[0] as { cities: number; facts: string; last_refresh: Date | string | null };
    return {
      ok: true,
      latencyMs: Date.now() - started,
      cities: Number(r.cities),
      facts: Number(r.facts),
      lastRefresh: r.last_refresh ? new Date(r.last_refresh).toISOString() : null,
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : "unknown error",
    };
  }
}

async function probeGroq() {
  const started = Date.now();
  const configured = getModelIds();
  try {
    const models = await getGroq().models.list();
    const available = models.data.map((m) => m.id);
    return {
      ok: true,
      latencyMs: Date.now() - started,
      configured,
      available,
      usable: configured.filter((id) => available.includes(id)),
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      configured,
      error: err instanceof Error ? err.message : "unknown error",
    };
  }
}

export async function GET(req: NextRequest) {
  const expected = process.env.DIAGNOSTICS_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "Diagnostics désactivées (DIAGNOSTICS_TOKEN non défini)." },
      { status: 404 }
    );
  }

  const provided = req.headers.get("x-diagnostics-token") ?? req.nextUrl.searchParams.get("token") ?? "";
  if (!secretsMatch(provided, expected)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json(cached.body, { headers: { "Cache-Control": "no-store" } });
  }

  const [database, ai] = await Promise.all([probeDatabase(), probeGroq()]);
  const body = {
    ok: database.ok && ai.ok,
    checkedAt: new Date().toISOString(),
    database,
    ai,
  };
  cached = { at: Date.now(), body };

  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
