import { getApplicationPackState, getCandidateProfileState } from '@/lib/application-pack-state';
import { coverLetterPdf } from '@/lib/indeed-cover-letter-pdf';
import { getJob } from '@/lib/store';
import { slug } from '@/lib/utils';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [job, profileState] = await Promise.all([getJob(id), getCandidateProfileState()]);
  if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });
  const packState = await getApplicationPackState(id, profileState.updatedAt);
  if (!packState.pack) return Response.json({ error: 'Generate the application pack first.' }, { status: 404 });
  if (packState.stale) {
    return Response.json({ error: 'This cover letter is outdated. Regenerate the application pack before downloading.', reasons: packState.reasons }, { status: 409 });
  }
  const pdf = coverLetterPdf(profileState.profile, job, packState.pack);
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${slug(job.company)}-${slug(job.title)}-cover-letter.pdf"`,
    },
  });
}
