import { createOutreachDraft } from '@/lib/gmail';
import { getApplicationPack, getJob } from '@/lib/store';

export const runtime = 'nodejs';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [job, pack] = await Promise.all([getJob(id), getApplicationPack(id)]);
  if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });
  if (!pack) return Response.json({ error: 'Generate the application pack first.' }, { status: 400 });
  try {
    const result = await createOutreachDraft(`Interest in ${job.title} — ${job.company}`, pack.outreachMessage);
    return Response.json({ ok: true, draft: result });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
