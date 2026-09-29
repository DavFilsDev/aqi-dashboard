import { NextRequest, NextResponse } from "next/server";
import {
  askWarehouse,
  checkRateLimit,
  summarizeResult,
  toAskError,
} from "@/lib/ai";
import { normaliseRows } from "@/lib/rows";

export const runtime = "nodejs";
export const maxDuration = 30;

const FALLBACK_SUMMARY =
  "Le résumé automatique n'a pas pu être généré, voici donc les résultats bruts de la requête.";

/** The summariser only ever reads the first 30 rows; the rest is display only. */
const CLIENT_ROW_LIMIT = 200;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const rate = checkRateLimit(ip);
  if (!rate.ok) {
    return NextResponse.json(
      {
        code: "rate_limited",
        error: `Trop de requêtes. Réessayez dans ${Math.ceil(rate.retryAfterMs / 1000)}s.`,
      },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) } }
    );
  }

  let body: { question?: string; history?: { role: string; content: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { code: "bad_request", error: "Corps de requête invalide." },
      { status: 400 }
    );
  }

  const question = body.question?.trim();
  if (!question) {
    return NextResponse.json(
      { code: "bad_request", error: "La question est vide." },
      { status: 400 }
    );
  }
  if (question.length > 500) {
    return NextResponse.json(
      { code: "bad_request", error: "Question trop longue (500 caractères max)." },
      { status: 400 }
    );
  }

  try {
    const { sql, rows, attempts } = await askWarehouse(question, body.history ?? []);

    let summary: string;
    let degraded = false;
    try {
      summary = await summarizeResult(question, normaliseRows(rows, 30));
    } catch (err) {
      console.error("[ask] summary failed, degrading to raw rows:", err);
      summary = FALLBACK_SUMMARY;
      degraded = true;
    }

    return NextResponse.json({
      sql,
      rows: normaliseRows(rows, CLIENT_ROW_LIMIT),
      rowCount: rows.length,
      summary,
      degraded,
      repaired: attempts > 1,
    });
  } catch (err) {
    const { status, code, error } = toAskError(err);
    if (status >= 500) console.error(`[ask] ${code}:`, err);
    return NextResponse.json({ code, error }, { status });
  }
}
