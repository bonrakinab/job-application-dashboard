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
    <div className="section-head"><h2>Company groups</h2><span className="small muted">Groups overlap: one company can belong to several.</span></div>
    <div className="company-group-grid">
      {groupSummaries.map((item) => <button type="button" className={`company-group-card ${group === item.id ? 'active' : ''}`} key={item.id} onClick={() => setGroup(group === item.id ? 'all' : item.id)}>
        <b>{item.label}</b>
        <span>{item.description}</span>
        <div className="row small"><strong>{item.count}</strong> companies · {item.live} live · {item.recommended} recommended</div>
      </button>)}
    </div>

    <div className="section-head"><h2>{group === 'all' ? 'All target companies' : COMPANY_GROUPS.find((item) => item.id === group)?.label}</h2><span className="small muted">{visible.length} companies shown</span></div>
    <div className="searchbar company-filterbar">
      <input className="input" placeholder="Search company, sector or group…" value={q} onChange={(event) => setQ(event.target.value)} />
      <select className="select" style={{ maxWidth: 250 }} value={group} onChange={(event) => setGroup(event.target.value)}>
        <option value="all">All groups</option>
        {groupSummaries.map((value) => <option value={value.id} key={value.id}>{value.label} ({value.count})</option>)}
      </select>
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
      {visible.map((company) => {
        const groups = companyGroups(company.company);
        return <div className="card company-card" key={company.company}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="job-title">{company.company}</div>
              <div className="job-company">{company.sector} · Tier {company.priority}</div>
            </div>
            <span className={`pill ${company.jobs > 0 ? 'strong' : ''}`}>{company.jobs > 0 ? `${company.jobs} jobs` : 'watching'}</span>
          </div>
          {groups.length ? <div className="company-group-tags">{groups.map((item) => <button type="button" className="company-group-tag" key={item.id} onClick={() => setGroup(item.id)}>{item.label}</button>)}</div> : null}
          <div className="company-coverage">
            <span><b>{company.recommended}</b> recommended</span>
            <span><b>{company.jobs}</b> imported</span>
          </div>
          <div className="row company-actions">
            {company.careersUrl ? <a className="btn ghost" href={company.careersUrl} target="_blank" rel="noreferrer">Careers ↗</a> : null}
            <a className="btn ghost" href={queryUrl('https://www.linkedin.com/jobs/search/?location=Canada&keywords=', `${company.company} AI data software ERP`)} target="_blank" rel="noreferrer">LinkedIn ↗</a>
            <a className="btn ghost" href={queryUrl('https://ca.indeed.com/jobs?q=', `${company.company} AI data software ERP`)} target="_blank" rel="noreferrer">Indeed ↗</a>
          </div>
        </div>;
      })}
    </div>
    {!visible.length ? <div className="notice">No target companies match these filters.</div> : null}
  </>;
}
