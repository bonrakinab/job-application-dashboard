import { disableJobSource, saveJobSource } from '@/lib/store';

type SourceKind = 'greenhouse' | 'lever' | 'ashby';
const allowed = new Set<SourceKind>(['greenhouse', 'lever', 'ashby']);

export async function POST(request: Request) {
  const body = await request.json() as { kind?: SourceKind; sourceKey?: string; company?: string };
  if (!body.kind || !allowed.has(body.kind) || !body.sourceKey?.trim() || !body.company?.trim()) return Response.json({ error: 'kind, sourceKey and company are required.' }, { status: 400 });
  try {
    await saveJobSource(body.kind, body.sourceKey, body.company);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const body = await request.json() as { kind?: SourceKind; sourceKey?: string; company?: string };
  if (!body.kind || !allowed.has(body.kind) || !body.sourceKey?.trim()) return Response.json({ error: 'kind and sourceKey are required.' }, { status: 400 });
  try {
    await disableJobSource(body.kind, body.sourceKey, body.company ?? body.sourceKey);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
