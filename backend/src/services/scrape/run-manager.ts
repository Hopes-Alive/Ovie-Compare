/**
 * In-process scrape run coordinator for admin manual triggers.
 */
import {
  getRunningRefreshJobs,
  reconcileOrphanedRunningJobs,
  requestCancelRunningRefreshJobs,
} from "./scrape-job.js";
import { appendScrapeLog } from "./scrape-log.js";
import { runAllSuppliersRefresh } from "./refresh-runner.js";

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

  state = { running: true, startedAt: new Date().toISOString(), jobIds: [] };

  activeRun = (async () => {
    try {
      const result = await runAllSuppliersRefresh("admin", options);
      state.jobIds = result.jobIds;
    } finally {
      state = { running: false, startedAt: null, jobIds: state.jobIds };
      activeRun = null;
    }
  })();

  return { started: true, message: "Scrape started" };
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
