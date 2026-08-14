'use client';

import { useState } from 'react';

export function JobAnswerAssistant({ jobId }: { jobId: string }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [baseQuestion, setBaseQuestion] = useState('');
  const [provider, setProvider] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function generate() {
    if (!question.trim()) return;
    setBusy(true);
    setMessage('');
    setAnswer('');
    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/tailor-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Could not tailor an answer.');
      setAnswer(json.answer);
      setBaseQuestion(json.matchedBaseQuestion);
      setProvider(json.provider === 'none' ? 'base answer only' : `${json.provider} · ${json.model}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return <div className="card">
    <div className="kicker">Application answer assistant</div>
    <p className="small muted">Paste a question from the employer. The dashboard finds the closest completed answer-bank entry and adapts only those approved facts to this JD. Missing facts are marked instead of invented.</p>
    <textarea className="input" style={{ minHeight: 90, resize: 'vertical', marginBottom: 10 }} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Paste an application question…" />
    <div className="row">
      <button className="btn primary" onClick={generate} disabled={busy || !question.trim()}>{busy ? 'Preparing…' : 'Find & tailor answer'}</button>
      <a className="btn ghost" href="/answer-bank">Manage answer bank</a>
    </div>
    {message ? <div className="notice" style={{ marginTop: 12, marginBottom: 0 }}>{message}</div> : null}
    {answer ? <>
      <div className="divider"/>
      <div className="small muted">Matched base: <b>{baseQuestion}</b>{provider ? ` · ${provider}` : ''}</div>
      <p className="small" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{answer}</p>
    </> : null}
  </div>;
}
