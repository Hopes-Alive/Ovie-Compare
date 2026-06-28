-- Live scrape logs + cooperative cancel for refresh jobs

alter table public.scrape_jobs
  add column if not exists cancel_requested boolean not null default false;

create table if not exists public.scrape_job_logs (
  id uuid primary key default gen_random_uuid(),
  scrape_job_id uuid not null references public.scrape_jobs(id) on delete cascade,
  level text not null check (level in ('info', 'success', 'warn', 'error')),
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists scrape_job_logs_job_created_idx
  on public.scrape_job_logs (scrape_job_id, created_at);

alter table public.scrape_job_logs enable row level security;

grant select, insert on public.scrape_job_logs to service_role;
