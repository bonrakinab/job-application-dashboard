'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ApplicationStatus } from '@/lib/types';

export function JobActions({ id, applyUrl, hasPack, status, canResearch }: { id: string; applyUrl?: string; hasPack: boolean; status: ApplicationStatus; canResearch: boolean }) {
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const router = useRouter();

  async function action(path: string, label: string) {
    setBusy(label);
    setMsg('');
    try {
      const response = await fetch(path, { method: 'POST' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Action failed');
      setMsg(`${label} complete`);
      router.refresh();
    } catch (error) {
      setMsg(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy('');
    }
  }

  async function changeStatus(next: ApplicationStatus) {
    setBusy('status');
    setMsg('');
    try {
      const response = await fetch(`/api/jobs/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Status update failed');
      router.refresh();
    } catch (error) {
      setMsg(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy('');
    }
  }

  return <div className="card">
    <div className="kicker">Actions</div>
    <div className="grid" style={{ gap: 9 }}>
      <button className="btn" disabled={Boolean(busy)} onClick={() => action(`/api/jobs/${id}/analyze`, 'Analysis')}>Re-analyze</button>
      <button className="btn" disabled={Boolean(busy) || !canResearch} onClick={() => action(`/api/jobs/${id}/research`, 'Company research')}>Research company + hiring team</button>
      {!canResearch ? <span className="small muted">Grounded company web research is disabled in Gemini free-tier mode.</span> : null}
      <button className="btn primary" disabled={Boolean(busy)} onClick={() => action(`/api/jobs/${id}/application-pack`, 'Application pack')}>{hasPack ? 'Regenerate application pack' : 'Generate application pack'}</button>
      {hasPack ? <>
        <a className="btn" href={`/api/jobs/${id}/resume.pdf`}>Download tailored resume PDF</a>
        <a className="btn" href={`/api/jobs/${id}/cover-letter.pdf`}>Download cover letter PDF</a>
        <button className="btn" disabled={Boolean(busy)} onClick={() => action(`/api/jobs/${id}/draft-outreach`, 'Gmail outreach draft')}>Create Gmail outreach draft</button>
      </> : null}
      <select className="select" value={status} disabled={busy === 'status'} onChange={(event) => changeStatus(event.target.value as ApplicationStatus)}>
        <option value="discovered">Discovered</option>
        <option value="reviewing">Reviewing</option>
        <option value="approved">Approved</option>
        <option value="applied">Applied</option>
        <option value="interview">Interview</option>
        <option value="rejected">Rejected</option>
        <option value="offer">Offer</option>
        <option value="withdrawn">Withdrawn</option>
      </select>
      {applyUrl && applyUrl !== '#' ? <a className="btn" target="_blank" rel="noreferrer" href={applyUrl}>Open official application ↗</a> : null}
      {busy ? <span className="small muted">{busy}…</span> : null}
      {msg ? <span className="small muted">{msg}</span> : null}
    </div>
  </div>;
}
