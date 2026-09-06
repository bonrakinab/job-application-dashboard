import { extractPartTimeResumeProfile } from '@/lib/ai';
import { PART_TIME_PROFILE_ID } from '@/lib/part-time-jobs';
import { extractResumeFileText } from '@/lib/resume-file-text';
import { partTimeProfileFromResumeExtraction } from '@/lib/resume-profile-import';
import { logActivity, markJobMatchesStale, saveCandidateProfile } from '@/lib/store';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get('resume');
    if (!(file instanceof File)) return Response.json({ error: 'Choose a résumé file first.' }, { status: 400 });

    const text = await extractResumeFileText(file);
    const { extraction, model } = await extractPartTimeResumeProfile(text, file.name);
    const profile = partTimeProfileFromResumeExtraction(extraction);
    if (!profile.name.trim()) throw new Error('A candidate name could not be identified in the résumé.');
    if (!(profile.experience?.length || profile.skills.length || profile.degrees?.length)) {
      throw new Error('The résumé did not contain enough usable profile evidence.');
    }

    await saveCandidateProfile(profile, PART_TIME_PROFILE_ID);
    await markJobMatchesStale('part-time-resume-imported', PART_TIME_PROFILE_ID);
    await logActivity('part_time.resume.imported', undefined, {
      fileName: file.name.slice(0, 180),
      model,
      skills: profile.skills.length,
      experience: profile.experience?.length ?? 0,
      education: profile.degrees?.length ?? 0,
      certifications: profile.certifications?.length ?? 0,
      importedAt: new Date().toISOString(),
    });

    return Response.json({
      ok: true,
      profile,
      model,
      counts: {
        skills: profile.skills.length,
        experience: profile.experience?.length ?? 0,
        education: profile.degrees?.length ?? 0,
        certifications: profile.certifications?.length ?? 0,
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
