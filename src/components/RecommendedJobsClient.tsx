'use client';

import { useMemo, useState } from 'react';
import type { JobValidityStatus, SearchProfile } from '@/lib/types';
import type { RecommendedOpportunity } from '@/lib/recommendations';
import { jobMatchesType, jobTypeLabels, type JobTypeFilter } from '@/lib/job-type';
import { applicationLabel, matchesApplicationFilter, type ApplicationFilter } from '@/lib/application-state';
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
  const [applicationState, setApplicationState] = useState<ApplicationFilter>('all');
  const [source, setSource] = useState('all');
  const [selected, setSelected] = useState<string[]>([]);

  const sources = useMemo(() => [...new Set(items.map((item) => item.job.source))].sort(), [items]);
  const visible = useMemo(() => items.filter((item) => {
    const text = `${item.job.title} ${item.job.company} ${item.job.location ?? ''} ${item.family}`.toLowerCase();
    return (!q || text.includes(q.toLowerCase()))
      && (stage === 'all' || item.stage === stage)
      && jobMatchesType(item.job, jobType)
      && matchesApplicationFilter(item.job.application, applicationState)
      && (source === 'all' || item.job.source === source);
  }), [items, q, stage, jobType, applicationState, source]);

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
    <div className="primary-search">
      <input className="input" placeholder="Search recommended jobs…" value={q} onChange={(event) => setQ(event.target.value)} />
      {searchProfiles.length ? <select className="select" value={selectedProfileId ?? 'all'} onChange={(event) => changeSearchProfile(event.target.value)}>
        <option value="all">All target roles</option>
        {searchProfiles.filter((profile) => profile.enabled).map((profile) => <option value={profile.id} key={profile.id}>{profile.name}</option>)}
      </select> : null}
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
        <select className="select" aria-label="Job type" value={jobType} onChange={(event) => setJobType(event.target.value as JobTypeFilter)}>
          <option value="all">All job types</option>
          <option value="full-time">Full-time</option>
          <option value="part-time">Part-time</option>
          <option value="contract">Contract</option>
          <option value="remote">Remote</option>
          <option value="hybrid">Hybrid</option>
          <option value="on-site">On-site</option>
        </select>
        <select className="select" aria-label="Application state" value={applicationState} onChange={(event) => setApplicationState(event.target.value as ApplicationFilter)}>
          <option value="all">Any application status</option>
          <option value="applied">Applied</option>
          <option value="not-applied">Not applied</option>
        </select>
        <select className="select" aria-label="Job source" value={source} onChange={(event) => setSource(event.target.value)}>
          <option value="all">All sources</option>
          {sources.map((value) => <option value={value} key={value}>{value}</option>)}
        </select>
      </div>
    </details>

    <div className="result-line">
      <span className="small muted">{visible.length} of {items.length} jobs</span>
      <div className="compact-actions">
        {selected.length ? <span className="small muted">{selected.length} selected</span> : null}
        <a className={`btn ${selected.length >= 2 ? 'primary' : 'ghost'}`} aria-disabled={selected.length < 2} href={selected.length >= 2 ? `/compare?ids=${selected.join(',')}` : '#'} onClick={(event) => { if (selected.length < 2) event.preventDefault(); }}>Compare</a>
      </div>
    </div>

    {!visible.length ? <div className="notice">No recommended jobs match the selected filters. Try another application state, job type, career stage, source, or search term.</div> : null}

    <div className="recommendation-grid simple-job-cards">
      {visible.map((item) => {
        const id = item.job.id;
        const checked = Boolean(id && selected.includes(id));
        const typeLabels = jobTypeLabels(item.job);
        const appLabel = applicationLabel(item.job.application);
        return <article className="card simple-job-card" key={id ?? `${item.job.source}-${item.job.externalId}`}>
          <div>
            <div className="row" style={{ marginBottom: 7 }}>
              {id ? <label className="small muted"><input type="checkbox" checked={checked} onChange={() => toggle(id)} disabled={!checked && selected.length >= 5} /> Compare</label> : null}
              <span className="small muted">{item.family}</span>
            </div>
            <h3>{item.job.title}</h3>
            <div className="simple-job-meta">{item.job.company} · {item.job.location || 'Location not listed'} · {stageLabel(item.stage)}</div>
            <div className="tag-list">
              <span className="tag"><b>{appLabel}</b></span>
              {typeLabels.slice(0, 2).map((label) => <span className="tag" key={label}>{label}</span>)}
              <StatusPill value={item.match.recommendation} />
              <span className="tag">{healthLabel(item.job.validityStatus)}</span>
            </div>
            {item.reasons[0] ? <p className="small muted">{item.reasons[0]}</p> : null}
          </div>
          <div className="simple-job-score">
            <b>{item.match.overall}</b>
            <span>match</span>
          </div>
          <div className="row recommendation-actions">
            <span className="small muted">{item.highlySuitable ? 'Strong profile fit' : 'Review the requirements before applying'}</span>
            <a className="btn primary" href={`/jobs/${id}`}>View job</a>
          </div>
        </article>;
      })}
    </div>
  </>;
}
