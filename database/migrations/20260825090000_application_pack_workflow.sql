-- Durable execution history for the application-pack pipeline.

create table if not exists application_pack_runs (
  id uuid primary key default gen_random_uuid(),
  job_id text not null references jobs(id) on delete cascade,
  status text not null default 'running' check (status in ('running','completed','blocked','failed')),
  current_step text not null default 'started',
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists application_pack_runs_job_updated_idx on application_pack_runs(job_id, updated_at desc);
create index if not exists application_pack_runs_status_updated_idx on application_pack_runs(status, updated_at desc);

create table if not exists application_pack_run_steps (
  id bigserial primary key,
  run_id uuid not null references application_pack_runs(id) on delete cascade,
  step text not null,
  status text not null default 'completed' check (status in ('completed','skipped','failed')),
  details jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now(),
  unique(run_id, step)
);

create index if not exists application_pack_run_steps_run_idx on application_pack_run_steps(run_id);

alter table application_pack_runs enable row level security;
alter table application_pack_run_steps enable row level security;
