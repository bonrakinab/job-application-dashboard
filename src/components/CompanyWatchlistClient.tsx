'use client';

import { useMemo, useState } from 'react';
import type { CompanyWatch } from '@/lib/types';
import { fortune500Rank } from '@/lib/fortune500';

type SourceCoverage = {
  totalSources: number;
  completedSources: number;
  errorSources: number;
  pendingSources: number;
  lastCheckedAt?: string;
};

type CompanyCoverage = CompanyWatch & { jobs: number; sourceCoverage?: SourceCoverage };

function careersSearchUrl(company: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(`${company} official careers jobs`)}`;
}

function sourceState(company: CompanyCoverage) {
  const coverage = company.sourceCoverage;
  if (!coverage || coverage.totalSources === 0) return 'unmapped';
  if (coverage.completedSources === coverage.totalSources) return 'synced';
  if (coverage.completedSources > 0) return 'partial';
  if (coverage.errorSources > 0) return 'error';
  return 'pending';
}

function sourceLabel(company: CompanyCoverage) {
  const coverage = company.sourceCoverage;
  const state = sourceState(company);
  if (state === 'unmapped') return 'Source mapping pending';
  if (state === 'synced') return coverage?.lastCheckedAt ? 'Live sources synced' : 'Synced';
  if (state === 'partial') return `${coverage?.completedSources ?? 0}/${coverage?.totalSources ?? 0} sources synced`;
  if (state === 'error') return 'Source needs retry';
  return 'Source sync pending';
}

function officialCareersUrl(company: CompanyWatch) {
  if (!company.careersUrl) return null;
  try {
    const url = new URL(company.careersUrl);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function CompanyWatchlistClient({ companies }: { companies: CompanyCoverage[] }) {
  const [q, setQ] = useState('');
  const [show, setShow] = useState('all');

  const visible = useMemo(() => companies.filter((company) => {
    const text = `${company.company} ${company.sector}`.toLowerCase();
    const queryMatch = !q || text.includes(q.toLowerCase());
    const state = sourceState(company);
    const showMatch = show === 'all'
      || (show === 'jobs' && company.jobs > 0)
      || (show === 'synced' && state === 'synced')
      || (show === 'incomplete' && ['pending', 'partial', 'error'].includes(state))
      || (show === 'unmapped' && state === 'unmapped');
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
        <option value="jobs">Companies with current openings</option>
        <option value="synced">All mapped sources synced</option>
        <option value="incomplete">Source sync incomplete</option>
        <option value="unmapped">Source mapping pending</option>
      </select>
    </div>

    <div className="result-line">
      <span className="small muted">Showing {visible.length} of 500 Fortune 500 companies</span>
    </div>

    <div className="company-grid">
      {visible.map((company) => {
        const rank = fortune500Rank(company);
        const state = sourceState(company);
        const careersUrl = officialCareersUrl(company);
        return <div className="card company-card" key={company.company}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="job-title">{company.company}</div>
              <div className="job-company">{company.sector}</div>
              {rank ? <span className="tag">Fortune #{rank}</span> : null}
            </div>
            <span className={`pill ${state === 'synced' ? 'strong' : ''}`}>{sourceLabel(company)}</span>
          </div>

          <div className="small muted">
            {company.jobs > 0
              ? `${company.jobs.toLocaleString()} current opening${company.jobs === 1 ? '' : 's'}`
              : state === 'synced'
                ? 'No current openings returned by the mapped live source(s)'
                : state === 'unmapped'
                  ? 'Source mapping is still pending — zero is not definitive'
                  : 'Source sync is incomplete — zero is not definitive'}
          </div>

          <div className="row company-actions">
            {company.jobs > 0
              ? <a className="btn primary" href={`/target-jobs?company=${encodeURIComponent(company.company)}`}>Openings ({company.jobs.toLocaleString()})</a>
              : null}
            <a
              className="btn ghost"
              href={careersUrl ?? careersSearchUrl(company.company)}
              target="_blank"
              rel="noreferrer"
            >{careersUrl ? 'Official careers' : 'Find careers'}</a>
          </div>
        </div>;
      })}
    </div>

    {!visible.length ? <div className="notice">No Fortune 500 companies match your search.</div> : null}
  </>;
}
