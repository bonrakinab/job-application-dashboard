import { scoreTailoredResume, type AtsReadinessScore } from './ats-score';
import { finalResumeArtifactState } from './resume-generation-policy';
import type { ApplicationPack, CandidateProfile, Job, MatchScore } from './types';

export function scoreTailoredResumeWithCoursework(
  job: Job,
  profile: CandidateProfile,
  pack: ApplicationPack,
  match?: MatchScore,
): AtsReadinessScore {
  // Score exactly what PDF/DOCX and the dashboard preview expose. This prevents
  // headline, contact-location, project-technology, coursework, or publication
  // text that the reference template removes from inflating the ATS estimate.
  const final = finalResumeArtifactState(profile, pack);
  return scoreTailoredResume(job, final.profile, final.pack, match);
}
