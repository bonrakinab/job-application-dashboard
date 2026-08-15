import { scoreTailoredResume, type AtsReadinessScore } from './ats-score';
import type { ApplicationPack, CandidateProfile, Job, MatchScore } from './types';

export function scoreTailoredResumeWithCoursework(
  job: Job,
  profile: CandidateProfile,
  pack: ApplicationPack,
  match?: MatchScore,
): AtsReadinessScore {
  const coursework = (pack.education ?? []).flatMap((item) => item.coursework ?? []).filter(Boolean);
  if (!coursework.length) return scoreTailoredResume(job, profile, pack, match);

  // The base scorer reads resume evidence from experience/projects. Mirror the actual
  // Education-section coursework there for scoring only, without presenting courses as skills.
  const scoringPack: ApplicationPack = {
    ...pack,
    projects: [
      ...pack.projects,
      {
        name: 'Relevant Coursework',
        bullets: coursework.map((course) => `Completed coursework: ${course}`),
      },
    ],
  };
  return scoreTailoredResume(job, profile, scoringPack, match);
}
