-- Matches the location predicate in customerServiceQuery. No access policy changes.
set lock_timeout = '3s';
set statement_timeout = '120s';
create index if not exists jobs_ontario_inventory_idx
  on public.jobs (discovered_at desc, id)
  where (location ilike '%Ontario%'
  or location ilike '%Canada%'
  or location ilike '%Worldwide%'
  or location ilike '%Global%'
  or location ilike '%North America%'
  or location ilike '%Americas%'
  or location ilike '%Anywhere in the World%'
  or location ilike '% ON'
  or location ilike '% ON %'
  or location ilike '% ON,%'
  or location ilike 'ON-%');
