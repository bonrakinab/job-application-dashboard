-- Job Agent Phase 1 schema for Supabase/Postgres
-- Run in a new Supabase project's SQL editor.

create extension if not exists pgcrypto;

create type public.job_status as enum ('discovered', 'analyzed', 'recommended', 'skipped', 'archived');
create type public.application_status as enum ('not_started', 'reviewing', 'approved', 'applied', 'interview', 'rejected', 'offer', 'withdrawn');

create table if not exists public.candidate_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  headline text,
  location text,
  profile_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_id text,
  source_url text not null,
  job_hash text not null unique,
  company text not null,
  title text not null,
  location text,
  workplace_type text,
  employment_type text,
  salary_min numeric,
  salary_max numeric,
  salary_currency text,
  description text not null,
  posted_at timestamptz,
  discovered_at timestamptz not null default now(),
  status public.job_status not null default 'discovered',
  raw_payload jsonb not null default '{}'::jsonb
);

create index if not exists jobs_posted_at_idx on public.jobs(posted_at desc);
create index if not exists jobs_company_title_idx on public.jobs(company, title);
create index if not exists jobs_status_idx on public.jobs(status);

create table if not exists public.job_matches (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  overall_score smallint check (overall_score between 0 and 100),
  skills_score smallint check (skills_score between 0 and 100),
  experience_score smallint check (experience_score between 0 and 100),
  education_score smallint check (education_score between 0 and 100),
  location_score smallint check (location_score between 0 and 100),
  domain_score smallint check (domain_score between 0 and 100),
  hard_eligible boolean not null default true,
  hard_blockers jsonb not null default '[]'::jsonb,
  must_have_requirements jsonb not null default '[]'::jsonb,
  preferred_requirements jsonb not null default '[]'::jsonb,
  matched_skills jsonb not null default '[]'::jsonb,
  missing_skills jsonb not null default '[]'::jsonb,
  strengths jsonb not null default '[]'::jsonb,
  recommendation text,
  explanation text,
  model text,
  analyzed_at timestamptz not null default now()
);

create index if not exists job_matches_score_idx on public.job_matches(overall_score desc);
create index if not exists job_matches_eligible_idx on public.job_matches(hard_eligible);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  status public.application_status not null default 'not_started',
  applied_at timestamptz,
  response_at timestamptz,
  next_action_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists applications_status_idx on public.applications(status);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  kind text not null check (kind in ('resume', 'cover_letter', 'job_description', 'interview_brief')),
  storage_path text not null,
  template_version text,
  content_hash text,
  created_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null unique,
  website text,
  company_json jsonb not null default '{}'::jsonb,
  researched_at timestamptz
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  name text not null,
  title text,
  public_profile_url text,
  email text,
  email_confidence numeric,
  source text,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_log (
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_id text,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace view public.recommended_jobs as
select
  j.id, j.company, j.title, j.location, j.source_url, j.posted_at,
  m.overall_score, m.skills_score, m.experience_score, m.hard_eligible,
  m.recommendation, a.status as application_status
from public.jobs j
join public.job_matches m on m.job_id = j.id
left join public.applications a on a.job_id = j.id
where m.hard_eligible = true and m.overall_score >= 70
order by m.overall_score desc, j.posted_at desc nulls last;
