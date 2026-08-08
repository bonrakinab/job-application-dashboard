select cron.schedule(
  'job-dashboard-expanded-remote-discovery',
  '20 12 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='job_dashboard_project_url') || '/functions/v1/expanded-remote-discovery',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='job_dashboard_anon_jwt')
    ),
    body := jsonb_build_object('trigger','cron','time',now()),
    timeout_milliseconds := 30000
  ) as request_id;
  $$
);