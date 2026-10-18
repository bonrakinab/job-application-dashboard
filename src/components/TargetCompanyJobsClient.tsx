'use client';

import { useMemo, useState } from 'react';
import type { TargetCompanyOpportunity } from '@/lib/target-company-jobs';
import { StatusPill } from './StatusPill';

const PAGE_SIZE = 100;

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

function rawRecord(item: TargetCompanyOpportunity) {
  return item.job.raw && typeof item.job.raw === 'object'
    ? item.job.raw as Record<string, unknown>
    : undefined;
}

function sourceRecencyDays(item: TargetCompanyOpportunity) {
  const value = rawRecord(item)?.source_recency_days;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function sourcePostedLabel(item: TargetCompanyOpportunity) {
  const value = rawRecord(item)?.source_posted_label;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function fallbackTime(item: TargetCompanyOpportunity) {
  const value = item.job.lastSeenAt ?? item.job.discoveredAt;
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function estimatedRecencyTime(item: TargetCompanyOpportunity) {
  const exact = postedTime(item);
  if (exact !== null) return exact;
  const recencyDays = sourceRecencyDays(item);
  if (recencyDays !== null) {
    const anchor = fallbackTime(item) || Date.now();
    return anchor - recencyDays * 86_400_000;
  }
  return null;
}

function sortNewestFirst(left: TargetCompanyOpportunity, right: TargetCompanyOpportunity) {
  const leftRecent = estimatedRecencyTime(left);
  const rightRecent = estimatedRecencyTime(right);
  if (leftRecent !== null && rightRecent !== null && leftRecent !== rightRecent) return rightRecent - leftRecent;
  if (leftRecent !== null && rightRecent === null) return -1;
  if (leftRecent === null && rightRecent !== null) return 1;
  const discoveredDifference = fallbackTime(right) - fallbackTime(left);
  if (discoveredDifference !== 0) return discoveredDifference;
  return right.priority - left.priority;
}

function dateLabel(item: TargetCompanyOpportunity) {
  if (item.job.postedAt) {
    const date = new Date(item.job.postedAt);
    if (!Number.isNaN(date.getTime())) {
      return `Posted ${date.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}`;
    }
  }
  const sourceLabel = sourcePostedLabel(item);
  return sourceLabel ? `Employer source: ${sourceLabel}` : 'Posting date unavailable';
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
  const [page, setPage] = useState(1);

  const companies = useMemo(() => [...new Set(items.map((item) => item.watchedCompany))].sort(), [items]);
  const recommendedTotal = useMemo(() => items.filter((item) => item.recommended).length, [items]);

  const filtered = useMemo(() => items.filter((item) => {
    const text = `${item.job.title} ${item.watchedCompany} ${item.job.location ?? ''} ${item.family}`.toLowerCase();
    const fitMatch = fit === 'all'
      || (fit === 'recommended' && item.recommended)
      || (fit === 'strong' && item.highlySuitable)
      || (fit === 'eligible' && item.match.blockers.length === 0);
    return (!q || text.includes(q.toLowerCase()))
      && fitMatch
      && (company === 'all' || item.watchedCompany === company);
  }).sort(sortNewestFirst), [company, fit, items, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (!items.length) {
    return <div className="notice">No live Fortune 500 catalog jobs are stored yet. Employer career sources are still being synchronized.</div>;
  }

  const selectedLabel = company === 'all' ? 'Fortune 500' : company;

  return <>
    <div className="primary-search">
      <input
        className="input"
        aria-label="Search Fortune 500 jobs"
        placeholder="Search job title, company, or location…"
        value={q}
        onChange={(event) => { setQ(event.target.value); setPage(1); }}
      />
      <select className="select" aria-label="Show jobs" value={fit} onChange={(event) => { setFit(event.target.value); setPage(1); }}>
        <option value="all">All current openings</option>
        <option value="recommended">Recommended jobs</option>
        <option value="strong">Strong matches only</option>
        <option value="eligible">All eligible jobs</option>
      </select>
      <select className="select" aria-label="Company" value={company} onChange={(event) => { setCompany(event.target.value); setPage(1); }}>
        <option value="all">All Fortune 500 companies</option>
        {companies.map((value) => <option value={value} key={value}>{value}</option>)}
      </select>
    </div>

    <div className="result-line">
      <span className="small muted">
        {filtered.length} matching · {items.length} current openings · {recommendedTotal} recommended · newest employer postings first
      </span>
      {filtered.length > PAGE_SIZE ? <span className="small muted">Page {safePage} of {pageCount}</span> : null}
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

    {filtered.length > PAGE_SIZE ? <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
      <button className="btn ghost" type="button" disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>← Previous</button>
      <span className="small muted">{(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
      <button className="btn ghost" type="button" disabled={safePage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Next →</button>
    </div> : null}

    {!filtered.length ? <div className="notice">No {selectedLabel.toLowerCase()} jobs match this view. Try “All current openings”.</div> : null}
  </>;
}
