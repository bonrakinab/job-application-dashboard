update public.job_sources
set kind = 'greenhouse', company = 'StackAdapt', enabled = true
where kind = 'lever' and source_key = 'stackadapt';

insert into public.job_sources(kind, source_key, company, enabled)
values ('greenhouse', 'stackadapt-confidential', 'StackAdapt - Confidential', true)
on conflict(kind, source_key) do update
set company = excluded.company,
    enabled = excluded.enabled;
