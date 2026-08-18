import { analyzeJobWithAI, createApplicationPack, researchCompanyAndHiringTeam } from '@/lib/ai';
import { applicationPackEligibility } from '@/lib/application-pack-eligibility';
import { withPersistentApplicationSkills } from '@/lib/application-skill-policy';
import { getCandidateProfileState } from '@/lib/application-pack-state';
import { externalApplicationProfile } from '@/lib/application-visibility';
import { optimizeApplicationPackForAts } from '@/lib/ats-optimizer';
import { hasUsableJobDescription } from '@/lib/cover-letter-tailoring';
import { tailorRelevantCoursework } from '@/lib/education-tailoring';
import { isJobClosed, verifyJobAvailability } from '@/lib/job-validity';
import { withProfessionalCoverLetterAI } from '@/lib/professional-cover-letter-ai';
import { projectTailoredApplicationProfile } from '@/lib/project-tailoring';
import { attachApplicationPackGenerationMeta } from '@/lib/resume-tailoring';
import { getCompanyIntelligence, getJob, logActivity, saveApplicationPack, saveCompanyIntelligence, saveJobValidity, saveMatch } from '@/lib/store';
import type { MatchScore } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

function needsDetailedRequirementAnalysis(match: MatchScore | undefined, description: string) {
  if (!match) return true;
  const model = match.model ?? '';
  const noRequirements = !(match.mustHave?.length || match.preferred?.length || match.missingSkills?.length);
  return description.trim().length >= 300 && (model.startsWith('deterministic') || noRequirements);
}

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
        code: 'POSTING_CLOSED',
        verification,
      }, { status: 409 });
    }

    const employerProfile = externalApplicationProfile(profileState.profile);
    let match = job.match;
    if (needsDetailedRequirementAnalysis(match, job.description)) {
      const refreshed = await analyzeJobWithAI(job, employerProfile);
      const isDetailedModel = Boolean(refreshed.model && !refreshed.model.startsWith('deterministic'));
      if (isDetailedModel || !match) {
        match = refreshed;
        await saveMatch(id, refreshed);
      }
    }

    const eligibility = applicationPackEligibility(match);
    if (!eligibility.allowed) {
      await logActivity('application_pack.blocked', id, {
        jobId: id,
        company: job.company,
        title: job.title,
        recommendation: match?.recommendation ?? null,
        overall: match?.overall ?? null,
        code: eligibility.code,
        blockers: eligibility.blockers,
        at: new Date().toISOString(),
      });
      return Response.json({
        error: eligibility.reason,
        code: 'APPLICATION_PACK_BLOCKED',
        blockCode: eligibility.code,
        blockers: eligibility.blockers,
        match: match ? {
          overall: match.overall,
          recommendation: match.recommendation,
        } : null,
        verification,
      }, { status: 422 });
    }

    const applicationProfile = projectTailoredApplicationProfile(employerProfile, job);
    const generation = await createApplicationPack(job, applicationProfile, match);
    if (generation.fallbackReason) {
      await logActivity('application_pack.ai_fallback', id, {
        jobId: id,
        company: job.company,
        title: job.title,
        model: generation.model,
        providerUsed: generation.providerUsed,
        reason: generation.fallbackReason.slice(0, 1200),
        at: new Date().toISOString(),
      });
    }

    const skillsPolicyPack = withPersistentApplicationSkills(generation.pack, applicationProfile);
    const courseworkPack = {
      ...skillsPolicyPack,
      education: tailorRelevantCoursework(job, applicationProfile, match),
    };
    const optimized = optimizeApplicationPackForAts(job, applicationProfile, courseworkPack, match);

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

    const coverLetterInput = optimized.pack.atsOptimization?.attempts
      ? { ...optimized.pack, coverLetter: '' }
      : optimized.pack;
    const professionalPack = await withProfessionalCoverLetterAI(coverLetterInput, applicationProfile, job, match, research);
    const pack = attachApplicationPackGenerationMeta(professionalPack, {
      model: generation.model,
      provider: generation.providerUsed,
      profileUpdatedAt: profileState.updatedAt,
    });
    await saveApplicationPack(id, pack, generation.model);
    await logActivity('application_pack.completed', id, {
      jobId: id,
      company: job.company,
      title: job.title,
      provider: generation.providerUsed,
      model: generation.model,
      usedFallback: Boolean(generation.fallbackReason),
      ats: optimized.score.overall,
      atsStatus: optimized.score.status,
      at: new Date().toISOString(),
    });
    return Response.json({
      pack,
      model: generation.model,
      provider: generation.providerUsed,
      usedFallback: Boolean(generation.fallbackReason),
      verification,
      ats: optimized.score,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      await logActivity('application_pack.failed', id, {
        jobId: id,
        company: job.company,
        title: job.title,
        message: message.slice(0, 1600),
        at: new Date().toISOString(),
      });
    } catch {
      // Do not mask the primary generation error if diagnostics cannot be persisted.
    }
    return Response.json({ error: message, code: 'APPLICATION_PACK_FAILED' }, { status: 500 });
  }
}
