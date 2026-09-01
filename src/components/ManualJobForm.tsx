'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import styles from './ManualJobForm.module.css';

type Stage = 'idle' | 'saving' | 'generating';

export function ManualJobForm() {
  const [stage, setStage] = useState<Stage>('idle');
  const [message, setMessage] = useState('');
  const [savedJobId, setSavedJobId] = useState('');
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStage('saving');
    setMessage('');
    setSavedJobId('');
    const formData = new FormData(event.currentTarget);
    const input = Object.fromEntries(formData.entries());

    try {
      const saveResponse = await fetch('/api/jobs/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const saved = await saveResponse.json();
      if (!saveResponse.ok) throw new Error(saved.error || 'The job could not be saved.');

      const jobId = String(saved.jobId);
      setSavedJobId(jobId);
      setStage('generating');
      const packResponse = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/application-pack`, { method: 'POST' });
      const pack = await packResponse.json();
      if (!packResponse.ok) throw new Error(pack.error || 'The application pack could not be generated.');

      router.push(`/jobs/${encodeURIComponent(jobId)}`);
    } catch (error) {
      setStage('idle');
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  const busy = stage !== 'idle';
  const buttonLabel = stage === 'saving'
    ? 'Saving job…'
    : stage === 'generating'
      ? 'Generating résumé and cover letter…'
      : 'Add job and generate application pack';

  return <form className={`card ${styles.form}`} onSubmit={submit}>
    <div className={styles.fields}>
      <label className={styles.label} htmlFor="manual-job-title">Job title
        <input className="input" id="manual-job-title" name="title" required maxLength={200} placeholder="e.g. Junior Software Developer" />
      </label>

      <label className={styles.label} htmlFor="manual-job-company">Company
        <input className="input" id="manual-job-company" name="company" required maxLength={200} placeholder="Company name" />
      </label>

      <label className={styles.label} htmlFor="manual-job-location"><span className={styles.heading}>Location <small>Optional</small></span>
        <input className="input" id="manual-job-location" name="location" maxLength={200} placeholder="e.g. Windsor, Ontario or Remote Canada" />
      </label>

      <label className={styles.label} htmlFor="manual-job-url"><span className={styles.heading}>Job link <small>Optional</small></span>
        <input className="input" id="manual-job-url" name="url" inputMode="url" maxLength={2048} placeholder="https://company.com/jobs/..." />
      </label>
    </div>

    <label className={styles.label} htmlFor="manual-job-description">Job description
      <textarea
        className={`textarea ${styles.description}`}
        id="manual-job-description"
        name="description"
        required
        minLength={100}
        maxLength={60000}
        placeholder="Paste the complete job description here…"
      />
    </label>

    <div className={styles.submit}>
      <div>
        <b>Uses the full application policy</b>
        <span>Verified evidence only · ATS optimization · claim checks · résumé and cover letter</span>
      </div>
      <button className="btn primary" type="submit" disabled={busy}>{buttonLabel}</button>
    </div>

    <div className="small muted" aria-live="polite">
      {stage === 'generating' ? 'The job is saved. Document generation can take a minute.' : message}
    </div>
    {message && savedJobId ? <a className="btn" href={`/jobs/${encodeURIComponent(savedJobId)}`}>Open saved job and retry</a> : null}
  </form>;
}
