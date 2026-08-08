insert into company_watchlist(company, sector, careers_url, priority, enabled) values
('Netflix','Technology & media','https://jobs.netflix.com/',2,true),
('Tesla','Automotive & technology','https://www.tesla.com/careers/search/',2,true),
('Walmart','Retail & technology','https://careers.walmart.com/',2,true),
('UnitedHealth Group','Health care & technology','https://careers.unitedhealthgroup.com/',2,true),
('HCLTech','IT services & consulting','https://www.hcltech.com/careers',2,true),
('Tech Mahindra','IT services & consulting','https://careers.techmahindra.com/',2,true)
on conflict (company) do update set
  sector = excluded.sector,
  careers_url = excluded.careers_url,
  priority = excluded.priority,
  enabled = excluded.enabled,
  updated_at = now();
