import type { CandidateProfile, CandidateProfileId } from './types';
import { coverLetterQualityIssues } from './cover-letter-tailoring';
import { getApplicationPack, getCandidateProfile, getCandidateProfileOptional, getJob } from './store';
import { supabaseConfigured, supabaseRequest } from './supabase-rest';
import { applicationPackStaleness } from './resume-tailoring';
import { curateCandidateProfile, normalizePartTimeCandidateProfile } from './profile-curation';
import { DEFAULT_PROFILE_ID, PART_TIME_PROFILE_ID, profileIdForJob } from './part-time-jobs';

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
  const pack = await getApplicationPack(jobId, profileId);
  const effectiveProfileUpdatedAt = profileUpdatedAt ?? (await getCandidateProfileStateOptional(profileId))?.updatedAt;
  const freshness = applicationPackStaleness(pack, effectiveProfileUpdatedAt, profileId);
  const reasons = [...freshness.reasons];

  if (pack && job && coverLetterQualityIssues(pack.coverLetter ?? '', job).length) {
    reasons.push('The stored cover letter does not meet the current professional writing standard.');
  }
  if (pack && !pack.atsOptimization) {
    reasons.push('The stored resume predates the current 90-point ATS pass standard and automatic truthful optimization.');
  }

  return {
    pack,
    stale: reasons.length > 0,
    reasons: [...new Set(reasons)],
    profileUpdatedAt: effectiveProfileUpdatedAt,
  };
}
