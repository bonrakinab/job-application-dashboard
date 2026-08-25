'use client';

import { useMemo, useState } from 'react';
import type { AnswerBankEntry } from '@/lib/types';

const STARTERS = [
  'Tell us about yourself.',
  'Why are you interested in this role?',
  'Why are you interested in this company?',
  'Describe a difficult technical problem you solved.',
  'What are your salary expectations?',
  'What is your work authorization status?',
  'Describe your experience with a technology relevant to this role.',
];

function tagsFromText(value: string) {
  return value.split(',').map((tag) => tag.trim()).filter(Boolean);
}

export function AnswerBankClient({ initialEntries }: { initialEntries: AnswerBankEntry[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | undefined>();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const visible = useMemo(() => entries.filter((entry) => {
    const text = `${entry.question} ${entry.answer} ${entry.tags.join(' ')}`.toLowerCase();
    return !query || text.includes(query.toLowerCase());
  }), [entries, query]);

  function reset() {
    setEditingId(undefined);
    setQuestion('');
    setAnswer('');
    setTags('');
  }

  function edit(entry: AnswerBankEntry) {
    setEditingId(entry.id);
    setQuestion(entry.question);
    setAnswer(entry.answer);
    setTags(entry.tags.join(', '));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save() {
    if (!question.trim()) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/answer-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, question, answer, tags: tagsFromText(tags) }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Could not save answer.');
      const refreshed = await fetch('/api/answer-bank', { cache: 'no-store' });
      setEntries(await refreshed.json());
      reset();
      setMessage('Saved. This answer is now reusable across applications.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id?: string) {
    if (!id || !window.confirm('Delete this saved answer?')) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/answer-bank?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not delete answer.');
      setEntries((current) => current.filter((entry) => entry.id !== id));
      if (editingId === id) reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return <>
    <div className="card">
      <h2>{editingId ? 'Edit answer' : 'Add an answer'}</h2>
      <div className="grid" style={{ gap: 10 }}>
        <input className="input" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Application question" />
        <textarea className="input" style={{ minHeight: 130, resize: 'vertical' }} value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Your answer" />
        <input className="input" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Optional tags" />
        <div className="row">
          <button className="btn primary" onClick={save} disabled={busy || !question.trim()}>{busy ? 'Saving…' : editingId ? 'Update answer' : 'Save answer'}</button>
          {editingId ? <button className="btn ghost" onClick={reset} disabled={busy}>Cancel</button> : null}
        </div>
        {message ? <div className="small muted">{message}</div> : null}
      </div>
    </div>

    <details className="advanced-panel">
      <summary>Choose a common question</summary>
      <div className="advanced-panel-body tag-list">{STARTERS.map((starter) => <button key={starter} className="btn ghost" onClick={() => setQuestion(starter)}>{starter}</button>)}</div>
    </details>

    <div className="section-head"><h2>Saved answers</h2><span className="small muted">{entries.length} total</span></div>
    <div className="searchbar"><input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search questions, answers or tags…" /></div>
    <div className="grid">
      {visible.map((entry) => <article className="card" key={entry.id ?? entry.question}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}><h3>{entry.question}</h3></div>
          <div className="row">
            <button className="btn ghost" onClick={() => edit(entry)}>Edit</button>
            <button className="btn danger" onClick={() => remove(entry.id)}>Delete</button>
          </div>
        </div>
        <details className="advanced-panel" style={{ marginTop: 0 }}><summary>View answer</summary><div className="advanced-panel-body small" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{entry.answer || <span className="muted">No answer written yet.</span>}</div></details>
        {entry.tags.length ? <div className="tag-list">{entry.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div> : null}
      </article>)}
      {!visible.length ? <div className="notice">No saved answer matches this search.</div> : null}
    </div>
  </>;
}
