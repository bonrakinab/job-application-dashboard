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

function normalizeFit(value: string) {
  if (value === 'best') return 'recommended';
  if (value === 'high') return 'strong';
  return ['recommended', 'strong', 'eligible', 'all'].includes(value) ? value : 'all';
}

function postedTime(item: TargetCompanyOpportunity) {
  const value = item.job.postedAt;
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function fallbackTime(item: TargetCompanyOpportunity) {
  const value = item.job.discoveredAt ?? item.job.lastSeenAt;
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function sortNewestFirst(left: TargetCompanyOpportunity, right: TargetCompanyOpportunity) {
  const leftPosted = postedTime(left);
  const rightPosted = postedTime(right);
  if (leftPosted !== null && rightPosted !== null && leftPosted !== rightPosted) return rightPosted - leftPosted;
  if (leftPosted !== null && rightPosted === null) return -1;
  if (leftPosted === null && rightPosted !== null) return 1;
  const discoveredDifference = fallbackTime(right) - fallbackTime(left);
  if (discoveredDifference !== 0) return discoveredDifference;
  return right.priority - left.priority;
}

function dateLabel(item: TargetCompanyOpportunity) {
  if (!item.job.postedAt) return 'Posting date unavailable';
  const date = new Date(item.job.postedAt);
  if (Number.isNaN(date.getTime())) return 'Posting date unavailable';
  return `Posted ${date.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}`;
}

export function TargetCompanyJobsClient({
  items,
  initialCompany = 'all',
  initialFit = 'all',
}: {
  items: TargetCompanyOpportunity[];
  initialCompany?: string;
  initialFit?: string;
}) {
  const [q, setQ] = useState('');
  const [fit, setFit] = useState(normalizeFit(initialFit));
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
  }).sort(sortNewestFirst), [company, fit, items, q]);

  if (!items.length) {
    return <div className="notice">No open Fortune 500 jobs are currently stored. The Fortune 500 sweep is checking employer career sources and will add active Ontario/Canada openings.</div>;
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
        <option value="all">All current openings</option>
        <option value="recommended">Recommended jobs</option>
        <option value="strong">Strong matches only</option>
        <option value="eligible">All eligible jobs</option>
      </select>
      <select className="select" aria-label="Company" value={company} onChange={(event) => setCompany(event.target.value)}>
        <option value="all">All Fortune 500 companies</option>
        {companies.map((value) => <option value={value} key={value}>{value}</option>)}
      </select>
    </div>

    <div className="result-line">
      <span className="small muted">
        Showing {visible.length} · {items.length} current openings · {recommendedTotal} recommended · newest verified postings first
      </span>
    </div>

    <div className="recommendation-grid simple-job-cards">
      {visible.map((item) => <article className="card simple-job-card" key={item.job.id}>
        <div>
          <h3>{item.job.title}</h3>
          <div className="simple-job-meta">{item.watchedCompany} · {item.job.location || 'Location not listed'} · {stageLabel(item.stage)}</div>
          <div className="small muted">{dateLabel(item)}</div>
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

    {!visible.length ? <div className="notice">No {selectedLabel.toLowerCase()} jobs match this view. Try “All current openings”.</div> : null}
  </>;
}
