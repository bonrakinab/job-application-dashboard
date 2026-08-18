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
  atsEligible = false,
  atsScore,
  atsPassScore = 90,
  packGenerationAllowed = true,
  packGenerationReason,
  packGenerationBlockers = [],
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
  atsPassScore?: number;
  packGenerationAllowed?: boolean;
  packGenerationReason?: string;
  packGenerationBlockers?: string[];
}) {
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [currentValidity, setCurrentValidity] = useState<JobValidityStatus>(validityStatus);
  const [currentHealth, setCurrentHealth] = useState<number | null>(null);
  const router = useRouter();
  const usablePack = hasPack && !packStale;
  const applicationReady = usablePack && atsEligible;

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
      if (!response.ok) {
        if (json.code === 'APPLICATION_PACK_BLOCKED') {
          const blockers = Array.isArray(json.blockers) ? json.blockers.filter(Boolean) : [];
          setMsg([json.error, ...blockers].filter(Boolean).join(' '));
          router.refresh();
          return;
        }
        throw new Error(json.error || 'Action failed');
      }
      if (json.verification?.validityStatus) {
        setCurrentValidity(json.verification.validityStatus as JobValidityStatus);
        setCurrentHealth(Number(json.verification.healthScore));
      }
      if (label === 'Application pack' && typeof json.ats?.overall === 'number') {
        setMsg(json.ats.eligibleToApply
          ? `Application pack complete · ATS ${json.ats.overall}/100 · PASS`
          : `Application pack complete · ATS ${json.ats.overall}/100 · CONDITIONAL`);
      } else {
        setMsg(`${label} complete`);
      }
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
    if (!applicationReady) {
      setMsg(`Application is locked until the tailored resume reaches the ATS pass standard of ${atsPassScore}/100.`);
      return;
    }
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
      setMsg(`${healthLabel(verifiedStatus)} · ATS PASS confirmed · opening the official application.`);
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
      <button className="btn primary" disabled={Boolean(busy) || closed || !packGenerationAllowed} onClick={() => action(`/api/jobs/${id}/application-pack`, 'Application pack')}>
        {packStale ? 'Regenerate + ATS optimize application pack' : hasPack ? 'Regenerate + ATS optimize application pack' : 'Generate + ATS optimize application pack'}
      </button>
      {packGenerationAllowed
        ? <span className="small muted">Generation automatically retargets verified resume evidence toward the {atsPassScore}+ ATS pass standard. Unsupported experience is never inserted to force a pass.</span>
        : <div className="notice" style={{ marginBottom: 0 }}>
          <b>Application pack unavailable for this role.</b> {packGenerationReason || 'This job is currently blocked by the fit/eligibility layer.'}
          {packGenerationBlockers.length ? <div style={{ marginTop: 8 }}>{packGenerationBlockers.map((item) => <div key={item}>• {item}</div>)}</div> : null}
          <div style={{ marginTop: 8 }}>Use Re-analyze if the job description or your verified profile evidence has changed.</div>
        </div>}
      {closed ? <span className="small muted">Application preparation is disabled while this posting appears closed. Re-verify if you think the source has reopened it.</span> : null}
      {packStale ? <span className="small muted">The stored pack is not currently usable. Regenerate it only when this role is eligible for pack generation.</span> : null}
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
      {applicationReady && applyUrl && applyUrl !== '#'
        ? <button className="btn" type="button" disabled={Boolean(busy) || closed} onClick={verifyAndOpen}>Verify & open official application ↗</button>
        : usablePack
          ? <span className="notice"><b>Application locked.</b> ATS readiness is {atsScore ?? 'pending'}/100; {atsPassScore}+ is required for PASS and application eligibility. A conditional resume can still be downloaded for review, but the dashboard will not recommend opening the application until it passes.</span>
          : packGenerationAllowed
            ? <span className="small muted">Generate a fresh tailored pack first. The ATS pass decision will appear above before the application link is unlocked.</span>
            : <span className="small muted">This role is currently outside the application-pack eligibility layer, so no application action will be recommended.</span>}
      {busy ? <span className="small muted">{busy}…</span> : null}
      {msg ? <span className="small muted">{msg}</span> : null}
    </div>
  </div>;
}
