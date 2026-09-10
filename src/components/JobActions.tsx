'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ApplicationStatus, JobValidityStatus } from '@/lib/types';
import { readApiResponse } from '@/lib/api-response';
import { RESUME_ENGINE_VERSION, RESUME_TEMPLATE_VERSION } from '@/lib/resume-template';

function healthLabel(status?: JobValidityStatus) {
  if (status === 'active') return 'Verified active';
  if (status === 'likely_active') return 'Likely active';
  if (status === 'likely_closed') return 'Likely closed';
  if (status === 'closed') return 'Closed';
  return 'Unverified';
}

export function JobActions({
  id, applyUrl, hasPack, packStale = false, status, canResearch, validityStatus = 'unknown', atsEligible = false,
  atsScore, packGenerationReason, packGenerationBlockers = [], profileReady = true, profileSetupUrl,
}: {
  id: string;
  applyUrl?: string;
  hasPack: boolean;
  packStale?: boolean;
  status: ApplicationStatus;
  canResearch: boolean;
  validityStatus?: JobValidityStatus;
  atsEligible?: boolean;
  atsScore?: number;
  packGenerationReason?: string;
  packGenerationBlockers?: string[];
  profileReady?: boolean;
  profileSetupUrl?: string;
}) {
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [currentValidity, setCurrentValidity] = useState<JobValidityStatus>(validityStatus);
  const router = useRouter();
  const usablePack = hasPack && !packStale;
  const applicationReady = usablePack;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/jobs/${id}/verify`, { method: 'POST' });
        const json = await response.json();
        if (!cancelled && response.ok) setCurrentValidity(json.validityStatus as JobValidityStatus);
      } catch {
        // Background verification is best-effort.
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  async function action(path: string, label: string) {
    setBusy(label); setMsg('');
    try {
      const response = await fetch(path, { method: 'POST' });
      const json = await readApiResponse<{ verification?: { validityStatus?: JobValidityStatus }; ats?: { overall?: number; targetReached?: boolean } }>(response, label);
      if (json.verification?.validityStatus) setCurrentValidity(json.verification.validityStatus as JobValidityStatus);
      if (label === 'Application pack' && typeof json.ats?.overall === 'number') {
        setMsg(json.ats.targetReached
          ? `Application pack complete · internal ATS estimate ${json.ats.overall}/100 · ${RESUME_ENGINE_VERSION} active`
          : `Application pack complete · internal ATS estimate ${json.ats.overall}/100 · review remaining gaps · ${RESUME_ENGINE_VERSION} active`);
      } else setMsg(`${label} complete`);
      router.refresh();
    } catch (error) {
      setMsg(error instanceof Error ? error.message : String(error));
    } finally { setBusy(''); }
  }

  async function verifyOnly() {
    setBusy('verification'); setMsg('');
    try {
      const response = await fetch(`/api/jobs/${id}/verify`, { method: 'POST' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Verification failed');
      setCurrentValidity(json.validityStatus as JobValidityStatus);
      setMsg(healthLabel(json.validityStatus));
      router.refresh();
    } catch (error) { setMsg(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(''); }
  }

  async function verifyAndOpen() {
    if (!applicationReady) { setMsg('Generate a current résumé and cover letter before opening the application.'); return; }
    if (!applyUrl || applyUrl === '#') return;
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    setBusy('application verification'); setMsg('');
    try {
      const response = await fetch(`/api/jobs/${id}/verify`, { method: 'POST' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Verification failed');
      const verifiedStatus = json.validityStatus as JobValidityStatus;
      setCurrentValidity(verifiedStatus); router.refresh();
      if (verifiedStatus === 'closed' || verifiedStatus === 'likely_closed') {
        popup?.close(); setMsg(json.closureReason || 'This posting appears closed, so the application link was not opened.'); return;
      }
      if (verifiedStatus === 'unknown') {
        popup?.close(); setMsg('The posting could not be confirmed as active. It was not opened automatically; use the original source link if you want to inspect it manually.'); return;
      }
      if (popup) popup.location.href = applyUrl; else window.open(applyUrl, '_blank', 'noopener,noreferrer');
      setMsg(`${healthLabel(verifiedStatus)} · opening the official application.`);
    } catch (error) { popup?.close(); setMsg(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(''); }
  }

  async function changeStatus(next: ApplicationStatus) {
    setBusy('status'); setMsg('');
    try {
      const response = await fetch(`/api/jobs/${id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Status update failed');
      router.refresh();
    } catch (error) { setMsg(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(''); }
  }

  const closed = currentValidity === 'closed' || currentValidity === 'likely_closed';

  return <div className="card application-actions">
    <div className="kicker">Application</div>
    <h2>{!profileReady ? 'Part-time résumé needed' : usablePack ? 'Documents ready' : hasPack ? 'Documents need updating' : 'Prepare your application'}</h2>

    <div className={usablePack ? 'compact-success' : hasPack ? 'compact-warning' : 'compact-info'} data-resume-engine-version={RESUME_ENGINE_VERSION}>
      <b>Résumé engine {RESUME_ENGINE_VERSION.replace('resume-engine.', '')} active</b>
      <span>Template {RESUME_TEMPLATE_VERSION}</span>
      <span>{usablePack
        ? '✓ This job’s stored résumé was generated with the current engine/template.'
        : hasPack
          ? '↻ This job has an older résumé. Regenerate it once to use the active version.'
          : 'New résumé generation will use this active version.'}</span>
    </div>

    <div className="action-status">
      <span>Posting <b>{healthLabel(currentValidity)}</b></span>
      {atsScore != null ? <span>Internal ATS estimate <b className={atsEligible ? 'text-success' : 'text-warning'}>{atsScore}/100</b></span> : null}
    </div>

    <button className="btn primary action-primary" disabled={Boolean(busy) || closed || !profileReady} onClick={() => action(`/api/jobs/${id}/application-pack`, 'Application pack')}>
      {hasPack ? 'Regenerate résumé + cover letter' : 'Generate résumé + cover letter'}
    </button>

    {!profileReady ? <div className="compact-warning"><b>Upload your separate part-time résumé first.</b><span>This job will not use skills or experience from the main career profile.</span>{profileSetupUrl ? <a className="btn" href={profileSetupUrl}>Upload part-time résumé</a> : null}</div> : null}
    {closed ? <p className="small muted">This posting appears closed. Verify it again if the employer has reopened the role.</p> : null}
    {packGenerationReason ? <div className="compact-warning"><b>Some requirements are not fully supported.</b><span>The documents will emphasize verified transferable evidence and show the gaps for review.</span>{packGenerationBlockers.length ? <span>{packGenerationBlockers.slice(0, 3).join(' · ')}</span> : null}</div> : null}

    {usablePack ? <div className="document-actions">
      <a className="btn primary" target="_blank" rel="noreferrer" href={`/api/jobs/${id}/resume.pdf?preview=1`}>Preview final résumé</a>
      <a className="btn" href={`/api/jobs/${id}/resume.docx`}>Download DOCX</a>
      <a className="btn" href={`/api/jobs/${id}/resume.pdf`}>Download PDF</a>
      <a className="btn" href={`/api/jobs/${id}/cover-letter.pdf`}>Download cover letter</a>
      <span className="small muted">Preview final résumé shows the exact PDF export used for this application. PDF and DOCX use the same current tailored pack and reference-template policy.</span>
    </div> : <p className="small muted">A tailored résumé and cover letter are generated for every open role. Unsupported requirements remain clearly marked.</p>}

    {applicationReady && applyUrl && applyUrl !== '#'
      ? <button className="btn" type="button" disabled={Boolean(busy) || closed} onClick={verifyAndOpen}>Open official application ↗</button>
      : <span className="small muted">Generate current documents before applying.</span>}

    <label className="field-label" htmlFor={`application-status-${id}`}>Application status</label>
    <select id={`application-status-${id}`} className="select" value={status} disabled={busy === 'status'} onChange={(event) => changeStatus(event.target.value as ApplicationStatus)}>
      <option value="discovered">Discovered</option><option value="reviewing">Reviewing</option><option value="approved">Approved</option><option value="applied">Applied</option><option value="interview">Interview</option><option value="rejected">Rejected</option><option value="offer">Offer</option><option value="withdrawn">Withdrawn</option>
    </select>

    <details className="advanced-panel action-more"><summary>More actions</summary><div className="advanced-panel-body grid" style={{ gap: 9 }}>
      <button className="btn" disabled={Boolean(busy)} onClick={verifyOnly}>Verify posting</button>
      <button className="btn" disabled={Boolean(busy) || !profileReady} onClick={() => action(`/api/jobs/${id}/analyze`, 'Analysis')}>Refresh job analysis</button>
      <button className="btn" disabled={Boolean(busy) || !canResearch} onClick={() => action(`/api/jobs/${id}/research`, 'Company research')}>Research company</button>
      {usablePack ? <button className="btn" disabled={Boolean(busy)} onClick={() => action(`/api/jobs/${id}/draft-outreach`, 'Gmail outreach draft')}>Create outreach draft</button> : null}
      {!canResearch ? <span className="small muted">Company research is not connected.</span> : null}
    </div></details>

    {busy ? <span className="small muted">{busy}…</span> : null}
    {msg ? <span className="small muted">{msg}</span> : null}
  </div>;
}
