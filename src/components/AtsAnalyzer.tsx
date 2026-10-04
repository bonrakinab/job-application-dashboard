'use client';

import { useState, type CSSProperties } from 'react';
import type { AtsAnalyzerResult, AtsCheckerResult } from '@/lib/ats-analyzer';
import { ATS_LLM_MODELS, DEFAULT_ATS_LLM_MODEL, atsLlmModelName, type AtsLlmModelId } from '@/lib/ats-models';

const FILE_ACCEPT = '.pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';

function scoreClass(score: number) {
  if (score >= 90) return 'excellent';
  if (score >= 80) return 'strong';
  if (score >= 70) return 'competitive';
  if (score >= 60) return 'tailor';
  return 'gaps';
}

function ScoreRing({ score, label }: { score: number; label: string }) {
  return <div className={`ats-score-ring ${scoreClass(score)}`} style={{ '--ats-score': score } as CSSProperties}>
    <div><b>{score}</b><span>{label}</span></div>
  </div>;
}

function ListSection({ title, items, tone }: { title: string; items: string[]; tone: 'good' | 'work' | 'improve' }) {
  return <section className={`ats-breakdown ${tone}`}>
    <h4>{title}</h4>
    {items.length ? <ul>{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
      : <p className="small muted">No items flagged.</p>}
  </section>;
}

function CheckerCard({ checker, defaultOpen }: { checker: AtsCheckerResult; defaultOpen?: boolean }) {
  return <details className="card ats-checker" open={defaultOpen}>
    <summary>
      <div>
        <span className="kicker">Internal checker</span>
        <h2>{checker.name}</h2>
        <p className="small muted">{checker.summary}</p>
      </div>
      <span className={`ats-checker-score ${scoreClass(checker.score)}`}>{checker.score}<small>/100</small></span>
    </summary>
    <div className="ats-checker-body">
      <div className="ats-metric-grid">
        {checker.metrics.map((metric) => <div className="ats-metric" key={metric.label}>
          <div className="row"><span>{metric.label}</span><b>{metric.score}</b></div>
          <div className="progress"><span style={{ width: `${metric.score}%` }}/></div>
        </div>)}
      </div>
      <div className="ats-breakdown-grid">
        <ListSection title="What is working" items={checker.good} tone="good" />
        <ListSection title="Needs work" items={checker.needsWork} tone="work" />
        <ListSection title="How to improve" items={checker.improvements} tone="improve" />
      </div>
    </div>
  </details>;
}

export function AtsAnalyzer() {
  const [resume, setResume] = useState<File | null>(null);
  const [jobFile, setJobFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [model, setModel] = useState<AtsLlmModelId>(DEFAULT_ATS_LLM_MODEL);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AtsAnalyzerResult | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState('');

  const canAnalyze = Boolean(resume && (jobFile || jobDescription.trim().length >= 80));
  const selectedModel = ATS_LLM_MODELS.find((option) => option.id === model) ?? ATS_LLM_MODELS[0];

  async function analyze() {
    if (!resume || !canAnalyze) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const form = new FormData();
      form.append('resume', resume);
      if (jobFile) form.append('jobDescriptionFile', jobFile);
      else form.append('jobDescription', jobDescription);
      form.append('jobTitle', jobTitle);
      form.append('company', company);
      form.append('location', location);
      form.append('model', model);
      const response = await fetch('/api/ats-analyzer', { method: 'POST', body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'The ATS analysis could not be completed.');
      setResult(payload as AtsAnalyzerResult);
      window.requestAnimationFrame(() => document.getElementById('ats-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function downloadReport() {
    if (!result) return;
    setReportBusy(true);
    setReportError('');
    try {
      const response = await fetch('/api/ats-analyzer/report.pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'The ATS report could not be downloaded.');
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const disposition = response.headers.get('Content-Disposition') ?? '';
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? 'ats-full-report.pdf';
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
    } catch (reason) {
      setReportError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setReportBusy(false);
    }
  }

  return <>
    <section className="card ats-upload-panel">
      <div className="ats-upload-grid">
        <div className="ats-file-card">
          <div className="ats-step">1</div>
          <div>
            <h2>Upload your résumé</h2>
            <p className="small muted">PDF, DOCX, or TXT · maximum 8 MB</p>
          </div>
          <label className="ats-file-picker">
            <span>{resume?.name || 'Choose résumé'}</span>
            <input type="file" accept={FILE_ACCEPT} onChange={(event) => setResume(event.target.files?.[0] ?? null)} />
          </label>
        </div>

        <div className="ats-file-card">
          <div className="ats-step">2</div>
          <div>
            <h2>Add the job description</h2>
            <p className="small muted">Upload a file or paste the complete description below.</p>
          </div>
          <label className="ats-file-picker">
            <span>{jobFile?.name || 'Upload job description'}</span>
            <input type="file" accept={FILE_ACCEPT} onChange={(event) => setJobFile(event.target.files?.[0] ?? null)} />
          </label>
          <div className="ats-or"><span>or paste text</span></div>
          <textarea
            className="textarea ats-jd-textarea"
            value={jobDescription}
            onChange={(event) => { setJobDescription(event.target.value); if (event.target.value) setJobFile(null); }}
            placeholder="Paste the full job description here…"
            disabled={Boolean(jobFile)}
          />
        </div>
      </div>

      <div className="divider" />
      <div className="ats-context-grid">
        <label><span>Job title <small>(optional)</small></span><input className="input" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="Auto-detected if blank" /></label>
        <label><span>Company <small>(optional)</small></span><input className="input" value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Target employer" /></label>
        <label><span>Location <small>(optional)</small></span><input className="input" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Not scored if blank" /></label>
      </div>
      <fieldset className="ats-model-section">
        <legend>Choose the LLM for this ATS score</legend>
        <p className="small muted">Your choice is used for both résumé extraction and job-fit analysis. The system will not silently substitute another model.</p>
        <div className="ats-model-grid">
          {ATS_LLM_MODELS.map((option) => <label className={`ats-model-option${model === option.id ? ' selected' : ''}`} key={option.id}>
            <input
              type="radio"
              name="ats-model"
              value={option.id}
              checked={model === option.id}
              onChange={() => setModel(option.id)}
              disabled={busy}
            />
            <span className="ats-model-radio" aria-hidden="true" />
            <span className="ats-model-copy">
              <span className="ats-model-heading"><b>{option.name}</b><small>{option.provider}</small></span>
              <span>{option.description}</span>
            </span>
          </label>)}
        </div>
      </fieldset>
      <div className="ats-run-row">
        <div>
          <b>Run every current internal checker</b>
          <p className="small muted">The files are processed for this analysis and are not saved to your profile or dashboard.</p>
        </div>
        <button className="btn primary ats-run-button" type="button" onClick={analyze} disabled={!canAnalyze || busy}>
          {busy ? `Analyzing with ${selectedModel.name}…` : `Check with ${selectedModel.name}`}
        </button>
      </div>
      {busy ? <div className="ats-processing" role="status"><span /><div><b>Running ATS checks with {selectedModel.name}</b><p className="small muted">Extracting evidence, comparing requirements, checking keywords, claims, and file structure. This can take a minute.</p></div></div> : null}
      {error ? <div className="blocker ats-error" role="alert">{error}</div> : null}
    </section>

    {result ? <section id="ats-results" className="ats-results">
      <div className="card ats-overview">
        <ScoreRing score={result.combinedScore} label={result.label} />
        <div className="ats-overview-copy">
          <span className="eyebrow">Combined internal estimate</span>
          <h2>{result.job.title}</h2>
          <p>{result.job.company}{result.job.location ? ` · ${result.job.location}` : ''}</p>
          <p className="small muted">Résumé: {result.resume.name} · {result.resume.format}{result.resume.pages ? ` · ${result.resume.pages} page${result.resume.pages === 1 ? '' : 's'}` : ''}</p>
          <div className="tag-list">
            {result.checkers.map((checker) => <span className="tag" key={checker.id}>{checker.name}: <b>{checker.score}</b></span>)}
          </div>
        </div>
        <div className="ats-overview-actions">
          <div className="ats-target-note"><b>{result.targetScore}/100</b><span>ambitious optimization target</span></div>
          <button className="btn ghost ats-download-button" type="button" onClick={downloadReport} disabled={reportBusy}>
            {reportBusy ? 'Preparing PDF…' : 'Download full report'}
          </button>
        </div>
      </div>

      {reportError ? <div className="blocker ats-error" role="alert">{reportError}</div> : null}

      <div className="ats-disclaimer">{result.disclaimer}</div>
      <div className="ats-checker-list">
        {result.checkers.map((checker, index) => <CheckerCard checker={checker} defaultOpen={index === 0} key={checker.id} />)}
      </div>

      <div className="card ats-method">
        <div><span className="kicker">Analysis details</span><h2>What was used</h2></div>
        <div className="ats-method-grid">
          <div><span>Selected model</span><b>{atsLlmModelName(result.models.selected)}</b></div>
          <div><span>Profile extraction</span><b>{result.models.profileExtraction}</b></div>
          <div><span>Job analysis</span><b>{result.models.jobAnalysis}</b></div>
          <div><span>Completed</span><b>{new Date(result.analyzedAt).toLocaleString()}</b></div>
        </div>
      </div>
    </section> : null}
  </>;
}
