-- Expand daily target-company discovery using public ATS boards only.
-- These are employer-facing/public job boards; no authenticated job-portal scraping is used.

insert into job_sources(kind, source_key, company, enabled) values
  ('ashby','openai','OpenAI',true),
  ('ashby','1password','1Password',true),
  ('ashby','wealthsimple','Wealthsimple',true),
  ('greenhouse','anthropic','Anthropic',true),
  ('greenhouse','reddit','Reddit',true),
  ('greenhouse','mongodb','MongoDB',true),
  ('greenhouse','cloudflare','Cloudflare',true),
  ('greenhouse','databricks','Databricks',true),
  ('greenhouse','faire','Faire',true),
  ('greenhouse','doordashcanada','DoorDash',true),
  ('lever','benchsci','BenchSci',true)
on conflict(kind, source_key) do update set
  company = excluded.company,
  enabled = excluded.enabled;

-- Wealthsimple currently publishes its board through Ashby; avoid duplicate polling.
update job_sources
set enabled = false
where kind = 'lever' and source_key = 'wealthsimple';
