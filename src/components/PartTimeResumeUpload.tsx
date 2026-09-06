'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function PartTimeResumeUpload({ hasProfile }: { hasProfile: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [inputKey, setInputKey] = useState(0);
  const router = useRouter();

  async function upload() {
    if (!file) return;
    setBusy(true);
    setMessage('');
    try {
      const form = new FormData();
      form.append('resume', file);
      const response = await fetch('/api/profile/resume-import', { method: 'POST', body: form });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Could not import the résumé.');
      const counts = json.counts ?? {};
      setMessage(`Résumé imported: ${counts.experience ?? 0} roles, ${counts.skills ?? 0} skills, and ${counts.education ?? 0} education entries.`);
      setFile(null);
      setInputKey((current) => current + 1);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return <section className="card profile-section">
    <div className="profile-section-head">
      <div>
        <h2>{hasProfile ? 'Replace part-time résumé' : 'Upload part-time résumé'}</h2>
        <p className="small muted">PDF, DOCX, or TXT · maximum 8 MB. This replaces the part-time profile only; your main career résumé remains unchanged.</p>
      </div>
      {hasProfile ? <span className="pill strong">Résumé ready</span> : <span className="pill">Required</span>}
    </div>
    <div className="linkedin-import-controls">
      <label className="linkedin-file-picker">
        <span>{file ? file.name : 'Choose résumé'}</span>
        <input
          key={inputKey}
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </label>
      <button className="btn primary" type="button" onClick={upload} disabled={!file || busy}>
        {busy ? 'Reading résumé…' : hasProfile ? 'Replace and import' : 'Import résumé'}
      </button>
    </div>
    <p className="small muted">{message || 'The file is parsed into verified profile evidence. The original file is not retained.'}</p>
  </section>;
}
