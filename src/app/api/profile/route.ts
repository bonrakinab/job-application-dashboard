import type { CandidateProfile } from '@/lib/types';
import { getCandidateProfileOptional, markJobMatchesStale, saveCandidateProfile } from '@/lib/store';
import { DEFAULT_PROFILE_ID, PART_TIME_PROFILE_ID } from '@/lib/part-time-jobs';

function requestedProfileId(request: Request) {
  const value = new URL(request.url).searchParams.get('profile') ?? DEFAULT_PROFILE_ID;
  return value === DEFAULT_PROFILE_ID || value === PART_TIME_PROFILE_ID ? value : null;
}

export async function GET(request: Request) {
  const profileId = requestedProfileId(request);
  if (!profileId) return Response.json({ error: 'Unknown profile.' }, { status: 400 });
  const profile = await getCandidateProfileOptional(profileId);
  return profile
    ? Response.json(profile)
    : Response.json({ error: 'Part-time résumé has not been uploaded yet.' }, { status: 404 });
}

export async function PUT(request: Request) {
  const profileId = requestedProfileId(request);
  if (!profileId) return Response.json({ error: 'Unknown profile.' }, { status: 400 });
  const profile = await request.json() as CandidateProfile;
  if (!profile.name || !Array.isArray(profile.skills) || !Array.isArray(profile.targetTitles)) return Response.json({ error: 'Invalid profile' }, { status: 400 });
  try {
    await saveCandidateProfile(profile, profileId);
    await markJobMatchesStale('profile-saved', profileId);
    const saved = await getCandidateProfileOptional(profileId);
    return Response.json({ ok: true, profile: saved });
  }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 }); }
}
