import { externalApplicationProfile } from '@/lib/application-visibility';
import { projectTailoredApplicationProfile } from '@/lib/project-tailoring';
import { getApplicationPackState, getCandidateProfileStateOptional } from '@/lib/application-pack-state';
import { profileWithTailoredCourseworkForResume } from '@/lib/education-tailoring';
import { getJob } from '@/lib/store';
import { resumePdf } from '@/lib/application-pdf';
import { assertResumeArtifact, validateResumePdfArtifact } from '@/lib/resume-artifact-validation';
import { referenceTemplatePack, referenceTemplateProfile } from '@/lib/resume-generation-policy';
import { slug } from '@/lib/utils';
import { PART_TIME_PROFILE_ID, profileIdForJob } from '@/lib/part-time-jobs';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });
  const profileId = profileIdForJob(job);
  const profileState = await getCandidateProfileStateOptional(profileId);
  if (!profileState) return Response.json({ error: profileId === PART_TIME_PROFILE_ID ? 'Upload the separate part-time résumé first.' : 'Candidate profile is not configured.' }, { status: 409 });
  const packState = await getApplicationPackState(id, profileState.updatedAt, profileId);
  if (!packState.pack) return Response.json({ error: 'Generate the application pack first.' }, { status: 404 });
  if (packState.stale) {
    return Response.json({ error: 'This tailored resume is outdated. Regenerate the application pack before downloading.', reasons: packState.reasons }, { status: 409 });
  }
  const baseProfile = profileWithTailoredCourseworkForResume(projectTailoredApplicationProfile(externalApplicationProfile(profileState.profile), job), packState.pack);
  const resumeProfile = referenceTemplateProfile(baseProfile);
  const resumePack = referenceTemplatePack(packState.pack);
  const pdf = resumePdf(resumeProfile, job, resumePack);
  assertResumeArtifact(await validateResumePdfArtifact(pdf, resumeProfile, resumePack), 'PDF');
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${slug(job.company)}-${slug(job.title)}-resume.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
