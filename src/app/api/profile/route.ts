import type { CandidateProfile } from '@/lib/types';
import { getCandidateProfile, markJobMatchesStale, saveCandidateProfile } from '@/lib/store';
import { curateCandidateProfile } from '@/lib/profile-curation';

export async function GET() { return Response.json(await getCandidateProfile()); }

export async function PUT(request: Request) {
  const profile = await request.json() as CandidateProfile;
  if (!profile.name || !Array.isArray(profile.skills) || !Array.isArray(profile.targetTitles)) return Response.json({ error: 'Invalid profile' }, { status: 400 });
  try {
    const curated = curateCandidateProfile(profile);
    await saveCandidateProfile(curated);
    await markJobMatchesStale('profile-saved');
    return Response.json({ ok: true, profile: curated });
  }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 }); }
}
