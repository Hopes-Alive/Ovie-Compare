"use client";

import { useCallback, useEffect, useState } from "react";

import { AdminPageShell } from "@/components/admin/shell/admin-page-shell";
import { AdminSectionTitle } from "@/components/admin/shell/admin-section-title";
import { JobDetailPanel } from "@/components/admin/job-detail-panel";
import { JobsTable } from "@/components/admin/jobs-table";
import type { LiveCheckJobSummary, ScrapeJobSummary } from "@/types/admin";

export function AdminJobsContent() {
  const [scrapeJobs, setScrapeJobs] = useState<ScrapeJobSummary[]>([]);
  const [liveCheckJobs, setLiveCheckJobs] = useState<LiveCheckJobSummary[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/jobs");
      const data = (await res.json()) as {
        scrapeJobs?: ScrapeJobSummary[];
        liveCheckJobs?: LiveCheckJobSummary[];
      };
      setScrapeJobs(data.scrapeJobs ?? []);
      setLiveCheckJobs(data.liveCheckJobs ?? []);
    } catch {
      setScrapeJobs([]);
      setLiveCheckJobs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    if (!selectedJobId && scrapeJobs[0]) {
      setSelectedJobId(scrapeJobs[0].id);
    }
  }, [scrapeJobs, selectedJobId]);

  const selectedJob = scrapeJobs.find((j) => j.id === selectedJobId);

  return (
    <AdminPageShell
      title="Jobs"
      description="Scrape and live-check job logs."
    >
      <div className="space-y-6">
        <section>
          <AdminSectionTitle title="Scrape jobs" />
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading jobs…</p>
          ) : (
            <JobsTable
              variant="scrape"
              jobs={scrapeJobs}
              selectedJobId={selectedJobId}
              onSelectJob={setSelectedJobId}
            />
          )}
        </section>

        <section>
          <AdminSectionTitle title="Job detail" />
          <JobDetailPanel
            jobId={selectedJobId}
            jobLabel={
              selectedJob
                ? `${selectedJob.supplier} — ${selectedJob.startedAt}`
                : undefined
            }
          />
        </section>

        <section>
          <AdminSectionTitle title="Live check jobs" />
          <JobsTable variant="live-check" jobs={liveCheckJobs} />
        </section>
      </div>
    </AdminPageShell>
  );
}
