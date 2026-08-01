const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

function loadEnvLocal() {
  const envPath = path.join(__dirname, ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error("No .env.local found next to this script.");
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, "");
      process.env[key] = value;
    }
  }
}

async function main() {
  loadEnvLocal();

  const raw = process.env.NEON_READONLY_URL;
  if (!raw) {
    console.error("NEON_READONLY_URL is not set in .env.local");
    process.exit(1);
  }

  const url = new URL(raw);
  if (url.searchParams.has("channel_binding")) {
    console.log("→ Dropping 'channel_binding' param for this test (node-postgres doesn't need it).");
    url.searchParams.delete("channel_binding");
  }

  console.log(`→ Host: ${url.hostname}`);
  console.log(`→ Database: ${url.pathname.replace("/", "")}`);
  console.log(`→ SSL mode: ${url.searchParams.get("sslmode")}`);
  console.log("→ Attempting connection (10s timeout)...\n");

  const client = new Client({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10_000,
  });

  const start = Date.now();
  try {
    await client.connect();
    const elapsed = Date.now() - start;
    console.log(`✓ Connected in ${elapsed}ms`);

    const res = await client.query("select now(), version();");
    console.log(`✓ Query succeeded:`, res.rows[0]);
    await client.end();
    console.log("\nDB connectivity is fine — the ETIMEDOUT was likely transient, or specific to how Next.js/pg-connection-string parsed the URL (e.g. channel_binding).");
  } catch (err) {
    const elapsed = Date.now() - start;
    console.error(`\n✗ Connection failed after ${elapsed}ms`);
    console.error(`  code: ${err.code}`);
    console.error(`  message: ${err.message}`);
    console.log("\nDiagnosis:");
    if (err.code === "ETIMEDOUT" || err.code === "ENETUNREACH") {
      console.log("  → Network cannot reach Neon at all (firewall/VPN blocking outbound port 5432, or DNS issue).");
      console.log("  → Try: nc -zv " + url.hostname + " 5432");
      console.log("  → Try connecting from a different network (e.g. phone hotspot) to confirm.");
    } else if (err.code === "ENOTFOUND") {
      console.log("  → DNS could not resolve the Neon hostname. Check for typos, or DNS blocking on this network.");
    } else if (err.message?.includes("password") || err.message?.includes("authentication")) {
      console.log("  → Reached Neon, but credentials are rejected. Check the password/role in the Neon dashboard.");
    } else if (err.message?.includes("SASL") || err.message?.includes("channel binding")) {
      console.log("  → SCRAM/channel-binding negotiation issue. Confirms channel_binding=require should be dropped from the URL.");
    } else {
      console.log("  → Unexpected error — check Neon project status (not suspended) and the connection string.");
    }
    process.exit(1);
  }
}

main();