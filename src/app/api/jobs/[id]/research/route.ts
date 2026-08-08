import { researchCompanyAndHiringTeam } from '@/lib/openai';
import { getJob, saveCompanyIntelligence } from '@/lib/store';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });
  try {
    const { research, model } = await researchCompanyAndHiringTeam(job);
    await saveCompanyIntelligence(job.company, research);
    return Response.json({ research, model });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
