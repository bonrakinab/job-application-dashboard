import { verifyJobAvailability } from '@/lib/job-validity';
import { getJob, saveJobValidity } from '@/lib/store';

export const runtime = 'nodejs';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });

  const verification = await verifyJobAvailability(job);
  await saveJobValidity(id, verification);
  return Response.json(verification);
}
