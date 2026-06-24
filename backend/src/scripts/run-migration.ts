/**
 * Applies a SQL migration file to Supabase via the Management API (HTTPS).
 * Used when direct Postgres connections are unavailable.
 *
 * Usage: npx tsx src/scripts/run-migration.ts
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION_FILE = resolve(__dirname, "../../supabase/migrations/001_initial_schema.sql");
const PROJECT_REF = "shbckwztiwdnvkppwqpm";
const PAT = process.env.SUPABASE_PAT!;

if (!PAT) {
  console.error("SUPABASE_PAT env var not set");
  process.exit(1);
}

async function runQuery(sql: string): Promise<unknown> {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAT}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function main() {
  console.log("Reading migration file…");
  const sql = readFileSync(MIGRATION_FILE, "utf-8");

  console.log("Sending migration to Supabase…");
  try {
    await runQuery(sql);
    console.log("Migration applied successfully.");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("already exists")) {
      console.log("Tables already exist — migration already applied.");
    } else {
      console.error("Migration failed:", msg);
      process.exit(1);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
