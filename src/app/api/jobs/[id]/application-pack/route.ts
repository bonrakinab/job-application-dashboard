import { createApplicationPack, researchCompanyAndHiringTeam, selectedAIProvider } from '@/lib/ai';
import { withPersistentApplicationSkills } from '@/lib/application-skill-policy';
import { getCandidateProfileState } from '@/lib/application-pack-state';
import { externalApplicationProfile } from '@/lib/application-visibility';
import { hasUsableJobDescription } from '@/lib/cover-letter-tailoring';
import { isJobClosed, verifyJobAvailability } from '@/lib/job-validity';
import { withProfessionalCoverLetterAI } from '@/lib/professional-cover-letter-ai';
import { projectTailoredApplicationProfile } from '@/lib/project-tailoring';
import { attachApplicationPackGenerationMeta } from '@/lib/resume-tailoring';
import { getCompanyIntelligence, getJob, saveApplicationPack, saveCompanyIntelligence, saveJobValidity } from '@/lib/store';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [job, profileState] = await Promise.all([getJob(id), getCandidateProfileState()]);
  if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });
  try {
    const verification = await verifyJobAvailability(job);
    await saveJobValidity(id, verification);
    if (isJobClosed(verification.validityStatus)) {
      return Response.json({
        error: verification.closureReason || 'This posting appears to be closed or no longer applyable. Application-pack generation was stopped.',
        verification,
      }, { status: 409 });
    }

    const employerProfile = externalApplicationProfile(profileState.profile);
    const applicationProfile = projectTailoredApplicationProfile(employerProfile, job);
    const { pack: generatedPack, model } = await createApplicationPack(job, applicationProfile, job.match);

    let research = await getCompanyIntelligence(job.company);
    if (!research && !hasUsableJobDescription(job) && process.env.OPENAI_API_KEY) {
      try {
        const result = await researchCompanyAndHiringTeam(job);
        research = result.research;
        await saveCompanyIntelligence(job.company, result.research);
      } catch {
        // Sparse JDs benefit from company context, but cover-letter generation must still work if research is unavailable.
      }
    }

    const professionalPack = await withProfessionalCoverLetterAI(generatedPack, applicationProfile, job, job.match, research);
    const skillsPolicyPack = withPersistentApplicationSkills(professionalPack, applicationProfile);
    const pack = attachApplicationPackGenerationMeta(skillsPolicyPack, {
      model,
      provider: selectedAIProvider(),
      profileUpdatedAt: profileState.updatedAt,
    });
    await saveApplicationPack(id, pack, model);
    return Response.json({ pack, model, verification });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
