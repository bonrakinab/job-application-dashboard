alter table jobs
  add column if not exists validity_status text not null default 'unknown'
    check (validity_status in ('active','likely_active','unknown','likely_closed','closed')),
  add column if not exists health_score integer not null default 50
    check (health_score between 0 and 100),
  add column if not exists last_verified_at timestamptz,
  add column if not exists apply_url_status integer,
  add column if not exists verification_signals jsonb not null default '[]'::jsonb,
  add column if not exists closure_reason text,
  add column if not exists verification_method text;

create index if not exists jobs_validity_status_idx on jobs(validity_status);
create index if not exists jobs_last_verified_at_idx on jobs(last_verified_at asc nulls first);
create index if not exists jobs_health_score_idx on jobs(health_score desc);

do $$
declare existing_jobid bigint;
begin
  select jobid into existing_jobid from cron.job where jobname = 'job-dashboard-validity-monitor' limit 1;
  if existing_jobid is not null then
    perform cron.unschedule(existing_jobid);
  end if;
end $$;

select cron.schedule(
  'job-dashboard-validity-monitor',
  '40 0,4,8,12,16,20 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='job_dashboard_project_url') || '/functions/v1/job-validity-monitor',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='job_dashboard_anon_jwt')
    ),
    body := jsonb_build_object('trigger','cron','time',now()),
    timeout_milliseconds := 60000
  ) as request_id;
  $$
);
