"use client";

import { useState } from "react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { JobDetailPanel } from "@/components/admin/job-detail-panel";
import { JobsTable } from "@/components/admin/jobs-table";
import { mockLiveCheckJobs, mockScrapeJobs } from "@/data/mock/admin";

export function AdminJobsContent() {
  const [selectedJobId, setSelectedJobId] = useState<string | null>("scrape-2");
  const selectedJob = mockScrapeJobs.find((j) => j.id === selectedJobId);

  return (
    <>
      <AdminPageHeader
        title="Jobs"
        description="Scrape and live-check job logs."
      />
      <section>
        <h2 className="mb-4 text-lg font-medium">Scrape jobs</h2>
        <JobsTable
          variant="scrape"
          jobs={mockScrapeJobs}
          selectedJobId={selectedJobId}
          onSelectJob={setSelectedJobId}
        />
      </section>
      <section className="mt-8">
        <h2 className="mb-4 text-lg font-medium">Job detail</h2>
        <JobDetailPanel
          jobId={selectedJobId}
          jobLabel={
            selectedJob
              ? `${selectedJob.supplier} — ${selectedJob.startedAt}`
              : undefined
          }
        />
      </section>
      <section className="mt-10">
        <h2 className="mb-4 text-lg font-medium">Live check jobs</h2>
        <JobsTable variant="live-check" jobs={mockLiveCheckJobs} />
      </section>
    </>
  );
}
