-- Supplemental public job-board discovery runs after the main company ATS job.
-- It reuses the same Vault-backed project URL and anon JWT; secret values are never stored here.

do $$
declare existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'job-dashboard-supplemental-discovery'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end $$;

select cron.schedule(
  'job-dashboard-supplemental-discovery',
  '10 12 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='job_dashboard_project_url') || '/functions/v1/supplemental-discovery',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='job_dashboard_anon_jwt')
    ),
    body := jsonb_build_object('trigger','cron','time',now()),
    timeout_milliseconds := 30000
  ) as request_id;
  $$
);
