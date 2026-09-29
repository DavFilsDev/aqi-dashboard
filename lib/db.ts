import { Pool, QueryResultRow } from "pg";

export class DatabaseError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string, readonly cause?: unknown) {
    super(message);
    this.name = "DatabaseError";
    this.code = code;
  }
}

declare global {
  var __aqiPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.NEON_READONLY_URL;
  if (!connectionString) {
    throw new Error(
      "NEON_READONLY_URL is not set. Add it to .env.local (see .env.example)."
    );
  }
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 5,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    keepAlive: true,
  });

  pool.on("error", (err) => {
    console.error("[db] idle client error — will reconnect on next query:", err.message);
  });

  return pool;
}

export function getPool(): Pool {
  if (!global.__aqiPool) {
    global.__aqiPool = createPool();
  }
  return global.__aqiPool;
}

const TRANSIENT_ERROR_CODES = new Set([
  "ETIMEDOUT",
  "ECONNRESET",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "EAI_AGAIN",
]);

function isTransient(err: unknown): boolean {
  const code = (err as { code?: string; errors?: { code?: string }[] })?.code;
  if (code && TRANSIENT_ERROR_CODES.has(code)) return true;
  const nested = (err as { errors?: { code?: string }[] })?.errors;
  return Boolean(nested?.some((e) => e.code && TRANSIENT_ERROR_CODES.has(e.code)));
}

export async function queryWithRetry<T extends QueryResultRow = any>(
  pool: Pool,
  text: string,
  params?: unknown[]
): Promise<{ rows: T[] }> {
  try {
    return await pool.query<T>(text, params as any[]);
  } catch (err) {
    if (!isTransient(err)) throw err;
    console.warn("[db] transient error, retrying once:", (err as Error).message);
    await new Promise((r) => setTimeout(r, 500));
    return await pool.query<T>(text, params as any[]);
  }
}
