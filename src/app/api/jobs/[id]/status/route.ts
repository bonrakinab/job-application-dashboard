import type { ApplicationStatus } from '@/lib/types';
import { updateApplicationStatus } from '@/lib/store';

const allowed = new Set<ApplicationStatus>(['discovered','reviewing','approved','applied','interview','rejected','offer','withdrawn']);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json() as { status?: ApplicationStatus; notes?: string };
  if (!body.status || !allowed.has(body.status)) return Response.json({ error: 'Invalid status' }, { status: 400 });
  await updateApplicationStatus(id, body.status, body.notes);
  return Response.json({ ok: true });
}
