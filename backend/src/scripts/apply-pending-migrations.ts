/**
 * Applies pending SQL migrations (003, 004) when DATABASE_URL is set.
 * Usage: npx tsx src/scripts/apply-pending-migrations.ts
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, "../../supabase/migrations");

const FILES = ["003_supplier_refresh_schedule.sql", "004_scrape_job_logs.sql"];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set in backend/.env");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  for (const file of FILES) {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), "utf-8");
    console.log(`Applying ${file}…`);
    await client.query(sql);
    console.log(`  OK`);
  }

  await client.end();
  console.log("Migrations applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
