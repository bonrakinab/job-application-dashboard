import { createApplicationPack } from '@/lib/ai';
import { getCandidateProfile, getJob, saveApplicationPack } from '@/lib/store';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [job, profile] = await Promise.all([getJob(id), getCandidateProfile()]);
  if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });
  try {
    const { pack, model } = await createApplicationPack(job, profile, job.match);
    await saveApplicationPack(id, pack, model);
    return Response.json({ pack, model });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
