-- Separate Windsor/Essex part-time discovery and application evidence from the
-- main career profile while keeping the existing job/application workflow.

alter table public.jobs
  add column if not exists application_profile_id text not null default 'default';
alter table public.job_matches
  add column if not exists profile_id text not null default 'default';
alter table public.documents
  add column if not exists profile_id text not null default 'default';
alter table public.application_pack_runs
  add column if not exists profile_id text not null default 'default';

create index if not exists jobs_application_profile_discovered_idx
  on public.jobs(application_profile_id, discovered_at desc);
create index if not exists job_matches_profile_idx
  on public.job_matches(profile_id, analyzed_at desc);

update public.jobs
set application_profile_id = 'part-time'
where employment_type ~* '\m(part[[:space:]_-]*time|casual)\M'
   or title ~* '\m(part[[:space:]_-]*time|casual)\M';

update public.job_matches as match
set profile_id = job.application_profile_id,
    model = case
      when job.application_profile_id = 'part-time' then 'stale:part-time-resume-required'
      else match.model
    end
from public.jobs as job
where job.id = match.job_id;

update public.documents as document
set profile_id = job.application_profile_id
from public.jobs as job
where job.id = document.job_id;

update public.application_pack_runs as run
set profile_id = job.application_profile_id
from public.jobs as job
where job.id = run.job_id;

create schema if not exists private;

create or replace function private.ingest_windsor_part_time_job_alerts(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  canonical_url text;
  generated_id text;
  external_value text;
  parsed_posted_at timestamptz;
  was_present boolean;
  has_profile boolean;
  inserted_count integer := 0;
  processed_count integer := 0;
  inserted_ids jsonb := '[]'::jsonb;
  score integer;
begin
  if jsonb_typeof(payload) <> 'array' then
    raise exception 'payload must be a JSON array';
  end if;

  select exists(select 1 from public.candidate_profiles where id = 'part-time') into has_profile;

  for item in select value from jsonb_array_elements(payload)
  loop
    canonical_url := coalesce(nullif(item->>'apply_url', ''), nullif(item->>'url', ''));
    if canonical_url is null or canonical_url !~* '^https?://' then
      continue;
    end if;
    if nullif(item->>'title', '') is null or nullif(item->>'company', '') is null then
      continue;
    end if;

    parsed_posted_at := null;
    begin
      parsed_posted_at := nullif(item->>'posted_at', '')::timestamptz;
    exception when others then
      parsed_posted_at := null;
    end;

    external_value := coalesce(nullif(item->>'external_id', ''), canonical_url);
    generated_id := substr(encode(extensions.digest('windsor-part-time:' || external_value, 'sha256'), 'hex'), 1, 32);
    select exists(select 1 from public.jobs where id = generated_id) into was_present;
    score := case
      when coalesce(item->>'match_score', '') ~ '^\d{1,3}$'
        then greatest(0, least(100, (item->>'match_score')::integer))
      else 65
    end;

    insert into public.jobs (
      id, external_id, source, source_key, url, apply_url, title, company,
      location, description, posted_at, last_seen_at, salary_text,
      employment_type, remote, workplace_type, department, validity_status,
      health_score, application_profile_id, raw
    ) values (
      generated_id,
      external_value,
      coalesce(nullif(item->>'source', ''), 'windsor-part-time-search'),
      'windsor-part-time',
      coalesce(nullif(item->>'url', ''), canonical_url),
      canonical_url,
      item->>'title',
      item->>'company',
      coalesce(nullif(item->>'location', ''), 'Windsor, Ontario'),
      coalesce(nullif(item->>'description', ''), 'Part-time opportunity discovered from a public job source.'),
      parsed_posted_at,
      now(),
      nullif(item->>'salary_text', ''),
      coalesce(nullif(item->>'employment_type', ''), 'Part Time'),
      false,
      coalesce(nullif(item->>'workplace_type', ''), 'On-site'),
      nullif(item->>'category', ''),
      'likely_active',
      case when parsed_posted_at is not null then 80 else 65 end,
      'part-time',
      jsonb_build_object(
        'ingestion', 'windsor-part-time-alert',
        'profile_id', 'part-time',
        'ingested_at', now(),
        'listing', item
      )
    )
    on conflict (id) do update set
      url = excluded.url,
      apply_url = excluded.apply_url,
      title = excluded.title,
      company = excluded.company,
      location = excluded.location,
      description = case when length(excluded.description) > 75 then excluded.description else public.jobs.description end,
      posted_at = coalesce(excluded.posted_at, public.jobs.posted_at),
      last_seen_at = now(),
      salary_text = coalesce(excluded.salary_text, public.jobs.salary_text),
      employment_type = excluded.employment_type,
      workplace_type = excluded.workplace_type,
      department = coalesce(excluded.department, public.jobs.department),
      application_profile_id = 'part-time',
      raw = excluded.raw;

    insert into public.applications(job_id, status, updated_at)
    values (generated_id, 'discovered', now())
    on conflict (job_id) do nothing;

    insert into public.job_matches (
      job_id, overall, skills, experience, education, domain, location,
      recommendation, blockers, strengths, gaps, must_have, preferred,
      matched_skills, missing_skills, explanation, model, profile_id, analyzed_at
    ) values (
      generated_id,
      score,
      score,
      score,
      score,
      score,
      100,
      case when score >= 80 then 'strong' when score >= 65 then 'reasonable' when score >= 50 then 'stretch' else 'skip' end,
      coalesce(item->'blockers', '[]'::jsonb),
      coalesce(item->'strengths', '[]'::jsonb),
      coalesce(item->'gaps', '[]'::jsonb),
      coalesce(item->'must_have', '[]'::jsonb),
      coalesce(item->'preferred', '[]'::jsonb),
      coalesce(item->'matched_skills', '[]'::jsonb),
      coalesce(item->'missing_skills', '[]'::jsonb),
      coalesce(nullif(item->>'match_explanation', ''), 'Initial fit estimate from the Windsor part-time discovery workflow.'),
      case when has_profile then 'chatgpt-windsor-part-time-v1' else 'stale:part-time-resume-required' end,
      'part-time',
      now()
    )
    on conflict (job_id) do update set
      overall = excluded.overall,
      skills = excluded.skills,
      experience = excluded.experience,
      education = excluded.education,
      domain = excluded.domain,
      location = excluded.location,
      recommendation = excluded.recommendation,
      blockers = excluded.blockers,
      strengths = excluded.strengths,
      gaps = excluded.gaps,
      must_have = excluded.must_have,
      preferred = excluded.preferred,
      matched_skills = excluded.matched_skills,
      missing_skills = excluded.missing_skills,
      explanation = excluded.explanation,
      model = excluded.model,
      profile_id = 'part-time',
      analyzed_at = now()
    where public.job_matches.model is null
       or public.job_matches.model like 'stale:%'
       or public.job_matches.model = 'chatgpt-windsor-part-time-v1';

    processed_count := processed_count + 1;
    if not was_present then
      inserted_count := inserted_count + 1;
      inserted_ids := inserted_ids || jsonb_build_array(generated_id);
    end if;
  end loop;

  insert into public.activity_log(event, payload)
  values ('part_time.job_alert.ingested', jsonb_build_object(
    'processed', processed_count,
    'inserted', inserted_count,
    'profileReady', has_profile,
    'at', now()
  ));

  return jsonb_build_object(
    'processed_count', processed_count,
    'inserted_count', inserted_count,
    'inserted_ids', inserted_ids,
    'profile_ready', has_profile
  );
end;
$$;

revoke all on function private.ingest_windsor_part_time_job_alerts(jsonb) from public, anon, authenticated;
grant execute on function private.ingest_windsor_part_time_job_alerts(jsonb) to service_role;
