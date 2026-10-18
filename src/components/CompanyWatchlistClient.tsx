'use client';

import { useMemo, useState } from 'react';
import type { CompanyWatch } from '@/lib/types';
import { fortune500Rank } from '@/lib/fortune500';

type CompanyCoverage = CompanyWatch & { jobs: number; recommended: number };

function careersSearchUrl(company: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(`${company} careers Canada official`)}`;
}

export function CompanyWatchlistClient({ companies }: { companies: CompanyCoverage[] }) {
  const [q, setQ] = useState('');
  const [show, setShow] = useState('all');

  const visible = useMemo(() => companies.filter((company) => {
    const text = `${company.company} ${company.sector}`.toLowerCase();
    const queryMatch = !q || text.includes(q.toLowerCase());
    const showMatch = show === 'all'
      || (show === 'jobs' && company.jobs > 0)
      || (show === 'recommended' && company.recommended > 0)
      || (show === 'empty' && company.jobs === 0);
    return queryMatch && showMatch;
  }), [companies, q, show]);

  return <>
    <div className="primary-search">
      <input
        className="input"
        aria-label="Search Fortune 500 companies"
        placeholder="Search company or industry…"
        value={q}
        onChange={(event) => setQ(event.target.value)}
      />
      <select className="select" aria-label="Show companies" value={show} onChange={(event) => setShow(event.target.value)}>
        <option value="all">All 500 companies</option>
        <option value="jobs">Companies with open jobs</option>
        <option value="recommended">Companies with recommended jobs</option>
        <option value="empty">Companies with no jobs yet</option>
      </select>
    </div>

    <div className="result-line">
      <span className="small muted">Showing {visible.length} of 500 Fortune 500 companies</span>
    </div>

    <div className="company-grid">
      {visible.map((company) => {
        const rank = fortune500Rank(company);
        return <div className="card company-card" key={company.company}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="job-title">{company.company}</div>
              <div className="job-company">{company.sector}</div>
              {rank ? <span className="tag">Fortune #{rank}</span> : null}
            </div>
          </div>

          <div className="small muted">
            {company.jobs} open job{company.jobs === 1 ? '' : 's'} · {company.recommended} recommended
          </div>

          <div className="row company-actions">
            {company.jobs > 0
              ? <a className="btn primary" href={`/target-jobs?company=${encodeURIComponent(company.company)}&fit=all`}>All jobs ({company.jobs})</a>
              : <span className="btn ghost" aria-disabled="true">No jobs yet</span>}
            {company.recommended > 0
              ? <a className="btn ghost" href={`/target-jobs?company=${encodeURIComponent(company.company)}&fit=recommended`}>Recommended ({company.recommended})</a>
              : null}
            <a className="btn ghost" href={careersSearchUrl(company.company)} target="_blank" rel="noreferrer">Find careers</a>
          </div>
        </div>;
      })}
    </div>

    {!visible.length ? <div className="notice">No Fortune 500 companies match your search.</div> : null}
  </>;
}
