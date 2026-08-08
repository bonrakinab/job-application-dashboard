'use client';

import { useMemo, useState } from 'react';
import type { RecommendedOpportunity } from '@/lib/recommendations';
import { StatusPill } from './StatusPill';

function stageLabel(stage: RecommendedOpportunity['stage']) {
  if (stage === 'new-grad') return 'New grad';
  if (stage === 'entry-level') return 'Entry level';
  if (stage === 'internship') return 'Internship';
  return 'Experienced';
}

export function RecommendedJobsClient({ items }: { items: RecommendedOpportunity[] }) {
  const [q, setQ] = useState('');
  const [stage, setStage] = useState('all');
  const [source, setSource] = useState('all');

  const sources = useMemo(() => [...new Set(items.map((item) => item.job.source))].sort(), [items]);
  const visible = useMemo(() => items.filter((item) => {
    const text = `${item.job.title} ${item.job.company} ${item.job.location ?? ''} ${item.family}`.toLowerCase();
    return (!q || text.includes(q.toLowerCase()))
      && (stage === 'all' || item.stage === stage)
      && (source === 'all' || item.job.source === source);
  }), [items, q, stage, source]);

  if (!items.length) return <div className="notice">No recommendation currently clears the fit and eligibility thresholds. The all-jobs dashboard still contains every discovered role.</div>;

  return <>
    <div className="searchbar recommendation-filters">
      <input className="input" placeholder="Search recommended jobs…" value={q} onChange={(event) => setQ(event.target.value)} />
      <select className="select" value={stage} onChange={(event) => setStage(event.target.value)}>
        <option value="all">All career stages</option>
        <option value="internship">Internships</option>
        <option value="new-grad">New grad</option>
        <option value="entry-level">Entry level</option>
        <option value="experienced">Experienced</option>
      </select>
      <select className="select" value={source} onChange={(event) => setSource(event.target.value)}>
        <option value="all">All sources</option>
        {sources.map((value) => <option value={value} key={value}>{value}</option>)}
      </select>
    </div>

    <div className="recommendation-grid">
      {visible.map((item) => <article className="card recommendation-card" key={item.job.id}>
        <div className="row recommendation-card-head">
          <div>
            <div className="kicker">{item.family}</div>
            <h3>{item.job.title}</h3>
            <div className="job-company">{item.job.company} · {item.job.source}</div>
          </div>
          <div className="recommendation-score">
            <span className="small muted">Priority</span>
            <b>{item.priority}</b>
          </div>
        </div>

        <div className="tag-list recommendation-tags">
          {item.highlySuitable ? <span className="tag">Highly suitable</span> : null}
          <span className="tag">{stageLabel(item.stage)}</span>
          <StatusPill value={item.match.recommendation} />
          {item.job.location ? <span className="tag">{item.job.location}</span> : null}
        </div>

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
  </>;
}
