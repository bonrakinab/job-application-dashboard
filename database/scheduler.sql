-- Run after deploying supabase/functions/daily-discovery.
-- Store values in Vault first; never commit them to this file:
--   job_dashboard_project_url = https://<project-ref>.supabase.co
--   job_dashboard_anon_jwt    = legacy anon JWT used only to authenticate the function invocation

create extension if not exists pg_net;
create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

select cron.schedule(
  'job-dashboard-daily-discovery',
  '0 12 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'job_dashboard_project_url') || '/functions/v1/daily-discovery',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'job_dashboard_anon_jwt')
    ),
    body := jsonb_build_object('trigger', 'cron', 'time', now()),
    timeout_milliseconds := 30000
  ) as request_id;
  $$
);
