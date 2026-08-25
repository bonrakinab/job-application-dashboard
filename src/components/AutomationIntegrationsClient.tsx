'use client';

import { useState } from 'react';
import type { WebhookIntegration } from '@/lib/types';

const EVENT_OPTIONS = [
  { value: 'job.match.updated', label: 'Job match analyzed / updated' },
  { value: 'application.status.changed', label: 'Application status changed' },
];

export function AutomationIntegrationsClient({ initialIntegrations }: { initialIntegrations: WebhookIntegration[] }) {
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [id, setId] = useState<string | undefined>();
  const [name, setName] = useState('n8n Job Agent');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [events, setEvents] = useState<string[]>(EVENT_OPTIONS.map((item) => item.value));
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function refresh() {
    const response = await fetch('/api/integrations', { cache: 'no-store' });
    setIntegrations(await response.json());
  }

  function reset() {
    setId(undefined);
    setName('n8n Job Agent');
    setWebhookUrl('');
    setSecret('');
    setEvents(EVENT_OPTIONS.map((item) => item.value));
    setEnabled(true);
  }

  function edit(item: WebhookIntegration) {
    setId(item.id);
    setName(item.name);
    setWebhookUrl(item.webhookUrl);
    setSecret('');
    setEvents(item.events);
    setEnabled(item.enabled);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function toggleEvent(value: string) {
    setEvents((current) => current.includes(value) ? current.filter((event) => event !== value) : [...current, value]);
  }

  async function save() {
    setBusy(true);
    setMessage('');
    try {
      const payload: Record<string, unknown> = { id, name, kind: 'n8n', webhookUrl, events, enabled };
      if (secret.trim()) payload.secret = secret;
      const response = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Could not save integration.');
      await refresh();
      reset();
      setMessage('Integration saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function testIntegration(itemId?: string) {
    if (!itemId) return;
    setBusy(true);
    setMessage('Sending test event…');
    try {
      const response = await fetch('/api/integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || `Webhook returned ${json.status ?? 'an error'}.`);
      setMessage(`Test delivered successfully (HTTP ${json.status}).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function remove(itemId?: string) {
    if (!itemId || !window.confirm('Delete this automation integration?')) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/integrations?id=${encodeURIComponent(itemId)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not delete integration.');
      await refresh();
      if (id === itemId) reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return <>
    <div className="card">
      <h2>{id ? 'Edit automation' : 'Connect a webhook'}</h2>
      <div className="grid" style={{ gap: 10 }}>
        <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Integration name" />
        <input className="input" value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} placeholder="https://your-n8n-host/webhook/job-agent" />
        <details className="advanced-panel" style={{ marginTop: 0 }}><summary>Security</summary><div className="advanced-panel-body"><input className="input" type="password" value={secret} onChange={(event) => setSecret(event.target.value)} placeholder={id ? 'Secret (leave blank to keep existing)' : 'Optional shared secret'} /></div></details>
        <div className="grid" style={{ gap: 8 }}>
          {EVENT_OPTIONS.map((option) => <label className="small" key={option.value}>
            <input type="checkbox" checked={events.includes(option.value)} onChange={() => toggleEvent(option.value)} /> {option.label}
          </label>)}
          <label className="small"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Enabled</label>
        </div>
        <div className="row">
          <button className="btn primary" onClick={save} disabled={busy || !name.trim() || !webhookUrl.trim()}>{busy ? 'Working…' : 'Save integration'}</button>
          {id ? <button className="btn ghost" onClick={reset} disabled={busy}>New integration</button> : null}
        </div>
        {message ? <div className="small muted">{message}</div> : null}
      </div>
    </div>

    <div className="section-head"><h2>Connected automations</h2><span className="small muted">{integrations.length} total</span></div>
    <div className="grid">
      {integrations.map((item) => <article className="card" key={item.id}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3>{item.name}</h3>
            <div className="small muted" style={{ overflowWrap: 'anywhere' }}>{item.webhookUrl}</div>
          </div>
          <span className="tag">{item.enabled ? 'Enabled' : 'Disabled'}</span>
        </div>
        <div className="tag-list">{item.events.map((event) => <span className="tag" key={event}>{EVENT_OPTIONS.find((option) => option.value === event)?.label ?? event}</span>)}</div>
        <div className="row">
          <button className="btn primary" onClick={() => testIntegration(item.id)} disabled={busy}>Send test</button>
          <button className="btn ghost" onClick={() => edit(item)}>Edit</button>
          <button className="btn danger" onClick={() => remove(item.id)} disabled={busy}>Delete</button>
        </div>
      </article>)}
      {!integrations.length ? <div className="notice">No automations are connected.</div> : null}
    </div>
  </>;
}
