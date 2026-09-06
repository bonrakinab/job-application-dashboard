import { analyzeJobWithAI } from '@/lib/ai';
import { getCandidateProfileOptional, getJob, saveMatch } from '@/lib/store';
import { PART_TIME_PROFILE_ID, profileIdForJob } from '@/lib/part-time-jobs';

export const runtime = 'nodejs';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });
  const profileId = profileIdForJob(job);
  const profile = await getCandidateProfileOptional(profileId);
  if (!profile) return Response.json({
    error: profileId === PART_TIME_PROFILE_ID
      ? 'Upload the separate part-time résumé before analyzing this job.'
      : 'Candidate profile is not configured.',
    code: 'CANDIDATE_PROFILE_REQUIRED',
    manageUrl: profileId === PART_TIME_PROFILE_ID ? '/part-time-jobs/profile' : '/settings',
  }, { status: 409 });
  const match = await analyzeJobWithAI(job, profile);
  await saveMatch(id, match, profileId);
  return Response.json({ ...match, profileId });
}
