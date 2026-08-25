'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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
    const interviews = rows.filter((row) => row.status === 'interview').length;
    const offers = rows.filter((row) => row.status === 'offer').length;
    return { submitted, interviews, offers };
  }, [rows]);

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

  return <>
    <div className="summary-strip">
      <div className="summary-item"><b>{counts.submitted}</b><span>Applications sent</span></div>
      <div className="summary-item"><b>{counts.interviews}</b><span>Interviews</span></div>
      <div className="summary-item"><b>{counts.offers}</b><span>Offers</span></div>
    </div>

    <div className="section-head"><h2>{rows.length} tracked application{rows.length === 1 ? '' : 's'}</h2><a className="small muted" href="/recommended">Find jobs →</a></div>
    <div className="searchbar">
      <input className="input" placeholder="Search company, role or location" value={query} onChange={(event) => setQuery(event.target.value)} />
      <select className="select" style={{ maxWidth: 210 }} value={stage} onChange={(event) => setStage(event.target.value as typeof stage)}>
        <option value="all">All stages</option>
        {TRACKED_STAGES.map(({ value, label }) => <option value={value} key={value}>{label}</option>)}
      </select>
    </div>

    {visibleRows.length ? <div className="tracker-list">
      {visibleRows.map((row) => <div className="card tracker-card" key={row.id}>
        <div>
          <div className="job-title">{row.title}</div>
          <div className="job-company">{row.company}{row.location ? ` · ${row.location}` : ''}{typeof row.match === 'number' ? ` · ${row.match}/100 match` : ''}</div>
        </div>
        <div className="tracker-actions">
          <select
            className="select"
            style={{ maxWidth: 220 }}
            value={row.status}
            disabled={busyId === row.id}
            onChange={(event) => changeStatus(row, event.target.value as Exclude<ApplicationStatus, 'discovered'>)}
          >
            {TRACKED_STAGES.map(({ value, label }) => <option value={value} key={value}>{label}</option>)}
          </select>
          <a className="btn ghost" href={`/jobs/${row.id}`}>View job</a>
          {busyId === row.id ? <span className="small muted">Saving…</span> : null}
          {messages[row.id] ? <span className="small muted">{messages[row.id]}</span> : null}
        </div>
        <div className="tracker-details">
          <span>Status: <b>{applicationLabel({ status: row.status })}</b></span>
          <span>Applied: <b>{formatDate(row.appliedAt)}</b></span>
          <span>Updated: <b>{formatDate(row.updatedAt)}</b></span>
        </div>
        {row.notes ? <details className="advanced-panel" style={{ gridColumn: '1 / -1', marginTop: 0 }}><summary>Notes</summary><div className="advanced-panel-body small">{row.notes}</div></details> : null}
      </div>)}
    </div> : <div className="notice">
      {rows.length ? 'No tracked applications match these filters.' : 'No applications are being tracked yet. Open a job and change its application stage to Reviewing, Ready to apply, Applied, Interview, Offer, Rejected, or Withdrawn.'}
    </div>}
  </>;
}
