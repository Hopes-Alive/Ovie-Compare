/**
 * Scheduled refresh worker — CLI entry for cron / manual npm run refresh
 */
import "dotenv/config";
import {
  loadActiveSuppliers,
  runSuppliersRefreshParallel,
  runAllSuppliersRefresh,
  type RefreshRunOptions,
} from "../services/scrape/refresh-runner.js";

function getArg(name: string): string | null {
  const idx = process.argv.indexOf(name);
  return idx !== -1 ? (process.argv[idx + 1] ?? null) : null;
}

const supplierFilter = getArg("--supplier");
const forceRun = process.argv.includes("--force");
const skipPassB = process.argv.includes("--skip-pass-b");

const categoryLimitArg = getArg("--limit-categories");
const categoryPageLimitArg = getArg("--limit-pages");
const urlLimitArg = getArg("--limit-urls");

const runOptions: RefreshRunOptions = {
  categoryLimit: categoryLimitArg ? parseInt(categoryLimitArg, 10) : undefined,
  categoryPageLimit: categoryPageLimitArg ? parseInt(categoryPageLimitArg, 10) : undefined,
  urlLimit: urlLimitArg ? parseInt(urlLimitArg, 10) : undefined,
  skipPassB,
};

function isDueForRefresh(supplier: {
  refresh_interval_minutes: number;
  last_scheduled_refresh_at: string | null;
}): boolean {
  if (forceRun) return true;
  if (!supplier.last_scheduled_refresh_at) return true;
  const elapsedMs = Date.now() - new Date(supplier.last_scheduled_refresh_at).getTime();
  return elapsedMs >= supplier.refresh_interval_minutes * 60_000;
}

async function main() {
  console.log("Ovie Compare — scheduled refresh");
  console.log("================================\n");
  if (runOptions.categoryLimit) {
    console.log(`Test mode: limit ${runOptions.categoryLimit} categories per supplier`);
  }
  if (runOptions.skipPassB) console.log("Test mode: skipping pass B (per-URL checks)");

  if (forceRun && !supplierFilter) {
    await runAllSuppliersRefresh("admin", runOptions);
    console.log("\nRefresh run complete.");
    return;
  }

  const suppliers = await loadActiveSuppliers();
  const filtered = supplierFilter
    ? suppliers.filter((s) => s.slug === supplierFilter)
    : suppliers;

  if (filtered.length === 0) {
    console.log("No active suppliers with scrape_enabled.");
    return;
  }

  const due = filtered.filter((supplier) => {
    if (!isDueForRefresh(supplier)) {
      console.log(`Skipping ${supplier.slug}: not due yet`);
      return false;
    }
    return true;
  });

  if (due.length === 0) {
    console.log("\nRefresh run complete.");
    return;
  }

  if (due.length > 1) {
    console.log(`Running ${due.length} suppliers in parallel…`);
  }

  await runSuppliersRefreshParallel(
    due,
    forceRun ? "admin" : "scheduler",
    runOptions,
  );

  console.log("\nRefresh run complete.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
