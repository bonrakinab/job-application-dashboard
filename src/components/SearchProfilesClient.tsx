'use client';

import { useState } from 'react';
import type { SearchProfile } from '@/lib/types';

function splitValues(value: string) {
  return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

const emptyProfile: SearchProfile = {
  id: '',
  name: '',
  description: '',
  targetTitles: [],
  includeKeywords: [],
  minMatch: 65,
  enabled: true,
};

export function SearchProfilesClient({ initialProfiles }: { initialProfiles: SearchProfile[] }) {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [draft, setDraft] = useState<SearchProfile>(emptyProfile);
  const [targetText, setTargetText] = useState('');
  const [keywordText, setKeywordText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  function edit(profile: SearchProfile) {
    setDraft(profile);
    setTargetText(profile.targetTitles.join('\n'));
    setKeywordText(profile.includeKeywords.join(', '));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function reset() {
    setDraft(emptyProfile);
    setTargetText('');
    setKeywordText('');
  }

  async function refresh() {
    const response = await fetch('/api/search-profiles', { cache: 'no-store' });
    setProfiles(await response.json());
  }

  async function save() {
    setBusy(true);
    setMessage('');
    try {
      const payload: SearchProfile = {
        ...draft,
        id: draft.id.trim().toLowerCase().replace(/\s+/g, '-'),
        targetTitles: splitValues(targetText),
        includeKeywords: splitValues(keywordText),
      };
      const response = await fetch('/api/search-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Could not save search profile.');
      await refresh();
      reset();
      setMessage('Search profile saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this saved search profile?')) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/search-profiles?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not delete search profile.');
      await refresh();
      if (draft.id === id) reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return <>
    <div className="card">
      <div className="kicker">{draft.id ? 'Edit search profile' : 'Create search profile'}</div>
      <div className="grid" style={{ gap: 10 }}>
        <div className="row">
          <input className="input" value={draft.id} onChange={(event) => setDraft({ ...draft, id: event.target.value })} placeholder="id, e.g. erp-oracle" disabled={Boolean(profiles.find((profile) => profile.id === draft.id))} />
          <input className="input" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Profile name" />
        </div>
        <input className="input" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="What this search is for" />
        <textarea className="input" style={{ minHeight: 135, resize: 'vertical' }} value={targetText} onChange={(event) => setTargetText(event.target.value)} placeholder={'Target job titles, one per line\nOracle Fusion Analyst\nERP Consultant'} />
        <input className="input" value={keywordText} onChange={(event) => setKeywordText(event.target.value)} placeholder="JD/title keywords, comma-separated" />
        <div className="row">
          <label className="small muted">Minimum match <input className="input" style={{ width: 90, marginLeft: 8 }} type="number" min={0} max={100} value={draft.minMatch} onChange={(event) => setDraft({ ...draft, minMatch: Number(event.target.value) })} /></label>
          <label className="small"><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} /> Enabled</label>
        </div>
        <div className="row">
          <button className="btn primary" onClick={save} disabled={busy || !draft.id.trim() || !draft.name.trim()}>{busy ? 'Saving…' : 'Save profile'}</button>
          {draft.id ? <button className="btn ghost" onClick={reset} disabled={busy}>New profile</button> : null}
        </div>
        {message ? <div className="small muted">{message}</div> : null}
      </div>
    </div>

    <div className="section-head"><h2>Saved profiles</h2><span className="small muted">Selecting one narrows the recommendation view without changing your master résumé profile.</span></div>
    <div className="recommendation-grid">
      {profiles.map((profile) => <article className="card recommendation-card" key={profile.id}>
        <div>
          <div className="kicker">{profile.enabled ? 'Enabled' : 'Disabled'} · min match {profile.minMatch}</div>
          <h3>{profile.name}</h3>
          <p className="small muted" style={{ lineHeight: 1.55 }}>{profile.description}</p>
        </div>
        <div className="tag-list">{profile.targetTitles.slice(0, 8).map((title) => <span className="tag" key={title}>{title}</span>)}</div>
        {profile.includeKeywords.length ? <div className="small muted">Keywords: {profile.includeKeywords.join(', ')}</div> : null}
        <div className="row recommendation-actions">
          <a className="btn primary" href={`/recommended?profile=${encodeURIComponent(profile.id)}`}>Open filtered jobs →</a>
          <button className="btn ghost" onClick={() => edit(profile)}>Edit</button>
          <button className="btn danger" onClick={() => remove(profile.id)} disabled={busy}>Delete</button>
        </div>
      </article>)}
    </div>
  </>;
}
