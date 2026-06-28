/**
 * Scheduler daemon — checks each supplier's refresh_interval_minutes and
 * runs refresh when due.
 */
import "dotenv/config";
import { loadActiveSuppliers, runSuppliersRefreshParallel } from "../services/scrape/refresh-runner.js";

const TICK_SECONDS = Number(process.env.REFRESH_SCHEDULER_TICK_SECONDS ?? 60);

function isDueForRefresh(supplier: {
  refresh_interval_minutes: number;
  last_scheduled_refresh_at: string | null;
}): boolean {
  if (!supplier.last_scheduled_refresh_at) return true;
  const elapsedMs = Date.now() - new Date(supplier.last_scheduled_refresh_at).getTime();
  return elapsedMs >= supplier.refresh_interval_minutes * 60_000;
}

async function tick() {
  const suppliers = await loadActiveSuppliers();
  const due = suppliers.filter(isDueForRefresh);

  if (due.length === 0) return;

  if (due.length > 1) {
    console.log(`[scheduler] Starting ${due.length} due suppliers in parallel`);
  }

  await runSuppliersRefreshParallel(due, "scheduler");
}

async function main() {
  console.log(`[scheduler] Starting — tick every ${TICK_SECONDS}s`);
  await tick();
  setInterval(() => {
    tick().catch((err) => console.error("[scheduler] tick error:", err));
  }, TICK_SECONDS * 1000);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
