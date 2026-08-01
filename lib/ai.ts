import Groq from "groq-sdk";
import { getPool } from "@/lib/db";

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

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export class SqlValidationError extends Error {}

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
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
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
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
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
  const { rows } = await pool.query(sql);
  return rows.slice(0, 500);
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
