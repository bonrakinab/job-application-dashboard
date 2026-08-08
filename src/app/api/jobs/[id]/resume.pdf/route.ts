import { getApplicationPack, getCandidateProfile, getJob } from '@/lib/store';
import { resumePdf } from '@/lib/pdf';
import { slug } from '@/lib/utils';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [job, profile, pack] = await Promise.all([getJob(id), getCandidateProfile(), getApplicationPack(id)]);
  if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });
  if (!pack) return Response.json({ error: 'Generate the application pack first.' }, { status: 404 });
  const pdf = resumePdf(profile, job, pack);
  return new Response(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${slug(job.company)}-${slug(job.title)}-resume.pdf"` } });
}
