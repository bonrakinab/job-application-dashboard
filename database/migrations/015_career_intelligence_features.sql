-- Persistent data for answer bank, saved search profiles and optional outbound automation hooks.

create table if not exists answer_bank (
  id bigserial primary key,
  question text not null,
  answer text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists answer_bank_question_unique_idx on answer_bank (lower(question));

create table if not exists search_profiles (
  id text primary key,
  name text not null,
  description text not null default '',
  target_titles text[] not null default '{}',
  include_keywords text[] not null default '{}',
  min_match integer not null default 65 check (min_match between 0 and 100),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into search_profiles(id, name, description, target_titles, include_keywords, min_match, enabled) values
  ('ai-ml', 'AI & ML', 'AI, machine learning, data science and MLOps roles.', array['AI Engineer','Machine Learning Engineer','Data Scientist','MLOps Engineer','Junior Machine Learning Engineer','AI Intern','Machine Learning Intern','Data Science Intern'], array['machine learning','artificial intelligence','ml','ai','data science','mlops'], 65, true),
  ('data-analytics', 'Data & Analytics', 'Data analyst, BI and analytics roles.', array['Data Analyst','BI Analyst','Business Analyst','Junior Data Analyst','New Grad Data Analyst','Data Analyst Intern'], array['data analyst','business intelligence','analytics','power bi','tableau','sql'], 65, true),
  ('software', 'Software Engineering', 'Software engineering and application development roles.', array['Software Engineer','Junior Software Engineer','New Grad Software Engineer','Software Engineer Intern','Software Developer Intern'], array['software engineer','software developer','full stack','backend','frontend','application developer'], 65, true),
  ('it-cloud', 'IT, Cloud & Systems', 'IT systems, cloud, application support and solutions roles.', array['IT Systems Analyst','IT Analyst','Application Support Analyst','Solutions Engineer','Cloud Intern','Technical Consultant','IT Intern'], array['it systems','cloud','application support','solutions engineer','technical consultant','systems analyst'], 65, true),
  ('erp-enterprise', 'ERP & Enterprise Applications', 'Oracle Fusion, Oracle Cloud ERP, enterprise applications and ERP implementation roles.', array['Enterprise Applications Engineer','Enterprise Applications Analyst','ERP Analyst','ERP Systems Analyst','ERP Application Analyst','ERP Consultant','ERP Implementation Consultant','Oracle Fusion Analyst','Oracle Fusion Consultant','Oracle ERP Analyst','Oracle ERP Consultant','Oracle Cloud ERP Consultant','Oracle Applications Analyst','Oracle Financials Analyst','Oracle Financials Consultant','Oracle Procurement Analyst','Functional Analyst','ERP Intern'], array['oracle fusion','oracle erp','oracle cloud erp','oracle financials','oracle procurement','enterprise applications','erp'], 60, true),
  ('automation-solutions', 'Automation & Solutions', 'Workflow automation, integrations, technical consulting and solutions engineering roles.', array['AI Solutions Engineer','Solutions Engineer','Technical Consultant','Business Systems Analyst'], array['automation','workflow','integration','api','webhook','n8n','solutions engineer'], 65, true)
on conflict (id) do nothing;

create table if not exists webhook_integrations (
  id bigserial primary key,
  name text not null,
  kind text not null default 'n8n' check (kind in ('n8n','webhook')),
  webhook_url text not null,
  secret text,
  events text[] not null default array['job.match.updated','application.status.changed'],
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table answer_bank enable row level security;
alter table search_profiles enable row level security;
alter table webhook_integrations enable row level security;
