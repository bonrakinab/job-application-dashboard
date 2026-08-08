'use client';

import { useMemo, useState } from 'react';
import type { CompanyWatch } from '@/lib/types';

type CompanyCoverage = CompanyWatch & { jobs: number; recommended: number };

function queryUrl(base: string, company: string) {
  return `${base}${encodeURIComponent(company)}`;
}

export function CompanyWatchlistClient({ companies }: { companies: CompanyCoverage[] }) {
  const [q, setQ] = useState('');
  const [sector, setSector] = useState('all');
  const [coverage, setCoverage] = useState('all');
  const sectors = useMemo(() => [...new Set(companies.map((company) => company.sector))].sort(), [companies]);
  const visible = useMemo(() => companies.filter((company) => {
    const text = `${company.company} ${company.sector}`.toLowerCase();
    const queryMatch = !q || text.includes(q.toLowerCase());
    const sectorMatch = sector === 'all' || company.sector === sector;
    const coverageMatch = coverage === 'all' || (coverage === 'live' ? company.jobs > 0 : company.jobs === 0);
    return queryMatch && sectorMatch && coverageMatch;
  }), [companies, coverage, q, sector]);

  return <>
    <div className="searchbar">
      <input className="input" placeholder="Search company or sector…" value={q} onChange={(event) => setQ(event.target.value)} />
      <select className="select" style={{ maxWidth: 250 }} value={sector} onChange={(event) => setSector(event.target.value)}>
        <option value="all">All sectors</option>
        {sectors.map((value) => <option value={value} key={value}>{value}</option>)}
      </select>
      <select className="select" style={{ maxWidth: 190 }} value={coverage} onChange={(event) => setCoverage(event.target.value)}>
        <option value="all">All coverage</option>
        <option value="live">Jobs imported</option>
        <option value="watching">Watching only</option>
      </select>
    </div>

    <div className="company-grid">
      {visible.map((company) => <div className="card company-card" key={company.company}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="job-title">{company.company}</div>
            <div className="job-company">{company.sector} · Tier {company.priority}</div>
          </div>
          <span className={`pill ${company.jobs > 0 ? 'strong' : ''}`}>{company.jobs > 0 ? `${company.jobs} jobs` : 'watching'}</span>
        </div>
        <div className="company-coverage">
          <span><b>{company.recommended}</b> recommended</span>
          <span><b>{company.jobs}</b> imported</span>
        </div>
        <div className="row company-actions">
          {company.careersUrl ? <a className="btn ghost" href={company.careersUrl} target="_blank" rel="noreferrer">Careers ↗</a> : null}
          <a className="btn ghost" href={queryUrl('https://www.linkedin.com/jobs/search/?location=Canada&keywords=', `${company.company} AI data software ERP`)} target="_blank" rel="noreferrer">LinkedIn ↗</a>
          <a className="btn ghost" href={queryUrl('https://ca.indeed.com/jobs?q=', `${company.company} AI data software ERP`)} target="_blank" rel="noreferrer">Indeed ↗</a>
        </div>
      </div>)}
    </div>
    {!visible.length ? <div className="notice">No target companies match these filters.</div> : null}
  </>;
}
