set lock_timeout = '3s';
set statement_timeout = '120s';
create index if not exists jobs_customer_service_inventory_idx on public.jobs (discovered_at desc, id) where (title ilike '%customer%service%' or title ilike '%customer%care%' or title ilike '%customer%support%' or title ilike '%customer%experience%' or title ilike '%customer%associate%' or title ilike '%customer%representative%' or title ilike '%customer%relations%' or title ilike '%customer%success%' or title ilike '%client%service%' or title ilike '%client%services%' or title ilike '%client%care%' or title ilike '%client%support%' or title ilike '%client%experience%' or title ilike '%contact%centre%' or title ilike '%contact%center%' or title ilike '%call%centre%' or title ilike '%call%center%' or title ilike '%member%service%' or title ilike '%member%services%' or title ilike '%guest%service%' or title ilike '%guest%services%' or title ilike '%csr%') and (location ilike '%Ontario%'
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
