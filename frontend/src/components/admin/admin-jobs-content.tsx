"use client";

import { AdminPageShell } from "@/components/admin/shell/admin-page-shell";
import { AdminSectionTitle } from "@/components/admin/shell/admin-section-title";
import { JobDetailPanel } from "@/components/admin/job-detail-panel";
import { JobsTable } from "@/components/admin/jobs-table";
import { mockLiveCheckJobs, mockScrapeJobs } from "@/data/mock/admin";
import { useState } from "react";

export function AdminJobsContent() {
  const [selectedJobId, setSelectedJobId] = useState<string | null>("scrape-2");
  const selectedJob = mockScrapeJobs.find((j) => j.id === selectedJobId);

  return (
    <AdminPageShell
      title="Jobs"
      description="Scrape and live-check job logs."
    >
      <div className="space-y-6">
        <section>
          <AdminSectionTitle title="Scrape jobs" />
          <JobsTable
            variant="scrape"
            jobs={mockScrapeJobs}
            selectedJobId={selectedJobId}
            onSelectJob={setSelectedJobId}
          />
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
          <JobsTable variant="live-check" jobs={mockLiveCheckJobs} />
        </section>
      </div>
    </AdminPageShell>
  );
}
