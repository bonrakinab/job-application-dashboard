import type { WebhookIntegration } from '@/lib/types';
import { deleteWebhookIntegration, listWebhookIntegrations, saveWebhookIntegration } from '@/lib/store';

function validWebhookUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function GET() {
  return Response.json(await listWebhookIntegrations());
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as WebhookIntegration & { secret?: string };
    if (!payload.name?.trim()) return Response.json({ error: 'Integration name is required.' }, { status: 400 });
    if (!validWebhookUrl(payload.webhookUrl ?? '')) return Response.json({ error: 'Use a valid HTTPS webhook URL.' }, { status: 400 });
    await saveWebhookIntegration({
      ...payload,
      kind: payload.kind === 'webhook' ? 'webhook' : 'n8n',
      events: Array.isArray(payload.events) && payload.events.length ? payload.events : ['job.match.updated', 'application.status.changed'],
      enabled: payload.enabled !== false,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'id is required.' }, { status: 400 });
  await deleteWebhookIntegration(id);
  return Response.json({ ok: true });
}
