import { scoreTailoredResume, type AtsReadinessScore } from './ats-score';
import type { ApplicationPack, CandidateProfile, Job, MatchScore } from './types';

export function scoreTailoredResumeWithCoursework(
  job: Job,
  profile: CandidateProfile,
  pack: ApplicationPack,
  match?: MatchScore,
): AtsReadinessScore {
  // The base scorer reads the same visible education/coursework text that the
  // PDF and DOCX render, so no hidden scoring-only content is introduced.
  return scoreTailoredResume(job, profile, pack, match);
}
