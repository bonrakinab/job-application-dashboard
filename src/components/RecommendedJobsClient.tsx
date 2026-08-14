'use client';

import { useMemo, useState } from 'react';
import type { JobValidityStatus, SearchProfile } from '@/lib/types';
import type { RecommendedOpportunity } from '@/lib/recommendations';
import { jobMatchesType, jobTypeLabels, type JobTypeFilter } from '@/lib/job-type';
import { StatusPill } from './StatusPill';

function stageLabel(stage: RecommendedOpportunity['stage']) {
  if (stage === 'new-grad') return 'New grad';
  if (stage === 'entry-level') return 'Entry level';
  if (stage === 'internship') return 'Internship';
  return 'Experienced';
}

function healthLabel(status?: JobValidityStatus) {
  if (status === 'active') return 'Verified active';
  if (status === 'likely_active') return 'Likely active';
  return 'Unverified';
}

export function RecommendedJobsClient({
  items,
  searchProfiles = [],
  selectedProfileId,
}: {
  items: RecommendedOpportunity[];
  searchProfiles?: SearchProfile[];
  selectedProfileId?: string;
}) {
  const [q, setQ] = useState('');
  const [stage, setStage] = useState('all');
  const [jobType, setJobType] = useState<JobTypeFilter>('all');
  const [source, setSource] = useState('all');
  const [selected, setSelected] = useState<string[]>([]);

  const sources = useMemo(() => [...new Set(items.map((item) => item.job.source))].sort(), [items]);
  const visible = useMemo(() => items.filter((item) => {
    const text = `${item.job.title} ${item.job.company} ${item.job.location ?? ''} ${item.family}`.toLowerCase();
    return (!q || text.includes(q.toLowerCase()))
      && (stage === 'all' || item.stage === stage)
      && jobMatchesType(item.job, jobType)
      && (source === 'all' || item.job.source === source);
  }), [items, q, stage, jobType, source]);

  function toggle(id?: string) {
    if (!id) return;
    setSelected((current) => {
      if (current.includes(id)) return current.filter((value) => value !== id);
      if (current.length >= 5) return current;
      return [...current, id];
    });
  }

  function changeSearchProfile(value: string) {
    window.location.href = value === 'all' ? '/recommended' : `/recommended?profile=${encodeURIComponent(value)}`;
  }

  if (!items.length) return <div className="notice">No recommendation currently clears the fit, eligibility and posting-health thresholds for this search profile. The all-jobs dashboard still contains every discovered role.</div>;

  return <>
    <div className="searchbar recommendation-filters">
      <input className="input" placeholder="Search recommended jobs…" value={q} onChange={(event) => setQ(event.target.value)} />
      {searchProfiles.length ? <select className="select" value={selectedProfileId ?? 'all'} onChange={(event) => changeSearchProfile(event.target.value)}>
        <option value="all">All target roles</option>
        {searchProfiles.filter((profile) => profile.enabled).map((profile) => <option value={profile.id} key={profile.id}>{profile.name}</option>)}
      </select> : null}
      <select className="select" value={stage} onChange={(event) => setStage(event.target.value)}>
        <option value="all">All career stages</option>
        <option value="internship">Internships</option>
        <option value="new-grad">New grad</option>
        <option value="entry-level">Entry level</option>
        <option value="experienced">Experienced</option>
      </select>
      <select className="select" aria-label="Job type" value={jobType} onChange={(event) => setJobType(event.target.value as JobTypeFilter)}>
        <option value="all">All job types</option>
        <option value="full-time">Full-time</option>
        <option value="part-time">Part-time</option>
        <option value="contract">Contract / contractual</option>
        <option value="remote">Remote</option>
        <option value="hybrid">Hybrid</option>
        <option value="on-site">On-site / non-remote</option>
      </select>
      <select className="select" value={source} onChange={(event) => setSource(event.target.value)}>
        <option value="all">All sources</option>
        {sources.map((value) => <option value={value} key={value}>{value}</option>)}
      </select>
    </div>

    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
      <div className="small muted">Showing {visible.length} of {items.length} recommendations · select up to five for comparison.</div>
      <div className="row">
        <span className="small muted">{selected.length} selected</span>
        <a className={`btn ${selected.length >= 2 ? 'primary' : 'ghost'}`} aria-disabled={selected.length < 2} href={selected.length >= 2 ? `/compare?ids=${selected.join(',')}` : '#'} onClick={(event) => { if (selected.length < 2) event.preventDefault(); }}>Compare selected →</a>
      </div>
    </div>

    {!visible.length ? <div className="notice">No recommended jobs match the selected filters. Try another job type, career stage, source, or search term.</div> : null}

    <div className="recommendation-grid">
      {visible.map((item) => {
        const id = item.job.id;
        const checked = Boolean(id && selected.includes(id));
        const typeLabels = jobTypeLabels(item.job);
        return <article className="card recommendation-card" key={id ?? `${item.job.source}-${item.job.externalId}`}>
          <div className="row recommendation-card-head">
            <div style={{ flex: 1 }}>
              <div className="row" style={{ alignItems: 'center' }}>
                {id ? <label className="small muted"><input type="checkbox" checked={checked} onChange={() => toggle(id)} disabled={!checked && selected.length >= 5} /> Compare</label> : null}
                <div className="kicker" style={{ marginBottom: 0 }}>{item.family}</div>
              </div>
              <h3 style={{ marginTop: 8 }}>{item.job.title}</h3>
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
            {typeLabels.map((label) => <span className="tag" key={label}>{label}</span>)}
            <StatusPill value={item.match.recommendation} />
            <span className="tag">{healthLabel(item.job.validityStatus)} · {item.job.healthScore ?? 50}/100</span>
            {item.duplicateCount ? <span className="tag">{item.duplicateCount} duplicate{item.duplicateCount === 1 ? '' : 's'} collapsed</span> : null}
            {item.reposted ? <span className="tag">Likely repost / repeat</span> : null}
            {item.job.location ? <span className="tag">{item.job.location}</span> : null}
          </div>

          <div className="recommendation-reasons">
            {item.reasons.map((reason) => <div className="small" key={reason}>• {reason}</div>)}
          </div>

          <div className="row recommendation-actions">
            <a className="btn primary" href={`/jobs/${id}`}>Review, verify & prepare →</a>
            <span className="small muted">Match {item.match.overall}/100</span>
          </div>
        </article>;
      })}
    </div>
  </>;
}
