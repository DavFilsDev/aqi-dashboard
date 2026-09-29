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

Column names are exact and case-insensitive. The pollutants are pm25, pm10, no2
and o3 — never pm2_5, pm_2_5, no_2 or o_3.

Rules:
- Always JOIN fact_aqi to dim_city (on city_id) and dim_time (on time_id) when you need city or date info.
- Qualify every column with its table (fact_aqi.aqi, dim_city.city, dim_time.date).
- A bare CTE name is allowed, but only the three star-schema tables may appear
  after FROM or JOIN. Never read pg_catalog or information_schema.
- Only ever write a single statement. A leading WITH ... SELECT is fine;
  INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE/CREATE and multiple statements are not.
- Always include a LIMIT clause, 500 rows maximum.
- Never use pg_sleep, set_config, current_setting, or any function that writes.
- Return ONLY the raw SQL, no markdown fences, no commentary.
- If you are given a PostgreSQL error, return the corrected query only.

Examples:
SELECT dim_city.city, AVG(fact_aqi.aqi) AS avg_aqi
FROM fact_aqi
JOIN dim_city ON dim_city.city_id = fact_aqi.city_id
GROUP BY dim_city.city
ORDER BY avg_aqi DESC
LIMIT 5;

SELECT dim_time.hour, AVG(fact_aqi.pm25) AS pm25
FROM fact_aqi
JOIN dim_time ON dim_time.time_id = fact_aqi.time_id
WHERE dim_city.city = 'Paris'
GROUP BY dim_time.hour
ORDER BY dim_time.hour
LIMIT 24;
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

const MAX_ROWS = 500;

const ALLOWED_TABLES = new Set(["fact_aqi", "dim_city", "dim_time"]);

const FORBIDDEN_KEYWORDS =
  /\b(insert|update|delete|drop|alter|truncate|grant|revoke|create|copy|call|do|vacuum|merge|refresh|comment|security)\b/i;

const FORBIDDEN_OBJECTS =
  /\b(pg_catalog|information_schema|pg_toast|pg_temp|pg_sleep|pg_read_file|pg_ls_dir|pg_read_binary_file|current_setting|set_config|lo_import|lo_export|nextval|setval|dblink|pg_notify)\b/i;

function stripFences(rawSql: string): string {
  let sql = rawSql.trim();
  sql = sql.replace(/^```sql\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  if (sql.endsWith(";")) sql = sql.slice(0, -1).trim();
  return sql;
}

function collectCteNames(sql: string): Set<string> {
  const names = new Set<string>();
  for (const m of sql.matchAll(/(?:\bwith\b|,)\s*"?([a-z_][a-z0-9_]*)"?\s+as\s*\(/gi)) {
    names.add(m[1].toLowerCase());
  }
  return names;
}

export function validateSelectOnly(rawSql: string): string {
  let sql = stripFences(rawSql);

  if (!sql) {
    throw new SqlValidationError("Empty query.");
  }
  if (sql.includes(";")) {
    throw new SqlValidationError("Multiple statements are not allowed.");
  }
  if (!/^(select|with)\s/i.test(sql)) {
    throw new SqlValidationError("Only SELECT statements are allowed.");
  }
  if (FORBIDDEN_KEYWORDS.test(sql)) {
    throw new SqlValidationError("Query contains a disallowed keyword.");
  }
  if (FORBIDDEN_OBJECTS.test(sql)) {
    throw new SqlValidationError("Query touches a forbidden system object.");
  }

  const cteNames = collectCteNames(sql);
  for (const m of sql.matchAll(/\b(?:from|join)\s+"?([a-z_][a-z0-9_]*)"?/gi)) {
    const table = m[1].toLowerCase();
    if (!ALLOWED_TABLES.has(table) && !cteNames.has(table)) {
      throw new SqlValidationError(`Table not allowed: ${table}`);
    }
  }

  // Clamp every LIMIT, then make sure the OUTERMOST query has one: a LIMIT
  // nested in a subquery used to satisfy the old check and let the outer
  // query return an unbounded number of rows.
  sql = sql.replace(/\blimit\s+(\d+)/gi, (_m, n) => `LIMIT ${Math.min(MAX_ROWS, Number(n))}`);
  if (!/\blimit\s+\d+\s*$/i.test(sql)) {
    sql = `${sql} LIMIT ${MAX_ROWS}`;
  }

  return sql;
}

type Turn = { role: "user" | "assistant"; content: string };

/** The chat API rejects a conversation that does not start with a user turn. */
function normaliseHistory(history: { role: string; content: string }[]): Turn[] {
  const turns = history
    .filter((h) => h.role === "user" || h.role === "assistant")
    .map((h) => ({ role: h.role as "user" | "assistant", content: h.content }));
  while (turns.length > 0 && turns[0].role !== "user") turns.shift();
  return turns.slice(-6);
}

export async function generateSql(
  question: string,
  history: { role: string; content: string }[]
): Promise<string> {
  const completion = await createCompletion({
    temperature: 0.1,
    max_tokens: 500,
    messages: [
      { role: "system", content: SCHEMA_DOC },
      ...normaliseHistory(history),
      { role: "user", content: question },
    ],
  });
  return completion.choices[0]?.message?.content ?? "";
}

export interface AskResult {
  sql: string;
  rows: Record<string, unknown>[];
  attempts: number;
}

/** Postgres errors worth a second attempt: the model picked a name that is not there. */
const REPAIRABLE_SQL_CODES = new Set([
  "42703", // undefined_column
  "42P01", // undefined_table
  "42601", // syntax_error
  "42883", // undefined_function
  "42804", // datatype_mismatch
  "22P02", // invalid_text_representation
  "22007", // invalid_datetime_format
]);

export function isRepairableSqlError(err: unknown): boolean {
  if (!(err instanceof DatabaseError)) return false;
  return err.code !== undefined && REPAIRABLE_SQL_CODES.has(err.code);
}

const REPAIR_PROMPT = (sql: string, message: string) =>
  [
    "That SQL was rejected by PostgreSQL. Fix it and return the corrected SELECT only.",
    "",
    "SQL you returned:",
    sql,
    "",
    `PostgreSQL error: ${message}`,
    "",
    `Valid column names — dim_city: city_id, city, country, latitude, longitude.
     dim_time: time_id, timestamp_utc, date, hour, day_of_week, is_weekend.
     fact_aqi: fact_id, city_id, time_id, aqi, pm25, pm10, no2, o3.
     Note the pollutant columns are named pm25, pm10, no2 and o3 — not pm2_5 or pm_2_5.`,
  ].join("\n");

/**
 * generate -> validate -> run, with one repair round: when PostgreSQL rejects
 * the generated SQL, the error is fed back to the model and the query is
 * regenerated. A hallucinated column name is the single most common failure
 * and it is entirely recoverable.
 */
export async function askWarehouse(
  question: string,
  history: { role: string; content: string }[] = [],
  maxAttempts = 2
): Promise<AskResult> {
  const repair: Turn[] = [];
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const sql = validateSelectOnly(await generateSql(question, [...history, ...repair]));
    try {
      const rows = await runValidatedQuery(sql);
      return { sql, rows, attempts: attempt };
    } catch (err) {
      lastError = err;
      const canRepair = attempt < maxAttempts && isRepairableSqlError(err);
      if (!canRepair) throw err;
      const message = err instanceof DatabaseError ? err.message : "unknown error";
      console.warn(`[ai] attempt ${attempt} rejected by Postgres, asking the model to repair:`, message);
      repair.push({ role: "assistant", content: sql }, { role: "user", content: REPAIR_PROMPT(sql, message) });
    }
  }

  throw lastError;
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
    return rows.slice(0, MAX_ROWS);
  } catch (err) {
    const e = err as { message?: string; code?: string };
    throw new DatabaseError(e?.message ?? "warehouse query failed", e?.code, err);
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
