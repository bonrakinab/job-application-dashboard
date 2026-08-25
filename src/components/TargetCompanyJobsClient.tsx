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
  initialGroup = 'all',
  initialCompany = 'all',
}: {
  items: TargetCompanyOpportunity[];
  initialGroup?: string;
  initialCompany?: string;
}) {
  const [q, setQ] = useState('');
  const [fit, setFit] = useState('best');
  const [stage, setStage] = useState('all');
  const [group, setGroup] = useState(initialGroup || 'all');
  const [company, setCompany] = useState(initialCompany || 'all');
  const [source, setSource] = useState('all');

  const companies = useMemo(() => [...new Set(items.map((item) => item.watchedCompany))].sort(), [items]);
  const sources = useMemo(() => [...new Set(items.map((item) => item.job.source))].sort(), [items]);
  const groups = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((item) => item.groups.forEach((candidate) => map.set(candidate.id, candidate.label)));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  const visible = useMemo(() => items.filter((item) => {
    const text = `${item.job.title} ${item.watchedCompany} ${item.job.location ?? ''} ${item.family} ${item.sector} ${item.groups.map((candidate) => candidate.label).join(' ')}`.toLowerCase();
    const fitMatch = fit === 'all'
      || (fit === 'best' && item.recommended)
      || (fit === 'high' && item.highlySuitable)
      || (fit === 'eligible' && item.match.blockers.length === 0);
    return (!q || text.includes(q.toLowerCase()))
      && fitMatch
      && (stage === 'all' || item.stage === stage)
      && (group === 'all' || item.groups.some((candidate) => candidate.id === group))
      && (company === 'all' || item.watchedCompany === company)
      && (source === 'all' || item.job.source === source);
  }), [company, fit, group, items, q, source, stage]);

  if (!items.length) return <div className="notice">No imported jobs currently belong to a watched target employer. The company watchlist remains active and the daily discovery workers will populate this page as safe feeds return matching jobs.</div>;

  const selectedGroupLabel = groups.find(([id]) => id === group)?.[1];
  const selectedLabel = company !== 'all'
    ? company
    : selectedGroupLabel
      ? selectedGroupLabel
      : 'Target-company';

  return <>
    <div className="primary-search">
      <input className="input" placeholder="Search target-company jobs…" value={q} onChange={(event) => setQ(event.target.value)} />
      <select className="select" value={fit} onChange={(event) => setFit(event.target.value)}>
        <option value="best">Best matches</option>
        <option value="high">Strong matches</option>
        <option value="eligible">Eligible jobs</option>
        <option value="all">All jobs</option>
      </select>
    </div>

    <details className="filter-panel">
      <summary>Filters</summary>
      <div className="filter-panel-body searchbar recommendation-filters">
        <select className="select" aria-label="Career stage" value={stage} onChange={(event) => setStage(event.target.value)}>
          <option value="all">All career stages</option>
          <option value="internship">Internships</option>
          <option value="new-grad">New grad</option>
          <option value="entry-level">Entry level</option>
          <option value="experienced">Experienced</option>
        </select>
        <select className="select" aria-label="Company group" value={group} onChange={(event) => setGroup(event.target.value)}>
          <option value="all">All company groups</option>
          {groups.map(([id, label]) => <option value={id} key={id}>{label}</option>)}
        </select>
        <select className="select" aria-label="Company" value={company} onChange={(event) => setCompany(event.target.value)}>
          <option value="all">All target companies</option>
          {companies.map((value) => <option value={value} key={value}>{value}</option>)}
        </select>
        <select className="select" aria-label="Source" value={source} onChange={(event) => setSource(event.target.value)}>
          <option value="all">All sources</option>
          {sources.map((value) => <option value={value} key={value}>{value}</option>)}
        </select>
      </div>
    </details>

    <div className="result-line"><span className="small muted">{visible.length} {selectedLabel.toLowerCase()} job{visible.length === 1 ? '' : 's'}</span></div>
    <div className="recommendation-grid simple-job-cards">
      {visible.map((item) => <article className="card simple-job-card" key={item.job.id}>
        <div>
          <h3>{item.job.title}</h3>
          <div className="simple-job-meta">{item.watchedCompany} · {item.job.location || 'Location not listed'} · {stageLabel(item.stage)}</div>
          <div className="tag-list">
            <StatusPill value={item.match.recommendation} />
            {item.highlySuitable ? <span className="tag">Strong fit</span> : null}
            {item.groups[0] ? <span className="tag">{item.groups[0].label}</span> : null}
          </div>
        </div>
        <div className="simple-job-score">
          <b>{item.match.overall}</b>
          <span>match</span>
        </div>
        <div className="row recommendation-actions">
          <span className="small muted">{item.reasons[0] || 'Review this role against your profile.'}</span>
          <a className="btn primary" href={`/jobs/${item.job.id}`}>View job</a>
        </div>
      </article>)}
    </div>
    {!visible.length ? <div className="notice">No {selectedLabel.toLowerCase()} jobs match these filters.</div> : null}
  </>;
}
