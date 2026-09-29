import Groq from "groq-sdk";
import { getPool, DatabaseError } from "@/lib/db";

const SCHEMA_DOC = `
You write PostgreSQL SELECT queries against this exact star schema:

CREATE TABLE dim_city (
    city_id     SERIAL PRIMARY KEY,
    city        TEXT NOT NULL,
    country     TEXT NOT NULL,
    latitude    DOUBLE PRECISION NOT NULL,
    longitude   DOUBLE PRECISION NOT NULL
);

CREATE TABLE dim_time (
    time_id         SERIAL PRIMARY KEY,
    timestamp_utc   TIMESTAMP NOT NULL,
    date            DATE NOT NULL,
    hour            SMALLINT NOT NULL,
    day_of_week     SMALLINT NOT NULL, -- 0=Monday .. 6=Sunday
    is_weekend      BOOLEAN NOT NULL
);

CREATE TABLE fact_aqi (
    fact_id     BIGSERIAL PRIMARY KEY,
    city_id     INTEGER NOT NULL REFERENCES dim_city(city_id),
    time_id     INTEGER NOT NULL REFERENCES dim_time(time_id),
    aqi         DOUBLE PRECISION, -- OpenWeather scale 1 (Good) .. 5 (Very Poor)
    pm25        DOUBLE PRECISION,
    pm10        DOUBLE PRECISION,
    no2         DOUBLE PRECISION,
    o3          DOUBLE PRECISION
);

Cities currently loaded: Paris (France), Madrid (Spain), Buenos Aires (Argentina),
London (England), Antananarivo, Toamasina, Antsirabe, Mahajanga, Fianarantsoa (Madagascar).

Rules:
- Always JOIN fact_aqi to dim_city (on city_id) and dim_time (on time_id) when you need city or date info.
- Only ever write a single SELECT statement. Never write INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE/CREATE, and never write more than one statement.
- Always include a LIMIT clause, 500 rows maximum.
- Return ONLY the raw SQL, no markdown fences, no commentary.
`;

const PRIMARY_MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
const FALLBACK_MODEL = "openai/gpt-oss-20b";

export class SqlValidationError extends Error {}
export class ConfigurationError extends Error {}

let client: Groq | null = null;

export function getGroq(): Groq {
  if (!client) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new ConfigurationError(
        "GROQ_API_KEY is not set. Add it to .env.local (see .env.example)."
      );
    }
    client = new Groq({ apiKey });
  }
  return client;
}

function isModelUnavailable(err: unknown): boolean {
  const e = err as { status?: number; code?: string; message?: string } | null;
  if (!e) return false;
  if (e.status === 404) return true;
  if (e.code === "model_not_found") return true;
  return /does not exist|do not have access to it/i.test(e.message ?? "");
}

type CompletionParams = {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  temperature?: number;
  max_tokens?: number;
};

const GROQ_TIMEOUT_MS = Number(process.env.GROQ_TIMEOUT_MS ?? 8_000);

async function createCompletion(params: CompletionParams) {
  const models = [PRIMARY_MODEL, FALLBACK_MODEL];
  for (let i = 0; i < models.length; i++) {
    try {
      return await getGroq().chat.completions.create(
        { ...params, model: models[i] },
        { signal: AbortSignal.timeout(GROQ_TIMEOUT_MS), maxRetries: 1 }
      );
    } catch (err) {
      if (i < models.length - 1 && isModelUnavailable(err)) {
        console.warn(`[ai] model "${models[i]}" unavailable, retrying with "${models[i + 1]}"`);
        continue;
      }
      throw err;
    }
  }
  throw new ConfigurationError("No usable completion model is configured.");
}

export interface AskError {
  status: number;
  code: string;
  error: string;
}

/**
 * Maps any thrown value onto a status + stable machine code + French message.
 * Never leaks the DSN, the API key or a stack trace to the client.
 */
export function toAskError(err: unknown): AskError {
  if (err instanceof SqlValidationError) {
    return {
      status: 422,
      code: "sql_rejected",
      error: `La requête générée n'a pas passé la validation de sécurité : ${err.message}`,
    };
  }
  if (err instanceof ConfigurationError) {
    return {
      status: 503,
      code: "ai_misconfigured",
      error: "Le service « Ask AI » n'est pas configuré sur ce déploiement.",
    };
  }

  const e = (err ?? {}) as { status?: number; code?: string; name?: string; message?: string };
  if (e.status === 404 || e.code === "model_not_found") {
    return {
      status: 503,
      code: "ai_model_unavailable",
      error: "Le modèle IA configuré n'est plus disponible chez le fournisseur.",
    };
  }
  if (e.status === 401 || e.status === 403) {
    return {
      status: 503,
      code: "ai_unauthorized",
      error: "Clé API refusée par le fournisseur IA.",
    };
  }
  if (e.status === 429) {
    return {
      status: 429,
      code: "ai_rate_limited",
      error: "Le fournisseur IA est saturé. Réessayez dans quelques secondes.",
    };
  }
  if (e.name === "TimeoutError" || e.name === "AbortError" || e.code === "ETIMEDOUT") {
    return {
      status: 504,
      code: "ai_timeout",
      error: "Le fournisseur IA n'a pas répondu à temps. Réessayez.",
    };
  }
  if (err instanceof DatabaseError) {
    return {
      status: 502,
      code: "warehouse_unavailable",
      error: "L'entrepôt de données n'a pas pu être interrogé.",
    };
  }
  return {
    status: 500,
    code: "internal",
    error: "Impossible de générer une réponse pour cette question.",
  };
}

export function validateSelectOnly(rawSql: string): string {
  let sql = rawSql.trim();
  sql = sql.replace(/^```sql\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

  if (sql.endsWith(";")) sql = sql.slice(0, -1).trim();

  if (sql.includes(";")) {
    throw new SqlValidationError("Multiple statements are not allowed.");
  }

  if (!/^select\s/i.test(sql)) {
    throw new SqlValidationError("Only SELECT statements are allowed.");
  }

  const forbidden = /\b(insert|update|delete|drop|alter|truncate|grant|revoke|create|copy|call|do|vacuum|merge)\b/i;
  if (forbidden.test(sql)) {
    throw new SqlValidationError("Query contains a disallowed keyword.");
  }

  if (!/\blimit\s+\d+/i.test(sql)) {
    sql = `${sql} LIMIT 500`;
  } else {
    sql = sql.replace(/\blimit\s+(\d+)/i, (_m, n) => `LIMIT ${Math.min(500, Number(n))}`);
  }

  return sql;
}

export async function generateSql(question: string, history: { role: string; content: string }[]): Promise<string> {
  const completion = await createCompletion({
    temperature: 0.1,
    max_tokens: 500,
    messages: [
      { role: "system", content: SCHEMA_DOC },
      ...history.slice(-6).map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
      { role: "user", content: question },
    ],
  });
  return completion.choices[0]?.message?.content ?? "";
}

export async function summarizeResult(
  question: string,
  rows: Record<string, unknown>[]
): Promise<string> {
  const sample = JSON.stringify(rows.slice(0, 30));
  const completion = await createCompletion({
    temperature: 0.2,
    max_tokens: 300,
    messages: [
      {
        role: "system",
        content:
          "You explain air-quality query results in 2-4 plain sentences, in the same language as the question. Be concrete: name cities, numbers, trends. Do not mention SQL.",
      },
      {
        role: "user",
        content: `Question: ${question}\nResult rows (JSON, may be truncated): ${sample}\n\nWrite a short answer.`,
      },
    ],
  });
  return completion.choices[0]?.message?.content ?? "";
}

export async function runValidatedQuery(sql: string): Promise<Record<string, unknown>[]> {
  const pool = getPool();
  try {
    const { rows } = await pool.query(sql);
    return rows.slice(0, 500);
  } catch (err) {
    throw new DatabaseError(
      err instanceof Error ? err.message : "warehouse query failed",
      err
    );
  }
}

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 8;
const buckets = new Map<string, number[]>();

export function checkRateLimit(key: string): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  const timestamps = (buckets.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfterMs = WINDOW_MS - (now - timestamps[0]);
    return { ok: false, retryAfterMs };
  }
  timestamps.push(now);
  buckets.set(key, timestamps);
  return { ok: true, retryAfterMs: 0 };
}
