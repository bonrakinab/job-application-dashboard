import { scoreTailoredResume, type AtsReadinessScore } from './ats-score';
import { finalResumeArtifactState } from './resume-generation-policy';
import type { ApplicationPack, CandidateProfile, Job, MatchScore } from './types';

export function scoreTailoredResumeWithCoursework(
  job: Job,
  profile: CandidateProfile,
  pack: ApplicationPack,
  match?: MatchScore,
): AtsReadinessScore {
  // Every ATS audit must score the exact employer-facing artifact. This removes
  // hidden headline/coursework/project-tech fields before scoring, just as the
  // PDF and DOCX routes do.
  const finalState = finalResumeArtifactState(profile, pack);
  return scoreTailoredResume(job, finalState.profile, finalState.pack, match);
}
