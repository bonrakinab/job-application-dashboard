create table if not exists enterprise_job_sources (
  id bigserial primary key,
  kind text not null check (kind in ('workday','amazon')),
  source_key text not null,
  company text not null references company_watchlist(company) on delete cascade,
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  last_checked_at timestamptz,
  last_status text,
  last_error text,
  last_job_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(kind, source_key)
);

alter table enterprise_job_sources enable row level security;

insert into enterprise_job_sources(kind, source_key, company, config, enabled) values
  ('amazon','amazon-canada','Amazon','{"country":"CAN","maxPages":5}'::jsonb,true),
  ('workday','td-bank-careers','TD','{"host":"td.wd3.myworkdayjobs.com","tenant":"td","site":"TD_Bank_Careers","maxPages":5}'::jsonb,true),
  ('workday','bmo-external','BMO','{"host":"bmo.wd3.myworkdayjobs.com","tenant":"bmo","site":"External","maxPages":5}'::jsonb,true),
  ('workday','bmo-campus','BMO','{"host":"bmo.wd3.myworkdayjobs.com","tenant":"bmo","site":"Campus","maxPages":4}'::jsonb,true),
  ('workday','cibc-search','CIBC','{"host":"cibc.wd3.myworkdayjobs.com","tenant":"cibc","site":"search","maxPages":5}'::jsonb,true),
  ('workday','cibc-campus','CIBC','{"host":"cibc.wd3.myworkdayjobs.com","tenant":"cibc","site":"campus","maxPages":4}'::jsonb,true),
  ('workday','sunlife-campus','Sun Life','{"host":"sunlife.wd3.myworkdayjobs.com","tenant":"sunlife","site":"Campus","maxPages":5}'::jsonb,true),
  ('workday','sunlife-experienced','Sun Life','{"host":"sunlife.wd3.myworkdayjobs.com","tenant":"sunlife","site":"Experienced-Jobs","maxPages":5}'::jsonb,true),
  ('workday','manulife-mfcjh','Manulife','{"host":"manulife.wd3.myworkdayjobs.com","tenant":"manulife","site":"MFCJH_Jobs","maxPages":5}'::jsonb,true),
  ('workday','thomsonreuters-external','Thomson Reuters','{"host":"thomsonreuters.wd5.myworkdayjobs.com","tenant":"thomsonreuters","site":"External_Career_Site","maxPages":5}'::jsonb,true),
  ('workday','clio-careers','Clio','{"host":"clio.wd3.myworkdayjobs.com","tenant":"clio","site":"ClioCareerSite","maxPages":5}'::jsonb,true),
  ('workday','autodesk-ext','Autodesk','{"host":"autodesk.wd1.myworkdayjobs.com","tenant":"autodesk","site":"Ext","maxPages":5}'::jsonb,true),
  ('workday','workday-careers','Workday','{"host":"workday.wd5.myworkdayjobs.com","tenant":"workday","site":"Workday","maxPages":5}'::jsonb,true)
on conflict(kind, source_key) do update set
  company = excluded.company,
  config = excluded.config,
  enabled = excluded.enabled,
  updated_at = now();

-- Two additional direct ATS feeds for existing target companies.
insert into job_sources(kind, source_key, company, enabled) values
  ('greenhouse','hootsuite','Hootsuite',true),
  ('lever','pointclickcare','PointClickCare',true)
on conflict(kind, source_key) do update set
  company = excluded.company,
  enabled = excluded.enabled;
