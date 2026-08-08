-- Job Application Dashboard / Supabase schema
-- Run this once in the Supabase SQL editor. The app uses server-side secret-key access.

create table if not exists candidate_profiles (
  id text primary key default 'default',
  profile jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists job_sources (
  id bigserial primary key,
  kind text not null check (kind in ('greenhouse','lever','ashby')),
  source_key text not null,
  company text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique(kind, source_key)
);

-- Useful public ATS sources for Canada/Ontario-focused discovery.
insert into job_sources(kind, source_key, company, enabled) values
  ('ashby','cohere','Cohere',true),
  ('ashby','ashby','Ashby',true),
  ('ashby','magical','Magical',true),
  ('ashby','terminal','Terminal',true),
  ('ashby','runbook','Runbook',true),
  ('greenhouse','stackadapt','StackAdapt',true),
  ('greenhouse','stackadapt-confidential','StackAdapt - Confidential',true),
  ('lever','getmaple','Maple',true),
  ('lever','wealthsimple','Wealthsimple',true),
  ('lever','applydigital','APPLY',true),
  ('greenhouse','clutch','Clutch',true)
on conflict(kind, source_key) do update set company = excluded.company, enabled = excluded.enabled;

create table if not exists jobs (
  id text primary key,
  external_id text not null,
  source text not null,
  source_key text not null,
  url text not null,
  apply_url text,
  title text not null,
  company text not null,
  location text,
  description text not null,
  posted_at timestamptz,
  discovered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  salary_min numeric,
  salary_max numeric,
  currency text,
  salary_text text,
  employment_type text,
  remote boolean,
  workplace_type text,
  department text,
  raw jsonb,
  unique(source, source_key, external_id)
);

create index if not exists jobs_posted_at_idx on jobs(posted_at desc);
create index if not exists jobs_discovered_at_idx on jobs(discovered_at desc);
create index if not exists jobs_company_idx on jobs(company);

create table if not exists job_matches (
  job_id text primary key references jobs(id) on delete cascade,
  overall integer not null check (overall between 0 and 100),
  skills integer not null check (skills between 0 and 100),
  experience integer not null check (experience between 0 and 100),
  education integer not null check (education between 0 and 100),
  domain integer not null check (domain between 0 and 100),
  location integer not null check (location between 0 and 100),
  recommendation text not null,
  blockers jsonb not null default '[]'::jsonb,
  strengths jsonb not null default '[]'::jsonb,
  gaps jsonb not null default '[]'::jsonb,
  must_have jsonb not null default '[]'::jsonb,
  preferred jsonb not null default '[]'::jsonb,
  matched_skills jsonb not null default '[]'::jsonb,
  missing_skills jsonb not null default '[]'::jsonb,
  explanation text not null default '',
  model text,
  analyzed_at timestamptz not null default now()
);

create index if not exists job_matches_overall_idx on job_matches(overall desc);
create index if not exists job_matches_recommendation_idx on job_matches(recommendation);

create table if not exists applications (
  id bigserial primary key,
  job_id text not null unique references jobs(id) on delete cascade,
  status text not null default 'discovered',
  applied_at timestamptz,
  response_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists applications_status_idx on applications(status);

create table if not exists documents (
  id bigserial primary key,
  job_id text not null references jobs(id) on delete cascade,
  kind text not null,
  content_text text,
  content_json jsonb,
  model text,
  created_at timestamptz not null default now(),
  unique(job_id, kind)
);

create table if not exists companies (
  name text primary key,
  website text,
  notes text,
  intelligence jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists contacts (
  id bigserial primary key,
  company text not null,
  name text not null,
  title text,
  email text,
  public_profile text,
  source text,
  confidence numeric,
  created_at timestamptz not null default now()
);

create table if not exists activity_log (
  id bigserial primary key,
  event text not null,
  job_id text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists oauth_connections (
  provider text primary key,
  refresh_token_ciphertext text not null,
  scope text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace view recommended_jobs
with (security_invoker = true) as
select
  j.*,
  m.overall,
  m.skills,
  m.experience,
  m.education,
  m.domain,
  m.location as location_score,
  m.recommendation,
  m.blockers,
  m.strengths,
  m.gaps,
  m.explanation,
  a.status as application_status
from jobs j
join job_matches m on m.job_id = j.id
left join applications a on a.job_id = j.id
where m.recommendation <> 'skip'
order by m.overall desc, j.posted_at desc nulls last;

-- Personal dashboard: no browser/anon table access. Server secret keys bypass RLS.
alter table candidate_profiles enable row level security;
alter table job_sources enable row level security;
alter table jobs enable row level security;
alter table job_matches enable row level security;
alter table applications enable row level security;
alter table documents enable row level security;
alter table companies enable row level security;
alter table contacts enable row level security;
alter table activity_log enable row level security;
alter table oauth_connections enable row level security;
