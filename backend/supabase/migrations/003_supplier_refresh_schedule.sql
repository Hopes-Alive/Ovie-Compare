-- Per-supplier scheduled refresh configuration
alter table public.suppliers
  add column if not exists refresh_interval_minutes integer not null default 360
    check (refresh_interval_minutes >= 15 and refresh_interval_minutes <= 10080),
  add column if not exists last_scheduled_refresh_at timestamptz;

comment on column public.suppliers.refresh_interval_minutes is
  'Minutes between scheduled refresh cycles (15 min – 7 days).';
comment on column public.suppliers.last_scheduled_refresh_at is
  'When the last scheduled refresh cycle completed successfully.';
