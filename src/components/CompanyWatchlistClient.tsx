'use client';

import { useMemo, useState } from 'react';
import type { CompanyWatch } from '@/lib/types';
import { fortune500Rank } from '@/lib/fortune500';

type CompanyCoverage = CompanyWatch & { jobs: number; recommended: number };

function careersSearchUrl(company: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(`${company} careers Canada official`)}`;
}

function scanMetadata(company: CompanyWatch) {
  const value = company.sourceMetadata?.fortune500_scan;
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function checkedAt(company: CompanyWatch) {
  const value = scanMetadata(company)?.last_checked_at;
  return typeof value === 'string' && value ? value : null;
}

function checkedLabel(company: CompanyWatch) {
  const value = checkedAt(company);
  if (!value) return 'Scan pending';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Checked';
  return `Checked ${date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}`;
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
    const wasChecked = Boolean(checkedAt(company));
    const showMatch = show === 'all'
      || (show === 'jobs' && company.jobs > 0)
      || (show === 'recommended' && company.recommended > 0)
      || (show === 'checked-empty' && wasChecked && company.jobs === 0)
      || (show === 'pending' && !wasChecked);
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
        <option value="recommended">Companies with recommended jobs</option>
        <option value="pending">Not checked yet</option>
        <option value="checked-empty">Checked — no Canada openings found</option>
      </select>
    </div>

    <div className="result-line">
      <span className="small muted">Showing {visible.length} of 500 Fortune 500 companies</span>
    </div>

    <div className="company-grid">
      {visible.map((company) => {
        const rank = fortune500Rank(company);
        const wasChecked = Boolean(checkedAt(company));
        const careersUrl = officialCareersUrl(company);
        return <div className="card company-card" key={company.company}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="job-title">{company.company}</div>
              <div className="job-company">{company.sector}</div>
              {rank ? <span className="tag">Fortune #{rank}</span> : null}
            </div>
            <span className={`pill ${wasChecked ? 'strong' : ''}`}>{checkedLabel(company)}</span>
          </div>

          <div className="small muted">
            {company.jobs > 0
              ? `${company.jobs} current opening${company.jobs === 1 ? '' : 's'} · ${company.recommended} recommended`
              : wasChecked
                ? 'No active Ontario/Canada openings found in the latest scan'
                : 'Not scanned yet — zero here does not mean zero company jobs'}
          </div>

          <div className="row company-actions">
            {company.jobs > 0
              ? <a className="btn primary" href={`/target-jobs?company=${encodeURIComponent(company.company)}&fit=all`}>Openings ({company.jobs})</a>
              : null}
            {company.recommended > 0
              ? <a className="btn ghost" href={`/target-jobs?company=${encodeURIComponent(company.company)}&fit=recommended`}>Recommended ({company.recommended})</a>
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
