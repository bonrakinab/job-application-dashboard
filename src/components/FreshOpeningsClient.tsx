'use client';

import { useEffect, useMemo, useState } from 'react';
import type { JobValidityStatus, JobWithMatch } from '@/lib/types';
import { applicationLabel, matchesApplicationFilter, type ApplicationFilter } from '@/lib/application-state';
import { jobMatchesType, jobTypeLabels, type JobTypeFilter } from '@/lib/job-type';
import { StatusPill } from './StatusPill';

const PAGE_SIZE = 100;

function formatDate(value?: string) {
  if (!value) return 'Not provided';
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return 'Not provided';
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(parsed));
}

function validityLabel(status?: JobValidityStatus) {
  if (status === 'active') return 'Verified active';
  if (status === 'likely_active') return 'Likely active';
  if (status === 'likely_closed') return 'Likely closed';
  if (status === 'closed') return 'Closed';
  return 'Unverified';
}

function discoveredRank(job: JobWithMatch) {
  return job.discoveredAt ? Date.parse(job.discoveredAt) || 0 : 0;
}

export function FreshOpeningsClient({ jobs }: { jobs: JobWithMatch[] }) {
  const [q, setQ] = useState('');
  const [source, setSource] = useState('all');
  const [jobType, setJobType] = useState<JobTypeFilter>('all');
  const [applicationState, setApplicationState] = useState<ApplicationFilter>('all');
  const [postingState, setPostingState] = useState('all');
  const [page, setPage] = useState(1);

  const sources = useMemo(() => [...new Set(jobs.map((job) => job.source))].sort(), [jobs]);
  const visible = useMemo(() => jobs.filter((job) => {
    const text = `${job.title} ${job.company} ${job.location ?? ''}`.toLowerCase();
    const searchHit = !q || text.includes(q.toLowerCase());
    const sourceHit = source === 'all' || job.source === source;
    const typeHit = jobMatchesType(job, jobType);
    const applicationHit = matchesApplicationFilter(job.application, applicationState);
    const postingHit = postingState === 'all'
      || (postingState === 'viable' && !['closed', 'likely_closed'].includes(job.validityStatus ?? 'unknown'))
      || (postingState === 'closed' && ['closed', 'likely_closed'].includes(job.validityStatus ?? 'unknown'));
    return searchHit && sourceHit && typeHit && applicationHit && postingHit;
  }).sort((a, b) => discoveredRank(b) - discoveredRank(a)), [jobs, q, source, jobType, applicationState, postingState]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const paged = useMemo(() => visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [visible, page]);

  useEffect(() => setPage(1), [q, source, jobType, applicationState, postingState]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  return <>
    <div className="searchbar job-filters">
      <input className="input" placeholder="Search title, company, location…" value={q} onChange={(event) => setQ(event.target.value)} />
      <select className="select" aria-label="Job type" value={jobType} onChange={(event) => setJobType(event.target.value as JobTypeFilter)}>
        <option value="all">All job types</option>
        <option value="full-time">Full-time</option>
        <option value="part-time">Part-time</option>
        <option value="contract">Contract / contractual</option>
        <option value="remote">Remote</option>
        <option value="hybrid">Hybrid</option>
        <option value="on-site">On-site / non-remote</option>
      </select>
      <select className="select" aria-label="Application state" value={applicationState} onChange={(event) => setApplicationState(event.target.value as ApplicationFilter)}>
        <option value="all">Applied + not applied</option>
        <option value="applied">Applied only</option>
        <option value="not-applied">Not applied only</option>
      </select>
      <select className="select" aria-label="Posting state" value={postingState} onChange={(event) => setPostingState(event.target.value)}>
        <option value="all">All posting states</option>
        <option value="viable">Viable + unverified</option>
        <option value="closed">Closed / likely closed</option>
      </select>
      <select className="select" aria-label="Source" value={source} onChange={(event) => setSource(event.target.value)}>
        <option value="all">All sources</option>
        {sources.map((value) => <option value={value} key={value}>{value}</option>)}
      </select>
    </div>

    <div className="row" style={{ justifyContent: 'space-between', marginBottom: '0.75rem' }}>
      <span className="small muted">Showing {visible.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, visible.length)} of {visible.length} matching fresh jobs · {jobs.length} in the 30-day window</span>
      <span className="small muted">Page {page} of {totalPages}</span>
    </div>

    {!visible.length ? <div className="notice">No fresh openings match the selected filters.</div> : null}

    <div className="table-wrap">
      <table>
        <thead><tr><th>Opportunity</th><th>Date posted</th><th>Added to Fresh</th><th>Application</th><th>Type</th><th>Location</th><th>Posting state</th><th>Match</th><th>Decision</th><th></th></tr></thead>
        <tbody>{paged.map((job) => {
          const labels = jobTypeLabels(job);
          return <tr key={job.id}>
            <td><div className="job-title">{job.title}</div><div className="job-company">{job.company} · {job.source}</div></td>
            <td><b>{formatDate(job.postedAt)}</b></td>
            <td>{formatDate(job.discoveredAt)}</td>
            <td><span className="tag"><b>{applicationLabel(job.application)}</b></span></td>
            <td>{labels.length ? <div className="tag-list">{labels.map((label) => <span className="tag" key={label}>{label}</span>)}</div> : <span className="muted">—</span>}</td>
            <td>{job.location || '—'}</td>
            <td><span className="pill">{validityLabel(job.validityStatus)}</span></td>
            <td><span className="score">{job.match?.overall ?? '—'}</span>{job.match ? <span className="muted">/100</span> : null}</td>
            <td>{job.match ? <StatusPill value={job.match.recommendation} /> : <span className="pill">unanalyzed</span>}</td>
            <td><a className="btn ghost" href={`/jobs/${job.id}`}>Review →</a></td>
          </tr>;
        })}</tbody>
      </table>
    </div>

    {totalPages > 1 ? <div className="row" style={{ justifyContent: 'space-between', marginTop: '1rem' }}>
      <button className="btn ghost" type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>← Previous</button>
      <span className="small muted">{visible.length} results</span>
      <button className="btn ghost" type="button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next →</button>
    </div> : null}
  </>;
}
