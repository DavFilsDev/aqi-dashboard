import { NextRequest, NextResponse } from "next/server";
import {
  checkRateLimit,
  generateSql,
  runValidatedQuery,
  summarizeResult,
  validateSelectOnly,
  SqlValidationError,
} from "@/lib/ai";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const rate = checkRateLimit(ip);
  if (!rate.ok) {
    return NextResponse.json(
      { error: `Trop de requêtes. Réessayez dans ${Math.ceil(rate.retryAfterMs / 1000)}s.` },
      { status: 429 }
    );
  }

  let body: { question?: string; history?: { role: string; content: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const question = body.question?.trim();
  if (!question) {
    return NextResponse.json({ error: "La question est vide." }, { status: 400 });
  }
  if (question.length > 500) {
    return NextResponse.json({ error: "Question trop longue (500 caractères max)." }, { status: 400 });
  }

  try {
    const rawSql = await generateSql(question, body.history ?? []);
    const sql = validateSelectOnly(rawSql);
    const rows = await runValidatedQuery(sql);
    const summary = await summarizeResult(question, rows);

    return NextResponse.json({ sql, rows: rows.slice(0, 500), summary });
  } catch (err) {
    if (err instanceof SqlValidationError) {
      return NextResponse.json(
        { error: `La requête générée n'a pas passé la validation de sécurité : ${err.message}` },
        { status: 422 }
      );
    }
    console.error("Ask AI error:", err);
    return NextResponse.json(
      { error: "Impossible de générer une réponse pour cette question." },
      { status: 500 }
    );
  }
}
