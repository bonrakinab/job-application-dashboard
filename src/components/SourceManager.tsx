'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AtsSource, SourceKind } from '@/lib/types';

export function SourceManager({ sources, canPersist }: { sources: AtsSource[]; canPersist: boolean }) {
  const router = useRouter();
  const [kind, setKind] = useState<SourceKind>('ashby');
  const [company, setCompany] = useState('');
  const [sourceKey, setSourceKey] = useState('');
  const [message, setMessage] = useState('');
  const [busyKey, setBusyKey] = useState('');

  async function add() {
    setBusyKey('add'); setMessage('');
    try {
      const response = await fetch('/api/sources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, company, sourceKey }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Could not add source');
      setCompany(''); setSourceKey(''); setMessage('Source saved.'); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusyKey(''); }
  }

  async function disable(source: AtsSource) {
    const key = `${source.kind}:${source.key}`;
    setBusyKey(key); setMessage('');
    try {
      const response = await fetch('/api/sources', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: source.kind, sourceKey: source.key, company: source.company }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Could not disable source');
      setMessage(`${source.company} disabled.`); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusyKey(''); }
  }

  return <div className="grid" style={{ gap: 12 }}>
    <div className="card">
      <div className="kicker">Add public ATS board</div>
      <div className="row">
        <select className="select" style={{ maxWidth: 170 }} value={kind} onChange={(event) => setKind(event.target.value as SourceKind)}><option value="ashby">Ashby</option><option value="lever">Lever</option><option value="greenhouse">Greenhouse</option></select>
        <input className="input" placeholder="Company name" value={company} onChange={(event) => setCompany(event.target.value)}/>
        <input className="input" placeholder="Board/site slug" value={sourceKey} onChange={(event) => setSourceKey(event.target.value)}/>
        <button className="btn primary" disabled={!canPersist || busyKey === 'add' || !company.trim() || !sourceKey.trim()} onClick={add}>{busyKey === 'add' ? 'Saving…' : 'Add source'}</button>
      </div>
      <p className="small muted">Examples: Ashby URL jobs.ashbyhq.com/cohere → <b>cohere</b>; Lever jobs.lever.co/getmaple → <b>getmaple</b>; Greenhouse job board ending in /clutch → <b>clutch</b>.</p>
      {message ? <div className="small muted">{message}</div> : null}
    </div>
    <div className="table-wrap"><table><thead><tr><th>ATS</th><th>Company</th><th>Board/site key</th><th></th></tr></thead><tbody>{sources.map((source) => {
      const key = `${source.kind}:${source.key}`;
      return <tr key={key}><td>{source.kind}</td><td>{source.company}</td><td>{source.key}</td><td><button className="btn" disabled={!canPersist || busyKey === key} onClick={() => disable(source)}>{busyKey === key ? 'Disabling…' : 'Disable'}</button></td></tr>;
    })}</tbody></table></div>
  </div>;
}
