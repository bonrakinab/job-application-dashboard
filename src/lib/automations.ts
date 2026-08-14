import { supabaseConfigured, supabaseRequest } from './supabase-rest';

interface WebhookRow {
  id: number;
  name: string;
  kind: 'n8n' | 'webhook';
  webhook_url: string;
  secret: string | null;
  events: string[] | null;
  enabled: boolean;
}

async function enabledIntegrations() {
  if (!supabaseConfigured) return [] as WebhookRow[];
  try {
    return await supabaseRequest<WebhookRow[]>('webhook_integrations?enabled=eq.true&select=id,name,kind,webhook_url,secret,events,enabled');
  } catch {
    return [] as WebhookRow[];
  }
}

async function postEvent(row: WebhookRow, event: string, payload: unknown) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(row.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(row.secret ? { 'X-Job-Agent-Secret': row.secret } : {}),
      },
      body: JSON.stringify({
        source: 'job-agent',
        event,
        occurredAt: new Date().toISOString(),
        payload,
      }),
      signal: controller.signal,
      cache: 'no-store',
    });
    return { id: row.id, name: row.name, ok: response.ok, status: response.status };
  } catch {
    return { id: row.id, name: row.name, ok: false, status: 0 };
  } finally {
    clearTimeout(timeout);
  }
}

export async function dispatchAutomationEvent(event: string, payload: unknown) {
  const rows = (await enabledIntegrations()).filter((row) => {
    const events = row.events ?? [];
    return events.length === 0 || events.includes('*') || events.includes(event);
  });
  if (!rows.length) return { attempted: 0, delivered: 0 };
  const results = await Promise.all(rows.map((row) => postEvent(row, event, payload)));
  return {
    attempted: results.length,
    delivered: results.filter((result) => result.ok).length,
  };
}

export async function testWebhookIntegration(id: string) {
  if (!supabaseConfigured) throw new Error('Supabase is required for webhook integrations.');
  const rows = await supabaseRequest<WebhookRow[]>(`webhook_integrations?id=eq.${encodeURIComponent(id)}&select=id,name,kind,webhook_url,secret,events,enabled&limit=1`);
  const row = rows[0];
  if (!row) throw new Error('Integration not found.');
  return postEvent(row, 'integration.test', { message: 'Job Agent webhook test' });
}
