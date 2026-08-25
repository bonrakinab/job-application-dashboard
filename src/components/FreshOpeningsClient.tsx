'use client';

import { useEffect, useMemo, useState } from 'react';
import type { JobValidityStatus, JobWithMatch } from '@/lib/types';
import { applicationLabel } from '@/lib/application-state';
import {
  countActiveFreshOpeningFilters,
  DEFAULT_FRESH_OPENING_FILTERS,
  matchesFreshOpening,
  type FreshAgeFilter,
  type FreshApplicationFilter,
  type FreshDecisionFilter,
  type FreshMatchFilter,
  type FreshOpeningFilters,
  type FreshPostingStateFilter,
} from '@/lib/fresh-opening-filters';
import { jobTypeLabels, type JobTypeFilter } from '@/lib/job-type';
import { StatusPill } from './StatusPill';
import styles from './FreshOpeningsClient.module.css';

const PAGE_SIZE = 100;

function formatDate(value?: string) {
  if (!value) return 'Not provided';
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return 'Not provided';
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto', timeZoneName: 'short',
  }).format(new Date(parsed));
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
  const [filters, setFilters] = useState<FreshOpeningFilters>({ ...DEFAULT_FRESH_OPENING_FILTERS });
  const [page, setPage] = useState(1);

  const sources = useMemo(() => [...new Set(jobs.map((job) => job.source))].sort(), [jobs]);
  const activeFilterCount = countActiveFreshOpeningFilters(filters);
  const visible = useMemo(() => jobs
    .filter((job) => matchesFreshOpening(job, filters))
    .sort((a, b) => discoveredRank(b) - discoveredRank(a)), [jobs, filters]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const paged = useMemo(() => visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [visible, page]);

  useEffect(() => setPage(1), [filters]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  function setFilter<Key extends keyof FreshOpeningFilters>(key: Key, value: FreshOpeningFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function ageOptions() {
    return <>
      <option value="all">All ≤24h</option>
      <option value="1">Last hour</option>
      <option value="3">Last 3h</option>
      <option value="6">Last 6h</option>
      <option value="12">Last 12h</option>
      <option value="24">Last 24h</option>
    </>;
  }

  return <>
    <div className="row" style={{ justifyContent: 'space-between', marginBottom: '0.75rem' }}>
      <span className="small muted">Showing {visible.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, visible.length)} of {visible.length} matching fresh jobs · {jobs.length} in the 24-hour window · {activeFilterCount} active filter{activeFilterCount === 1 ? '' : 's'}</span>
      <span className="small muted">Page {page} of {totalPages}</span>
    </div>

    {!visible.length ? <div className="notice">No fresh openings match the selected filters.</div> : null}

    <div className="table-wrap">
      <table className={styles.table}>
        <thead><tr><th>Opportunity</th><th>Date posted</th><th>Added to Fresh</th><th>Application</th><th>Type</th><th>Location</th><th>Posting state</th><th>Match</th><th>Decision</th><th></th></tr>
        <tr className={styles.filterRow}>
          <th><div className={styles.stack}>
            <input className={`input ${styles.control}`} aria-label="Filter by opportunity" placeholder="Title or company" value={filters.query} onChange={(event) => setFilter('query', event.target.value)} />
            <select className={`select ${styles.control}`} aria-label="Filter by source" value={filters.source} onChange={(event) => setFilter('source', event.target.value)}>
              <option value="all">All sources</option>
              {sources.map((value) => <option value={value} key={value}>{value}</option>)}
            </select>
          </div></th>
          <th><select className={`select ${styles.control}`} aria-label="Filter by date posted" value={filters.postedWithin} onChange={(event) => setFilter('postedWithin', event.target.value as FreshAgeFilter)}>{ageOptions()}</select></th>
          <th><select className={`select ${styles.control}`} aria-label="Filter by time added to Fresh" value={filters.addedWithin} onChange={(event) => setFilter('addedWithin', event.target.value as FreshAgeFilter)}>{ageOptions()}</select></th>
          <th><select className={`select ${styles.control}`} aria-label="Filter by application status" value={filters.application} onChange={(event) => setFilter('application', event.target.value as FreshApplicationFilter)}>
            <option value="all">All states</option>
            <option value="not-applied">Not applied</option>
            <option value="submitted">Submitted</option>
            <option value="discovered">Discovered</option>
            <option value="reviewing">Reviewing</option>
            <option value="approved">Ready to apply</option>
            <option value="applied">Applied</option>
            <option value="interview">Interview</option>
            <option value="offer">Offer</option>
            <option value="rejected">Rejected</option>
            <option value="withdrawn">Withdrawn</option>
          </select></th>
          <th><select className={`select ${styles.control}`} aria-label="Filter by job type" value={filters.jobType} onChange={(event) => setFilter('jobType', event.target.value as JobTypeFilter)}>
            <option value="all">All types</option>
            <option value="full-time">Full-time</option>
            <option value="part-time">Part-time</option>
            <option value="contract">Contract</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="on-site">On-site</option>
          </select></th>
          <th><input className={`input ${styles.control}`} aria-label="Filter by location" placeholder="City or remote" value={filters.location} onChange={(event) => setFilter('location', event.target.value)} /></th>
          <th><select className={`select ${styles.control}`} aria-label="Filter by posting state" value={filters.postingState} onChange={(event) => setFilter('postingState', event.target.value as FreshPostingStateFilter)}>
            <option value="all">All states</option>
            <option value="viable">Viable only</option>
            <option value="active">Verified active</option>
            <option value="likely_active">Likely active</option>
            <option value="unknown">Unverified</option>
            <option value="likely_closed">Likely closed</option>
            <option value="closed">Closed</option>
          </select></th>
          <th><select className={`select ${styles.control}`} aria-label="Filter by match score" value={filters.match} onChange={(event) => setFilter('match', event.target.value as FreshMatchFilter)}>
            <option value="all">Any score</option>
            <option value="90-100">90–100</option>
            <option value="80-89">80–89</option>
            <option value="70-79">70–79</option>
            <option value="60-69">60–69</option>
            <option value="below-60">Below 60</option>
            <option value="unanalyzed">Unanalyzed</option>
          </select></th>
          <th><select className={`select ${styles.control}`} aria-label="Filter by decision" value={filters.decision} onChange={(event) => setFilter('decision', event.target.value as FreshDecisionFilter)}>
            <option value="all">All decisions</option>
            <option value="exceptional">Exceptional</option>
            <option value="strong">Strong</option>
            <option value="reasonable">Reasonable</option>
            <option value="stretch">Stretch</option>
            <option value="skip">Skip</option>
            <option value="unanalyzed">Unanalyzed</option>
          </select></th>
          <th><button className={`btn ghost ${styles.clear}`} type="button" disabled={!activeFilterCount} onClick={() => setFilters({ ...DEFAULT_FRESH_OPENING_FILTERS })}>Clear</button></th>
        </tr></thead>
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
