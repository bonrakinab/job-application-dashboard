-- Increase public job-source polling so fresh Ontario listings are normally found
-- within one to four hours instead of only once per day.

select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'job-dashboard-daily-discovery'),
  schedule := '0 * * * *'
);

select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'job-dashboard-supplemental-discovery'),
  schedule := '10 */2 * * *'
);

select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'job-dashboard-expanded-remote-discovery'),
  schedule := '20 */4 * * *'
);

select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'job-dashboard-enterprise-discovery'),
  schedule := '30 */2 * * *'
);

-- Add a half-hour direct-ATS pass during Toronto business hours on Tuesdays,
-- and on every weekday in the September/October hiring season. The time-zone
-- check keeps the business-hour window stable across daylight-saving changes.
select cron.schedule(
  'job-dashboard-peak-direct-discovery',
  '30 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'job_dashboard_project_url') || '/functions/v1/daily-discovery',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'job_dashboard_anon_jwt')
    ),
    body := jsonb_build_object('trigger', 'peak-cron', 'time', now()),
    timeout_milliseconds := 30000
  ) as request_id
  where extract(hour from now() at time zone 'America/Toronto') between 6 and 18
    and (
      extract(isodow from now() at time zone 'America/Toronto') = 2
      or (
        extract(month from now() at time zone 'America/Toronto') in (9, 10)
        and extract(isodow from now() at time zone 'America/Toronto') between 1 and 5
      )
    );
  $$
);
