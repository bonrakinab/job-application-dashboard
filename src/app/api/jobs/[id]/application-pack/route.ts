import { createApplicationPack, selectedAIProvider } from '@/lib/ai';
import { getCandidateProfileState } from '@/lib/application-pack-state';
import { externalApplicationProfile } from '@/lib/application-visibility';
import { withJdProjectAlignedCoverLetter } from '@/lib/cover-letter-tailoring';
import { projectTailoredApplicationProfile } from '@/lib/project-tailoring';
import { attachApplicationPackGenerationMeta } from '@/lib/resume-tailoring';
import { getJob, saveApplicationPack } from '@/lib/store';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [job, profileState] = await Promise.all([getJob(id), getCandidateProfileState()]);
  if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });
  try {
    const employerProfile = externalApplicationProfile(profileState.profile);
    const applicationProfile = projectTailoredApplicationProfile(employerProfile, job);
    const { pack: generatedPack, model } = await createApplicationPack(job, applicationProfile, job.match);
    const alignedPack = withJdProjectAlignedCoverLetter(generatedPack, applicationProfile, job, job.match);
    const pack = attachApplicationPackGenerationMeta(alignedPack, {
      model,
      provider: selectedAIProvider(),
      profileUpdatedAt: profileState.updatedAt,
    });
    await saveApplicationPack(id, pack, model);
    return Response.json({ pack, model });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
