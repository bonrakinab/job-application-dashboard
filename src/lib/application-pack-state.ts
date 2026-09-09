import type { CandidateProfile, CandidateProfileId } from './types';
import { coverLetterQualityIssues } from './cover-letter-tailoring';
import { getApplicationPack, getCandidateProfile, getCandidateProfileOptional, getJob } from './store';
import { supabaseConfigured, supabaseRequest } from './supabase-rest';
import { applicationPackStaleness } from './resume-tailoring';
import { curateCandidateProfile, normalizePartTimeCandidateProfile } from './profile-curation';
import { DEFAULT_PROFILE_ID, PART_TIME_PROFILE_ID, profileIdForJob } from './part-time-jobs';

type LatestApplicationPackRun = {
  status: 'running' | 'completed' | 'blocked' | 'failed' | string;
  error?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  updated_at?: string | null;
};

function timestamp(value?: string | null) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function latestApplicationPackRun(jobId: string, profileId: CandidateProfileId): Promise<LatestApplicationPackRun | null> {
  if (!supabaseConfigured) return null;
  try {
    const rows = await supabaseRequest<LatestApplicationPackRun[]>(
      `application_pack_runs?job_id=eq.${encodeURIComponent(jobId)}&profile_id=eq.${encodeURIComponent(profileId)}&select=status,error,started_at,completed_at,updated_at&order=updated_at.desc&limit=1`,
    );
    return rows[0] ?? null;
  } catch {
    // A diagnostic lookup must never prevent the page or download route from loading.
    return null;
  }
}

export async function getCandidateProfileStateOptional(profileId: CandidateProfileId = DEFAULT_PROFILE_ID): Promise<{ profile: CandidateProfile; updatedAt?: string } | null> {
  if (!supabaseConfigured) {
    const profile = await getCandidateProfileOptional(profileId);
    return profile ? { profile } : null;
  }
  const rows = await supabaseRequest<Array<{ profile: CandidateProfile; updated_at?: string }>>(
    `candidate_profiles?id=eq.${encodeURIComponent(profileId)}&select=profile,updated_at&limit=1`,
  );
  if (!rows[0]?.profile) return null;
  return {
    profile: profileId === PART_TIME_PROFILE_ID
      ? normalizePartTimeCandidateProfile(rows[0].profile)
      : curateCandidateProfile(rows[0].profile),
    updatedAt: rows[0].updated_at,
  };
}

export async function getCandidateProfileState(profileId: CandidateProfileId = DEFAULT_PROFILE_ID): Promise<{ profile: CandidateProfile; updatedAt?: string }> {
  const state = await getCandidateProfileStateOptional(profileId);
  if (state) return state;
  return { profile: await getCandidateProfile(profileId) };
}

export async function getApplicationPackState(jobId: string, profileUpdatedAt?: string, requestedProfileId?: CandidateProfileId) {
  const job = await getJob(jobId);
  const profileId = requestedProfileId ?? (job ? profileIdForJob(job) : DEFAULT_PROFILE_ID);
  const [pack, latestRun] = await Promise.all([
    getApplicationPack(jobId, profileId),
    latestApplicationPackRun(jobId, profileId),
  ]);
  const effectiveProfileUpdatedAt = profileUpdatedAt ?? (await getCandidateProfileStateOptional(profileId))?.updatedAt;
  const freshness = applicationPackStaleness(pack, effectiveProfileUpdatedAt, profileId);
  const reasons = [...freshness.reasons];

  if (pack && job && coverLetterQualityIssues(pack.coverLetter ?? '', job).length) {
    reasons.push('The stored cover letter does not meet the current professional writing standard.');
  }
  if (pack && pack.claimVerification?.status !== 'pass') reasons.push('The stored pack needs its source evidence checked again.');
  if (pack && !pack.artifactValidation) reasons.push('Regenerate to validate both résumé download formats.');
  if (pack && !pack.atsOptimization) {
    reasons.push('The stored résumé predates the current evidence-grounded ATS diagnostics and internal optimization target.');
  }

  const generatedAt = timestamp(pack?.generationMeta?.generatedAt);
  const latestRunAt = timestamp(latestRun?.started_at) || timestamp(latestRun?.updated_at);
  if (pack && latestRun && latestRunAt > generatedAt && (latestRun.status === 'failed' || latestRun.status === 'blocked')) {
    const detail = latestRun.error?.replace(/\s+/g, ' ').trim().slice(0, 260);
    reasons.push(latestRun.status === 'failed'
      ? `The latest regeneration failed${detail ? `: ${detail}` : '.'}`
      : `The latest regeneration was blocked${detail ? `: ${detail}` : '.'}`);
  }

  return {
    pack,
    stale: reasons.length > 0,
    reasons: [...new Set(reasons)],
    profileUpdatedAt: effectiveProfileUpdatedAt,
    latestRun,
  };
}
