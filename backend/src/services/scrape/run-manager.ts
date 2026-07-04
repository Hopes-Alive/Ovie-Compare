/**
 * In-process scrape run coordinator for admin manual triggers.
 */
import {
  getRunningRefreshJobs,
  hasActiveScrapeJob,
  reconcileOrphanedRunningJobs,
  reconcileOrphanedSeedJobs,
  requestCancelRunningRefreshJobs,
} from "./scrape-job.js";
import { appendScrapeLog } from "./scrape-log.js";
import { loadActiveSuppliers, runSuppliersRefreshParallel } from "./refresh-runner.js";

type RunState = {
  running: boolean;
  startedAt: string | null;
  jobIds: string[];
};

let activeRun: Promise<void> | null = null;
let state: RunState = { running: false, startedAt: null, jobIds: [] };

export function getRunManagerState(): RunState {
  return { ...state };
}

export async function getScrapeStatus() {
  await reconcileOrphanedRunningJobs(state.running);
  await reconcileOrphanedSeedJobs();

  const runningJobs = await getRunningRefreshJobs();
  const inProcess = state.running || runningJobs.length > 0;

  return {
    running: inProcess,
    startedAt: state.startedAt ?? runningJobs[0]?.started_at ?? null,
    jobIds: [
      ...new Set([...state.jobIds, ...runningJobs.map((j) => j.id)]),
    ],
    jobs: runningJobs,
    cancelRequested: runningJobs.some((j) => j.cancel_requested),
  };
}

export async function startManualScrapeRun(
  options: import("./refresh-runner.js").RefreshRunOptions = {},
): Promise<{ started: boolean; message: string }> {
  const status = await getScrapeStatus();
  if (status.running) {
    return { started: false, message: "A scrape is already in progress" };
  }

  if (activeRun) {
    return { started: false, message: "A scrape is already in progress" };
  }

  // Resolve eligibility up front (not just inside the fired-off promise) so a
  // supplier with an orphaned/active scrape_job — e.g. a `seed` script left
  // stuck at `status: running` — produces an honest "nothing to run" response
  // instead of a false "Scrape started" with zero jobs ever created.
  const suppliers = await loadActiveSuppliers();
  const blocked: string[] = [];
  const eligible = [];
  for (const supplier of suppliers) {
    if (await hasActiveScrapeJob(supplier.id)) {
      blocked.push(supplier.name);
    } else {
      eligible.push(supplier);
    }
  }

  if (eligible.length === 0) {
    return {
      started: false,
      message:
        blocked.length > 0
          ? `No suppliers eligible — already has an active scrape job: ${blocked.join(", ")}`
          : "No active suppliers configured to scrape",
    };
  }

  state = { running: true, startedAt: new Date().toISOString(), jobIds: [] };

  activeRun = (async () => {
    try {
      const result = await runSuppliersRefreshParallel(eligible, "admin", options);
      state.jobIds = result.jobIds;
    } finally {
      state = { running: false, startedAt: null, jobIds: state.jobIds };
      activeRun = null;
    }
  })();

  const startedMessage =
    blocked.length > 0
      ? `Scrape started for ${eligible.map((s) => s.name).join(", ")} (skipped ${blocked.join(", ")} — already active)`
      : "Scrape started";

  return { started: true, message: startedMessage };
}

export async function cancelScrapeRun(): Promise<{ cancelled: boolean; message: string }> {
  const count = await requestCancelRunningRefreshJobs();
  const jobs = await getRunningRefreshJobs();

  for (const job of jobs) {
    await appendScrapeLog(job.id, "warn", "Cancel requested — stopping after current step…", {
      cancelled: true,
    });
  }

  if (count === 0 && !state.running) {
    return { cancelled: false, message: "No scrape is running" };
  }

  return {
    cancelled: true,
    message: count > 0 ? `Cancel signalled for ${count} job(s)` : "Cancel signalled",
  };
}
