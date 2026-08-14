import { testWebhookIntegration } from '@/lib/automations';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { id?: string };
    if (!body.id) return Response.json({ error: 'id is required.' }, { status: 400 });
    const result = await testWebhookIntegration(body.id);
    return Response.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
