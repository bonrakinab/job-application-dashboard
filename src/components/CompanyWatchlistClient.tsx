'use client';

import { useMemo, useState } from 'react';
import type { CompanyWatch } from '@/lib/types';
import { COMPANY_GROUPS, companyGroups } from '@/lib/company-groups';

type CompanyCoverage = CompanyWatch & { jobs: number; recommended: number };

function queryUrl(base: string, company: string) {
  return `${base}${encodeURIComponent(company)}`;
}

export function CompanyWatchlistClient({ companies }: { companies: CompanyCoverage[] }) {
  const [q, setQ] = useState('');
  const [sector, setSector] = useState('all');
  const [coverage, setCoverage] = useState('all');
  const [group, setGroup] = useState('all');
  const sectors = useMemo(() => [...new Set(companies.map((company) => company.sector))].sort(), [companies]);

  const groupSummaries = useMemo(() => COMPANY_GROUPS.map((definition) => {
    const members = companies.filter((company) => companyGroups(company.company).some((candidate) => candidate.id === definition.id));
    return {
      ...definition,
      count: members.length,
      live: members.filter((company) => company.jobs > 0).length,
      recommended: members.reduce((sum, company) => sum + company.recommended, 0),
    };
  }).filter((definition) => definition.count > 0), [companies]);

  const visible = useMemo(() => companies.filter((company) => {
    const groups = companyGroups(company.company);
    const text = `${company.company} ${company.sector} ${groups.map((item) => item.label).join(' ')}`.toLowerCase();
    const queryMatch = !q || text.includes(q.toLowerCase());
    const sectorMatch = sector === 'all' || company.sector === sector;
    const coverageMatch = coverage === 'all' || (coverage === 'live' ? company.jobs > 0 : company.jobs === 0);
    const groupMatch = group === 'all' || groups.some((item) => item.id === group);
    return queryMatch && sectorMatch && coverageMatch && groupMatch;
  }), [companies, coverage, group, q, sector]);

  return <>
    <input className="input" aria-label="Search companies" placeholder="Search companies…" value={q} onChange={(event) => setQ(event.target.value)} />
    <details className="filter-panel">
      <summary>Filters</summary>
      <div className="filter-panel-body searchbar company-filterbar">
        <select className="select" aria-label="Company group" value={group} onChange={(event) => setGroup(event.target.value)}>
          <option value="all">All groups</option>
          {groupSummaries.map((value) => <option value={value.id} key={value.id}>{value.label} ({value.count})</option>)}
        </select>
        <select className="select" aria-label="Sector" value={sector} onChange={(event) => setSector(event.target.value)}>
          <option value="all">All sectors</option>
          {sectors.map((value) => <option value={value} key={value}>{value}</option>)}
        </select>
        <select className="select" aria-label="Job coverage" value={coverage} onChange={(event) => setCoverage(event.target.value)}>
          <option value="all">All companies</option>
          <option value="live">Companies with jobs</option>
          <option value="watching">No current jobs</option>
        </select>
      </div>
    </details>

    <div className="result-line"><span className="small muted">{visible.length} compan{visible.length === 1 ? 'y' : 'ies'}</span></div>

    <div className="company-grid">
      {visible.map((company) => {
        return <div className="card company-card" key={company.company}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="job-title">{company.company}</div>
              <div className="job-company">{company.sector}</div>
            </div>
            <span className={`pill ${company.jobs > 0 ? 'strong' : ''}`}>{company.jobs > 0 ? `${company.jobs} jobs` : 'watching'}</span>
          </div>
          {company.recommended ? <div className="small muted">{company.recommended} recommended job{company.recommended === 1 ? '' : 's'}</div> : <div className="small muted">Watching for new jobs</div>}
          <div className="row company-actions">
            <a className={company.jobs > 0 ? 'btn primary' : 'btn ghost'} href={`/target-jobs?company=${encodeURIComponent(company.company)}`}>Jobs</a>
            {company.careersUrl ? <a className="btn ghost" href={company.careersUrl} target="_blank" rel="noreferrer">Careers</a> : null}
            <a className="btn ghost" href={queryUrl('https://www.linkedin.com/jobs/search/?location=Canada&keywords=', company.company)} target="_blank" rel="noreferrer">LinkedIn</a>
          </div>
        </div>;
      })}
    </div>
    {!visible.length ? <div className="notice">No target companies match these filters.</div> : null}
  </>;
}
