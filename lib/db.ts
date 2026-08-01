import { Pool } from "pg";

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
