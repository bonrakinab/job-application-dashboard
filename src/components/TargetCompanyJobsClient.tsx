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

export function TargetCompanyJobsClient({ items }: { items: TargetCompanyOpportunity[] }) {
  const [q, setQ] = useState('');
  const [fit, setFit] = useState('best');
  const [stage, setStage] = useState('all');
  const [group, setGroup] = useState('all');
  const [company, setCompany] = useState('all');
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

  return <>
    <div className="searchbar recommendation-filters">
      <input className="input" placeholder="Search target-company jobs…" value={q} onChange={(event) => setQ(event.target.value)} />
      <select className="select" value={fit} onChange={(event) => setFit(event.target.value)}>
        <option value="best">Best profile matches</option>
        <option value="high">Highly suitable only</option>
        <option value="eligible">All eligible</option>
        <option value="all">All target-company jobs</option>
      </select>
      <select className="select" value={stage} onChange={(event) => setStage(event.target.value)}>
        <option value="all">All career stages</option>
        <option value="internship">Internships</option>
        <option value="new-grad">New grad</option>
        <option value="entry-level">Entry level</option>
        <option value="experienced">Experienced</option>
      </select>
      <select className="select" value={group} onChange={(event) => setGroup(event.target.value)}>
        <option value="all">All company groups</option>
        {groups.map(([id, label]) => <option value={id} key={id}>{label}</option>)}
      </select>
      <select className="select" value={company} onChange={(event) => setCompany(event.target.value)}>
        <option value="all">All target companies</option>
        {companies.map((value) => <option value={value} key={value}>{value}</option>)}
      </select>
      <select className="select" value={source} onChange={(event) => setSource(event.target.value)}>
        <option value="all">All sources</option>
        {sources.map((value) => <option value={value} key={value}>{value}</option>)}
      </select>
    </div>

    <div className="section-head"><h2>{visible.length} jobs shown</h2><span className="small muted">Sorted by profile fit first, then recency.</span></div>
    <div className="recommendation-grid">
      {visible.map((item) => <article className="card recommendation-card" key={item.job.id}>
        <div className="row recommendation-card-head">
          <div>
            <div className="kicker">{item.family === 'Other' ? item.sector : item.family}</div>
            <h3>{item.job.title}</h3>
            <div className="job-company">{item.watchedCompany} · {item.job.source}</div>
          </div>
          <div className="recommendation-score">
            <span className="small muted">Priority</span>
            <b>{item.priority}</b>
          </div>
        </div>

        <div className="tag-list recommendation-tags">
          <span className="tag">Target company</span>
          {item.highlySuitable ? <span className="tag">Highly suitable</span> : item.recommended ? <span className="tag">Recommended</span> : null}
          <span className="tag">{stageLabel(item.stage)}</span>
          <StatusPill value={item.match.recommendation} />
          {item.job.location ? <span className="tag">{item.job.location}</span> : null}
        </div>

        {item.groups.length ? <div className="company-group-tags">{item.groups.slice(0, 4).map((candidate) => <span className="company-group-tag" key={candidate.id}>{candidate.label}</span>)}</div> : null}

        <div className="recommendation-reasons">
          {item.reasons.map((reason) => <div className="small" key={reason}>• {reason}</div>)}
        </div>

        <div className="row recommendation-actions">
          <a className="btn primary" href={`/jobs/${item.job.id}`}>Review & prepare →</a>
          <a className="btn ghost" href={item.job.applyUrl || item.job.url} target="_blank" rel="noreferrer">Open listing ↗</a>
          <span className="small muted">Match {item.match.overall}/100</span>
        </div>
      </article>)}
    </div>
    {!visible.length ? <div className="notice">No target-company jobs match these filters. Try “All target-company jobs” or another company group.</div> : null}
  </>;
}
