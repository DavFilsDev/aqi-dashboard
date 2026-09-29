import { NextRequest, NextResponse } from "next/server";
import {
  askWarehouse,
  checkRateLimit,
  streamSummary,
  toAskError,
} from "@/lib/ai";
import { normaliseRows } from "@/lib/rows";
import type { AskEvent } from "@/types/aqi";

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
    const seconds = Math.ceil(rate.retryAfterMs / 1000);
    return NextResponse.json(
      { code: "rate_limited", error: `Trop de requêtes. Réessayez dans ${seconds}s.` },
      { status: 429, headers: { "Retry-After": String(seconds) } }
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

  const history = body.history ?? [];
  const encoder = new TextEncoder();

  // Everything past this point is a stream: the HTTP status is already 200,
  // so failures travel as an `error` event instead.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AskEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        send({ type: "status", label: "Traduction de la question en SQL…" });

        const { sql, rows, attempts } = await askWarehouse(question, history, 2, (validated) =>
          send({ type: "sql", sql: validated })
        );

        send({
          type: "rows",
          rows: normaliseRows(rows, CLIENT_ROW_LIMIT),
          rowCount: rows.length,
        });
        send({ type: "status", label: "Rédaction de la réponse…" });

        let degraded = false;
        try {
          await streamSummary(question, normaliseRows(rows, 30), (text) =>
            send({ type: "delta", text })
          );
        } catch (err) {
          console.error("[ask] summary failed, degrading to raw rows:", err);
          send({ type: "delta", text: FALLBACK_SUMMARY });
          degraded = true;
        }

        send({ type: "done", degraded, repaired: attempts > 1 });
      } catch (err) {
        const { code, error } = toAskError(err);
        if (code !== "sql_rejected") console.error(`[ask] ${code}:`, err);
        send({ type: "error", code, error });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
