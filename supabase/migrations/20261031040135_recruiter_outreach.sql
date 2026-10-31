-- Single-owner JobAgent outreach, accessed only through authenticated server routes.
create table public.recruiter_outreach (
  profile_id text not null references public.candidate_profiles(id),
  contact_id text not null check (length(contact_id) between 1 and 200),
  record jsonb not null check (jsonb_typeof(record) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (profile_id, contact_id)
);
alter table public.recruiter_outreach enable row level security;
revoke all on public.recruiter_outreach from public, anon, authenticated;
grant select, insert, update, delete on public.recruiter_outreach to service_role;
comment on table public.recruiter_outreach is 'JobAgent recruiter stages, notes, custom contacts and interaction history. Server-only access; no public read/write policies.';
