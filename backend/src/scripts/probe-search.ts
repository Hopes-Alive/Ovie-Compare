/**
 * Probe hybrid search — run sample queries without the LLM planner.
 *
 * Usage:
 *   npm run probe-search
 *   npm run probe-search -- --query "nitrile gloves medium"
 */
import "dotenv/config";
import { retrieveProducts } from "../services/brain/retrieval.js";
import type { SearchFilters } from "../services/brain/types.js";

const queryArg =
  process.argv.find((a) => a.startsWith("--query="))?.split("=")[1] ??
  (process.argv.includes("--query")
    ? process.argv[process.argv.indexOf("--query") + 1]
    : null);

const SAMPLES: SearchFilters[] = [
  {
    rewritten_query: queryArg ?? "nitrile gloves medium",
    name: "nitrile",
    category: "Disposables",
    subcategory: "Gloves",
  },
  {
    rewritten_query: "diamond burs FG",
    name: "bur",
    sort_by: "price_asc",
  },
  {
    rewritten_query: "3M Filtek composite",
    name: "Filtek",
    brand: "3M",
  },
];

async function runSample(filters: SearchFilters) {
  console.log(`\nQuery: "${filters.rewritten_query}"`);
  if (filters.name) console.log(`  name=${filters.name}`);
  if (filters.category) console.log(`  category=${filters.category}`);
  if (filters.sort_by) console.log(`  sort_by=${filters.sort_by}`);

  const result = await retrieveProducts(filters);
  console.log(`  matched=${result.total} returned=${result.rows.length} fallback=${result.fallback}`);

  for (const row of result.rows) {
    console.log(
      `  • [${row.supplier_slug}] ${row.name.slice(0, 60)} — $${row.price?.toFixed(2) ?? "?"} (sim=${(row.similarity ?? 0).toFixed(3)})`,
    );
  }
}

async function main() {
  const samples = queryArg ? [{ rewritten_query: queryArg, name: queryArg.split(/\s+/)[0] }] : SAMPLES;

  for (const filters of samples) {
    await runSample(filters);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
