import { analyzeJobWithAI, createApplicationPack, deterministicApplicationPack, researchCompanyAndHiringTeam } from '@/lib/ai';
import { applicationPackEligibility } from '@/lib/application-pack-eligibility';
import { withPersistentApplicationSkills } from '@/lib/application-skill-policy';
import { getCandidateProfileStateOptional } from '@/lib/application-pack-state';
import { externalApplicationProfile } from '@/lib/application-visibility';
import { resumeDocx } from '@/lib/application-docx';
import { resumePdf } from '@/lib/application-pdf';
import { scoreTailoredResumeWithCoursework } from '@/lib/ats-coursework';
import { optimizeApplicationPackForAts } from '@/lib/ats-optimizer';
import { verifyApplicationPackClaims } from '@/lib/claim-verification';
import { buildProfessionalFallbackCoverLetter, hasUsableJobDescription } from '@/lib/cover-letter-tailoring';
import { profileWithTailoredCourseworkForResume, tailorRelevantCoursework } from '@/lib/education-tailoring';
import { isJobClosed, verifyJobAvailability } from '@/lib/job-validity';
import { DEFAULT_PROFILE_ID, PART_TIME_PROFILE_ID, profileIdForJob } from '@/lib/part-time-jobs';
import { withProfessionalCoverLetterAI } from '@/lib/professional-cover-letter-ai';
import { projectTailoredApplicationProfile } from '@/lib/project-tailoring';
import { buildRequirementEvidenceMatrix } from '@/lib/requirement-evidence';
import { assertResumeArtifact, validateResumeDocxArtifact, validateResumePdfArtifact } from '@/lib/resume-artifact-validation';
import { attachApplicationPackGenerationMeta } from '@/lib/resume-tailoring';
import {
  finishApplicationPackRun,
  getCompanyIntelligence,
  getJob,
  logActivity,
  recordApplicationPackStep,
  saveApplicationPack,
  saveCompanyIntelligence,
  saveJobValidity,
  saveMatch,
  startApplicationPackRun,
} from '@/lib/store';
import type { CandidateProfileId, MatchScore } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

export function needsDetailedRequirementAnalysis(match: MatchScore | undefined, description: string, profileId?: CandidateProfileId) {
  if (!match) return true;
  const model = match.model ?? '';
  const noRequirements = !(match.mustHave?.length || match.preferred?.length || match.missingSkills?.length);
  return model.startsWith('stale:')
    || Boolean(profileId && (match.profileId ?? DEFAULT_PROFILE_ID) !== profileId)
    || (description.trim().length >= 300 && (model.startsWith('deterministic') || noRequirements));
}

async function safeLogActivity(event: string, jobId: string | undefined, payload: unknown) {
  try {
    await logActivity(event, jobId, payload);
  } catch {
    // Diagnostics must never make an otherwise valid application-pack request fail.
  }
}

async function safeStartRun(jobId: string, profileId: CandidateProfileId) {
  try {
    return await startApplicationPackRun(jobId, profileId);
  } catch {
    return undefined;
  }
}

async function safeRecordStep(runId: string | undefined, step: string, details: Record<string, unknown> = {}) {
  try {
    await recordApplicationPackStep(runId, step, details);
  } catch {
    // Workflow diagnostics must not prevent document generation.
  }
}

async function safeFinishRun(runId: string | undefined, status: 'completed' | 'blocked' | 'failed', error?: string) {
  try {
    await finishApplicationPackRun(runId, status, error);
  } catch {
    // Workflow diagnostics must not prevent document generation.
  }
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });
  const profileId = profileIdForJob(job);
  const profileState = await getCandidateProfileStateOptional(profileId);
  if (!profileState) return Response.json({
    error: profileId === PART_TIME_PROFILE_ID
      ? 'Upload the separate part-time résumé before generating this application pack.'
      : 'Candidate profile is not configured.',
    code: 'CANDIDATE_PROFILE_REQUIRED',
    profileId,
    manageUrl: profileId === PART_TIME_PROFILE_ID ? '/part-time-jobs/profile' : '/settings',
  }, { status: 409 });
  const runId = await safeStartRun(id, profileId);
  try {
    const verification = await verifyJobAvailability(job);
    await saveJobValidity(id, verification);
    await safeRecordStep(runId, 'posting_verification', {
      validityStatus: verification.validityStatus,
      healthScore: verification.healthScore,
    });
    if (isJobClosed(verification.validityStatus)) {
      await safeFinishRun(runId, 'blocked', verification.closureReason || 'Posting closed');
      return Response.json({
        error: verification.closureReason || 'This posting appears to be closed or no longer applyable. Application-pack generation was stopped.',
        code: 'POSTING_CLOSED',
        verification,
      }, { status: 409 });
    }

    const employerProfile = externalApplicationProfile(profileState.profile);
    let match = job.match;
    if (needsDetailedRequirementAnalysis(match, job.description, profileId)) {
      const requiresProfileRefresh = !match || match.model?.startsWith('stale:') === true || (match.profileId ?? DEFAULT_PROFILE_ID) !== profileId;
      const refreshed = await analyzeJobWithAI(job, employerProfile);
      const isDetailedModel = Boolean(refreshed.model && !refreshed.model.startsWith('deterministic'));
      if (isDetailedModel || requiresProfileRefresh) {
        match = refreshed;
        await saveMatch(id, refreshed, profileId);
      }
    }
    await safeRecordStep(runId, 'requirement_analysis', {
      mustHave: match?.mustHave?.length ?? 0,
      preferred: match?.preferred?.length ?? 0,
      model: match?.model ?? 'existing',
    });

    const eligibility = applicationPackEligibility(match);
    if (eligibility.conditional) {
      await safeLogActivity('application_pack.gap_aware', id, {
        jobId: id,
        company: job.company,
        title: job.title,
        recommendation: match?.recommendation ?? null,
        overall: match?.overall ?? null,
        code: eligibility.code,
        blockers: eligibility.blockers,
        at: new Date().toISOString(),
      });
    }

    const applicationProfile = projectTailoredApplicationProfile(employerProfile, job);
    const requirementEvidence = buildRequirementEvidenceMatrix(job, applicationProfile, match);
    await safeRecordStep(runId, 'evidence_alignment', {
      requirements: requirementEvidence.length,
      supported: requirementEvidence.filter((item) => item.support === 'supported').length,
      partial: requirementEvidence.filter((item) => item.support === 'partial').length,
      gaps: requirementEvidence.filter((item) => item.support === 'gap').length,
    });
    const generation = await createApplicationPack(job, applicationProfile, match, requirementEvidence);
    await safeRecordStep(runId, 'document_generation', {
      provider: generation.providerUsed,
      model: generation.model,
      usedFallback: Boolean(generation.fallbackReason),
    });
    if (generation.fallbackReason) {
      await safeLogActivity('application_pack.ai_fallback', id, {
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
      requirementEvidence,
    };
    const documentProfile = profileWithTailoredCourseworkForResume(applicationProfile, courseworkPack);
    const optimized = optimizeApplicationPackForAts(job, documentProfile, courseworkPack, match);
    await safeRecordStep(runId, 'ats_optimization', {
      score: optimized.score.overall,
      status: optimized.score.status,
      attempts: optimized.pack.atsOptimization?.attempts ?? 0,
    });

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
    const deterministic = deterministicApplicationPack(job, applicationProfile, match);
    const verifiedPack = verifyApplicationPackClaims(professionalPack, {
      resumeSummary: deterministic.resumeSummary,
      coverLetter: buildProfessionalFallbackCoverLetter(professionalPack, applicationProfile, job, match, research),
      outreachMessage: deterministic.outreachMessage,
    }, applicationProfile, job, match);
    if (verifiedPack.claimVerification?.status !== 'pass') {
      await safeFinishRun(runId, 'blocked', 'Unresolved source-evidence checks');
      return Response.json({ error: 'Some claims could not be verified against your résumé. Review the source profile before regenerating.', claims: verifiedPack.claimsAudit.filter((claim) => claim.status === 'review') }, { status: 422 });
    }
    const renderedProfile = profileWithTailoredCourseworkForResume(applicationProfile, verifiedPack);
    const finalScore = scoreTailoredResumeWithCoursework(job, renderedProfile, verifiedPack, match);
    const finalOptimizedPack = verifiedPack.atsOptimization ? {
      ...verifiedPack,
      atsOptimization: {
        ...verifiedPack.atsOptimization,
        finalScore: finalScore.overall,
        status: finalScore.status,
        truthfulCeilingReached: !finalScore.eligibleToApply && verifiedPack.atsOptimization.attempts >= 3,
      },
    } : verifiedPack;
    const pdf = resumePdf(renderedProfile, job, finalOptimizedPack);
    const docx = await resumeDocx(renderedProfile, job, finalOptimizedPack);
    const [pdfValidation, docxValidation] = await Promise.all([
      validateResumePdfArtifact(pdf, renderedProfile, finalOptimizedPack),
      validateResumeDocxArtifact(docx, renderedProfile, finalOptimizedPack),
    ]);
    assertResumeArtifact(pdfValidation, 'PDF');
    assertResumeArtifact(docxValidation, 'DOCX');
    await safeRecordStep(runId, 'artifact_validation', {
      pdfParseCoverage: pdfValidation.parseCoverage,
      docxParseCoverage: docxValidation.parseCoverage,
      sectionOrderValid: pdfValidation.sectionOrderValid && docxValidation.sectionOrderValid,
      structuralIssues: [...pdfValidation.structuralIssues, ...docxValidation.structuralIssues],
    });
    await safeRecordStep(runId, 'claim_verification', {
      status: verifiedPack.claimVerification?.status ?? 'review',
      checkedClaims: verifiedPack.claimVerification?.checkedClaims ?? 0,
      replacedFields: verifiedPack.claimVerification?.replacedFields ?? [],
      replacedBullets: verifiedPack.claimVerification?.replacedBullets ?? 0,
    });
    const pack = attachApplicationPackGenerationMeta({
      ...finalOptimizedPack,
      artifactValidation: {
        validatedAt: new Date().toISOString(),
        pdfParseCoverage: pdfValidation.parseCoverage,
        docxParseCoverage: docxValidation.parseCoverage,
        sectionOrderValid: pdfValidation.sectionOrderValid && docxValidation.sectionOrderValid,
      },
      requirementEvidence,
    }, {
      model: generation.model,
      provider: generation.providerUsed,
      profileUpdatedAt: profileState.updatedAt,
      workflowRunId: runId,
      profileId,
    });
    await saveApplicationPack(id, pack, generation.model, profileId);
    await safeRecordStep(runId, 'saved', { ats: finalScore.overall, atsStatus: finalScore.status });
    await safeFinishRun(runId, 'completed');
    await safeLogActivity('application_pack.completed', id, {
      jobId: id,
      company: job.company,
      title: job.title,
      provider: generation.providerUsed,
      model: generation.model,
      usedFallback: Boolean(generation.fallbackReason),
      ats: finalScore.overall,
      atsStatus: finalScore.status,
      gapAware: eligibility.conditional,
      remainingBlockers: optimized.score.hardBlockers,
      at: new Date().toISOString(),
    });
    return Response.json({
      pack,
      model: generation.model,
      provider: generation.providerUsed,
      usedFallback: Boolean(generation.fallbackReason),
      verification,
      ats: finalScore,
      eligibility,
      workflowRunId: runId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await safeFinishRun(runId, 'failed', message);
    await safeLogActivity('application_pack.failed', id, {
      jobId: id,
      company: job.company,
      title: job.title,
      message: message.slice(0, 1600),
      at: new Date().toISOString(),
    });
    return Response.json({ error: message, code: 'APPLICATION_PACK_FAILED' }, { status: 500 });
  }
}
