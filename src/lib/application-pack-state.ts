import type { CandidateProfile } from './types';
import { getApplicationPack, getCandidateProfile } from './store';
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
  const pack = await getApplicationPack(jobId);
  const effectiveProfileUpdatedAt = profileUpdatedAt ?? (await getCandidateProfileState()).updatedAt;
  const freshness = applicationPackStaleness(pack, effectiveProfileUpdatedAt);
  return { pack, ...freshness, profileUpdatedAt: effectiveProfileUpdatedAt };
}
