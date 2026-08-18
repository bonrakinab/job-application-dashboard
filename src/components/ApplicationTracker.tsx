'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MetricCard } from '@/components/MetricCard';
import { applicationLabel } from '@/lib/application-state';
import type { ApplicationStatus } from '@/lib/types';

export type ApplicationTrackerRow = {
  id: string;
  title: string;
  company: string;
  location?: string;
  match?: number;
  status: ApplicationStatus;
  appliedAt?: string;
  responseAt?: string;
  updatedAt?: string;
  notes?: string;
};

const TRACKED_STAGES: Array<{ value: Exclude<ApplicationStatus, 'discovered'>; label: string }> = [
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'approved', label: 'Ready to apply' },
  { value: 'applied', label: 'Applied' },
  { value: 'interview', label: 'Interview' },
  { value: 'offer', label: 'Offer' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function wasSubmitted(row: ApplicationTrackerRow) {
  if (['applied', 'interview', 'rejected', 'offer'].includes(row.status)) return true;
  return row.status === 'withdrawn' && Boolean(row.appliedAt);
}

function receivedResponse(row: ApplicationTrackerRow) {
  return ['interview', 'rejected', 'offer'].includes(row.status);
}

export function ApplicationTracker({ initialRows }: { initialRows: ApplicationTrackerRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState<'all' | Exclude<ApplicationStatus, 'discovered'>>('all');
  const [busyId, setBusyId] = useState('');
  const [messages, setMessages] = useState<Record<string, string>>({});
  const router = useRouter();

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const counts = useMemo(() => {
    const submitted = rows.filter(wasSubmitted).length;
    const responses = rows.filter(receivedResponse).length;
    const interviews = rows.filter((row) => row.status === 'interview').length;
    const offers = rows.filter((row) => row.status === 'offer').length;
    return { submitted, responses, interviews, offers };
  }, [rows]);

  const stageCounts = useMemo(() => Object.fromEntries(
    TRACKED_STAGES.map(({ value }) => [value, rows.filter((row) => row.status === value).length]),
  ) as Record<Exclude<ApplicationStatus, 'discovered'>, number>, [rows]);

  const visibleRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows
      .filter((row) => stage === 'all' || row.status === stage)
      .filter((row) => !needle || `${row.title} ${row.company} ${row.location ?? ''}`.toLowerCase().includes(needle))
      .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime());
  }, [query, rows, stage]);

  async function changeStatus(row: ApplicationTrackerRow, next: Exclude<ApplicationStatus, 'discovered'>) {
    if (next === row.status) return;
    setBusyId(row.id);
    setMessages((current) => ({ ...current, [row.id]: '' }));
    try {
      const response = await fetch(`/api/jobs/${row.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Status update failed');
      setRows((current) => current.map((item) => item.id === row.id
        ? { ...item, status: next, updatedAt: new Date().toISOString() }
        : item));
      setMessages((current) => ({ ...current, [row.id]: 'Saved' }));
      router.refresh();
    } catch (error) {
      setMessages((current) => ({
        ...current,
        [row.id]: error instanceof Error ? error.message : String(error),
      }));
    } finally {
      setBusyId('');
    }
  }

  const funnelMax = Math.max(1, ...Object.values(stageCounts));

  return <>
    <div className="grid metrics" style={{ gridTemplateColumns: 'repeat(4,minmax(120px,1fr))' }}>
      <MetricCard label="Submitted" value={counts.submitted} />
      <MetricCard label="Responses" value={counts.responses} />
      <MetricCard label="Interviews" value={counts.interviews} />
      <MetricCard label="Offers" value={counts.offers} />
    </div>

    <div className="grid detail-grid">
      <div className="card">
        <div className="kicker">Pipeline</div>
        <div className="funnel">
          {TRACKED_STAGES.map(({ value, label }) => <div className="funnel-row" key={value}>
            <span>{label}</span>
            <div className="funnel-bar"><span style={{ width: `${(stageCounts[value] / funnelMax) * 100}%` }} /></div>
            <b>{stageCounts[value]}</b>
          </div>)}
        </div>
      </div>
      <div className="card">
        <div className="kicker">Tracker status</div>
        <h3>{rows.length} job{rows.length === 1 ? '' : 's'} being tracked</h3>
        <p className="small muted" style={{ lineHeight: 1.7 }}>
          Change a stage here as soon as you submit, receive an interview, get a decision, or withdraw. Updates are saved to the same application record used throughout the dashboard.
        </p>
        <a className="btn ghost" href="/jobs">Find another job to track →</a>
      </div>
    </div>

    <div className="section-head"><h2>Tracked applications</h2><span className="small muted">Most recently updated first.</span></div>
    <div className="searchbar">
      <input className="input" placeholder="Search company, role or location" value={query} onChange={(event) => setQuery(event.target.value)} />
      <select className="select" style={{ maxWidth: 210 }} value={stage} onChange={(event) => setStage(event.target.value as typeof stage)}>
        <option value="all">All stages</option>
        {TRACKED_STAGES.map(({ value, label }) => <option value={value} key={value}>{label}</option>)}
      </select>
    </div>

    {visibleRows.length ? <div className="grid" style={{ gap: 12 }}>
      {visibleRows.map((row) => <div className="card" key={row.id}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="job-title">{row.title}</div>
            <div className="job-company">{row.company}{row.location ? ` · ${row.location}` : ''}</div>
          </div>
          <div className="row">
            {typeof row.match === 'number' ? <span className="tag">Match <b>{row.match}</b></span> : null}
            <span className="tag"><b>{applicationLabel({ status: row.status })}</b></span>
          </div>
        </div>

        <div className="row" style={{ marginTop: 13 }}>
          <span className="small muted">Applied: <b style={{ color: 'var(--text)' }}>{formatDate(row.appliedAt)}</b></span>
          <span className="small muted">Response: <b style={{ color: 'var(--text)' }}>{formatDate(row.responseAt)}</b></span>
          <span className="small muted">Updated: <b style={{ color: 'var(--text)' }}>{formatDate(row.updatedAt)}</b></span>
        </div>

        {row.notes ? <div className="notice" style={{ marginTop: 13, marginBottom: 0 }}><b>Notes:</b> {row.notes}</div> : null}

        <div className="row" style={{ marginTop: 14 }}>
          <select
            className="select"
            style={{ maxWidth: 220 }}
            value={row.status}
            disabled={busyId === row.id}
            onChange={(event) => changeStatus(row, event.target.value as Exclude<ApplicationStatus, 'discovered'>)}
          >
            {TRACKED_STAGES.map(({ value, label }) => <option value={value} key={value}>{label}</option>)}
          </select>
          <a className="btn ghost" href={`/jobs/${row.id}`}>Open job →</a>
          {busyId === row.id ? <span className="small muted">Saving…</span> : null}
          {messages[row.id] ? <span className="small muted">{messages[row.id]}</span> : null}
        </div>
      </div>)}
    </div> : <div className="notice">
      {rows.length ? 'No tracked applications match these filters.' : 'No applications are being tracked yet. Open a job and change its application stage to Reviewing, Ready to apply, Applied, Interview, Offer, Rejected, or Withdrawn.'}
    </div>}
  </>;
}
