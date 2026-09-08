-- Add Y Combinator job enrichment without weakening the private server-only
-- access model. YC-specific details remain metadata; normal ATS and profile
-- policies continue to be authoritative for application packs.

alter table public.job_matches
  add column if not exists startup_fit integer check (startup_fit between 0 and 100);

alter table public.company_watchlist
  add column if not exists source text not null default 'curated'
    check (source in ('curated', 'yc')),
  add column if not exists source_metadata jsonb not null default '{}'::jsonb;

create index if not exists company_watchlist_source_priority_idx
  on public.company_watchlist(source, priority, company);

do $migration$
begin
  if not exists (select 1 from cron.job where jobname = 'job-dashboard-yc-discovery') then
    perform cron.schedule(
      'job-dashboard-yc-discovery',
      '40 */6 * * *',
      $cron$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'job_dashboard_project_url') || '/functions/v1/yc-discovery',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'job_dashboard_anon_jwt')
        ),
        body := jsonb_build_object('trigger', 'cron', 'time', now()),
        timeout_milliseconds := 60000
      ) as request_id;
      $cron$
    );
  end if;
end
$migration$;
