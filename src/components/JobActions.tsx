'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ApplicationStatus, JobValidityStatus } from '@/lib/types';

function healthLabel(status?: JobValidityStatus) {
  if (status === 'active') return 'Verified active';
  if (status === 'likely_active') return 'Likely active';
  if (status === 'likely_closed') return 'Likely closed';
  if (status === 'closed') return 'Closed';
  return 'Unverified';
}

export function JobActions({
  id,
  applyUrl,
  hasPack,
  packStale = false,
  status,
  canResearch,
  validityStatus = 'unknown',
}: {
  id: string;
  applyUrl?: string;
  hasPack: boolean;
  packStale?: boolean;
  status: ApplicationStatus;
  canResearch: boolean;
  validityStatus?: JobValidityStatus;
}) {
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [currentValidity, setCurrentValidity] = useState<JobValidityStatus>(validityStatus);
  const [currentHealth, setCurrentHealth] = useState<number | null>(null);
  const router = useRouter();
  const usablePack = hasPack && !packStale;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/jobs/${id}/verify`, { method: 'POST' });
        const json = await response.json();
        if (!cancelled && response.ok) {
          setCurrentValidity(json.validityStatus as JobValidityStatus);
          setCurrentHealth(Number(json.healthScore));
        }
      } catch {
        // Background verification is best-effort. Manual verification remains available.
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  async function action(path: string, label: string) {
    setBusy(label);
    setMsg('');
    try {
      const response = await fetch(path, { method: 'POST' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Action failed');
      if (json.verification?.validityStatus) {
        setCurrentValidity(json.verification.validityStatus as JobValidityStatus);
        setCurrentHealth(Number(json.verification.healthScore));
      }
      setMsg(`${label} complete`);
      router.refresh();
    } catch (error) {
      setMsg(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy('');
    }
  }

  async function verifyOnly() {
    setBusy('verification');
    setMsg('');
    try {
      const response = await fetch(`/api/jobs/${id}/verify`, { method: 'POST' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Verification failed');
      setCurrentValidity(json.validityStatus as JobValidityStatus);
      setCurrentHealth(Number(json.healthScore));
      setMsg(`${healthLabel(json.validityStatus)} · health ${json.healthScore}/100`);
      router.refresh();
    } catch (error) {
      setMsg(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy('');
    }
  }

  async function verifyAndOpen() {
    if (!applyUrl || applyUrl === '#') return;
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    setBusy('application verification');
    setMsg('');
    try {
      const response = await fetch(`/api/jobs/${id}/verify`, { method: 'POST' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Verification failed');
      const verifiedStatus = json.validityStatus as JobValidityStatus;
      setCurrentValidity(verifiedStatus);
      setCurrentHealth(Number(json.healthScore));
      router.refresh();

      if (verifiedStatus === 'closed' || verifiedStatus === 'likely_closed') {
        popup?.close();
        setMsg(json.closureReason || 'This posting appears closed, so the application link was not opened.');
        return;
      }
      if (verifiedStatus === 'unknown') {
        popup?.close();
        setMsg('The posting could not be confirmed as active. It was not opened automatically; use the original source link if you want to inspect it manually.');
        return;
      }

      if (popup) popup.location.href = applyUrl;
      else window.open(applyUrl, '_blank', 'noopener,noreferrer');
      setMsg(`${healthLabel(verifiedStatus)} · opening the official application.`);
    } catch (error) {
      popup?.close();
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

  const closed = currentValidity === 'closed' || currentValidity === 'likely_closed';

  return <div className="card">
    <div className="kicker">Actions</div>
    <div className="grid" style={{ gap: 9 }}>
      <button className="btn" disabled={Boolean(busy)} onClick={verifyOnly}>Verify posting now</button>
      <span className="small muted">Current posting state: {healthLabel(currentValidity)}{currentHealth == null ? '' : ` · ${currentHealth}/100`}. Verification runs again before the official application is opened.</span>
      <button className="btn" disabled={Boolean(busy)} onClick={() => action(`/api/jobs/${id}/analyze`, 'Analysis')}>Re-analyze</button>
      <button className="btn" disabled={Boolean(busy) || !canResearch} onClick={() => action(`/api/jobs/${id}/research`, 'Company research')}>Research company + hiring team</button>
      {!canResearch ? <span className="small muted">Grounded company web research requires the OpenAI connection.</span> : null}
      <button className="btn primary" disabled={Boolean(busy) || closed} onClick={() => action(`/api/jobs/${id}/application-pack`, 'Application pack')}>
        {packStale ? 'Regenerate outdated application pack' : hasPack ? 'Regenerate application pack' : 'Generate application pack'}
      </button>
      {closed ? <span className="small muted">Application preparation is disabled while this posting appears closed. Re-verify if you think the source has reopened it.</span> : null}
      {packStale ? <span className="small muted">The stored pack was generated from an older profile, prompt, document template, or cover-letter standard. Regenerate it before downloading or applying.</span> : null}
      {usablePack ? <>
        <a className="btn" href={`/api/jobs/${id}/resume.pdf`}>Download tailored resume PDF</a>
        <a className="btn" href={`/api/jobs/${id}/cover-letter.pdf`}>Download professional cover letter PDF</a>
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
      {usablePack && applyUrl && applyUrl !== '#'
        ? <button className="btn" type="button" disabled={Boolean(busy) || closed} onClick={verifyAndOpen}>Verify & open official application ↗</button>
        : <span className="small muted">Generate a fresh tailored pack first. The ATS match estimate will appear above before the application link is unlocked.</span>}
      {busy ? <span className="small muted">{busy}…</span> : null}
      {msg ? <span className="small muted">{msg}</span> : null}
    </div>
  </div>;
}
