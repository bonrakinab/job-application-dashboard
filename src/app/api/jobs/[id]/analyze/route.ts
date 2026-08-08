import { analyzeJobWithAI } from '@/lib/ai';
import { getCandidateProfile, getJob, saveMatch } from '@/lib/store';

export const runtime = 'nodejs';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [job, profile] = await Promise.all([getJob(id), getCandidateProfile()]);
  if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });
  const match = await analyzeJobWithAI(job, profile);
  await saveMatch(id, match);
  return Response.json(match);
}
