import type { CandidateProfile } from './types';
import { coverLetterQualityIssues } from './cover-letter-tailoring';
import { getApplicationPack, getCandidateProfile, getJob } from './store';
import { supabaseConfigured, supabaseRequest } from './supabase-rest';
import { applicationPackStaleness } from './resume-tailoring';

export async function getCandidateProfileState(): Promise<{ profile: CandidateProfile; updatedAt?: string }> {
  if (!supabaseConfigured) return { profile: await getCandidateProfile() };
  const rows = await supabaseRequest<Array<{ profile: CandidateProfile; updated_at?: string }>>(
    'candidate_profiles?id=eq.default&select=profile,updated_at&limit=1',
  );
  if (rows[0]?.profile) return { profile: rows[0].profile, updatedAt: rows[0].updated_at };
  return { profile: await getCandidateProfile() };
}

export async function getApplicationPackState(jobId: string, profileUpdatedAt?: string) {
  const [pack, job] = await Promise.all([getApplicationPack(jobId), getJob(jobId)]);
  const effectiveProfileUpdatedAt = profileUpdatedAt ?? (await getCandidateProfileState()).updatedAt;
  const freshness = applicationPackStaleness(pack, effectiveProfileUpdatedAt);
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
