'use client';

import { useMemo, useState } from 'react';
import type { TargetCompanyOpportunity } from '@/lib/target-company-jobs';
import { StatusPill } from './StatusPill';

function stageLabel(stage: TargetCompanyOpportunity['stage']) {
  if (stage === 'new-grad') return 'New grad';
  if (stage === 'entry-level') return 'Entry level';
  if (stage === 'internship') return 'Internship';
  return 'Experienced';
}

export function TargetCompanyJobsClient({
  items,
  initialCompany = 'all',
  initialFit = 'recommended',
}: {
  items: TargetCompanyOpportunity[];
  initialCompany?: string;
  initialFit?: string;
}) {
  const [q, setQ] = useState('');
  const [fit, setFit] = useState(initialFit || 'recommended');
  const [company, setCompany] = useState(initialCompany || 'all');

  const companies = useMemo(() => [...new Set(items.map((item) => item.watchedCompany))].sort(), [items]);
  const recommendedTotal = useMemo(() => items.filter((item) => item.recommended).length, [items]);

  const visible = useMemo(() => items.filter((item) => {
    const text = `${item.job.title} ${item.watchedCompany} ${item.job.location ?? ''} ${item.family}`.toLowerCase();
    const fitMatch = fit === 'all'
      || (fit === 'recommended' && item.recommended)
      || (fit === 'strong' && item.highlySuitable)
      || (fit === 'eligible' && item.match.blockers.length === 0);
    return (!q || text.includes(q.toLowerCase()))
      && fitMatch
      && (company === 'all' || item.watchedCompany === company);
  }), [company, fit, items, q]);

  if (!items.length) {
    return <div className="notice">No open Fortune 500 jobs are currently stored. The discovery workers will add jobs here as they find active Ontario/Canada opportunities.</div>;
  }

  const selectedLabel = company === 'all' ? 'Fortune 500' : company;

  return <>
    <div className="primary-search">
      <input
        className="input"
        aria-label="Search Fortune 500 jobs"
        placeholder="Search job title, company, or location…"
        value={q}
        onChange={(event) => setQ(event.target.value)}
      />
      <select className="select" aria-label="Show jobs" value={fit} onChange={(event) => setFit(event.target.value)}>
        <option value="recommended">Recommended jobs</option>
        <option value="strong">Strong matches only</option>
        <option value="eligible">All eligible jobs</option>
        <option value="all">All open jobs</option>
      </select>
      <select className="select" aria-label="Company" value={company} onChange={(event) => setCompany(event.target.value)}>
        <option value="all">All Fortune 500 companies</option>
        {companies.map((value) => <option value={value} key={value}>{value}</option>)}
      </select>
    </div>

    <div className="result-line">
      <span className="small muted">
        Showing {visible.length} · {items.length} open total · {recommendedTotal} recommended
      </span>
    </div>

    <div className="recommendation-grid simple-job-cards">
      {visible.map((item) => <article className="card simple-job-card" key={item.job.id}>
        <div>
          <h3>{item.job.title}</h3>
          <div className="simple-job-meta">{item.watchedCompany} · {item.job.location || 'Location not listed'} · {stageLabel(item.stage)}</div>
          <div className="tag-list">
            <StatusPill value={item.match.recommendation} />
            {item.highlySuitable ? <span className="tag">Strong fit</span> : null}
          </div>
        </div>
        <div className="simple-job-score">
          <b>{item.match.overall}</b>
          <span>match</span>
        </div>
        <div className="row recommendation-actions">
          <span className="small muted">{item.reasons[1] || item.reasons[0] || 'Review this role against your profile.'}</span>
          <a className="btn primary" href={`/jobs/${item.job.id}`}>View details</a>
        </div>
      </article>)}
    </div>

    {!visible.length ? <div className="notice">No {selectedLabel.toLowerCase()} jobs match this view. Try “All open jobs”.</div> : null}
  </>;
}
