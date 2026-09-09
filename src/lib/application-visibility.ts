import type { CandidateProfile, ExperienceItem, ProjectItem } from './types';
import { employerFacingCandidateProfile, isResumeExperience, resumeExperience } from './profile-curation';
import { normalizeText } from './utils';

/**
 * Projects may remain in the master profile while being explicitly hidden from
 * employer-facing application materials. Legacy-name guards keep intentionally
 * suppressed projects out even if an older saved profile lacks the eligibility flag.
 */
const LEGACY_INTERNAL_PROJECT_NAMES = new Set([
  'job application intelligence dashboard',
  'inventory management system',
]);

type ApplicationProject = ProjectItem & {
  externalApplicationEligible?: boolean;
};

export function isExternalApplicationProject(project: ProjectItem): boolean {
  const applicationProject = project as ApplicationProject;
  if (applicationProject.externalApplicationEligible === false) return false;
  return !LEGACY_INTERNAL_PROJECT_NAMES.has(normalizeText(project.name));
}

function experienceKey(item: ExperienceItem) {
  return `${normalizeText(item.organization)}|${normalizeText(item.title)}|${normalizeText(item.start ?? '')}|${normalizeText(item.end ?? '')}`;
}

/**
 * Preserve the established resume chronology first, but keep other genuine work
 * records available to the job-specific ranker. This fixes the old behavior
 * where Graduate Assistant and other legitimate work could never be selected
 * simply because the three legacy core roles existed.
 */
function applicationExperience(profile: CandidateProfile) {
  const primary = resumeExperience(profile);
  if (profile.profilePurpose === 'part-time') return primary;
  const seen = new Set(primary.map(experienceKey));
  const extras = (profile.experience ?? [])
    .filter(isResumeExperience)
    .filter((item) => !seen.has(experienceKey(item)));
  return [...primary, ...extras];
}

export function externalApplicationProfile(profile: CandidateProfile): CandidateProfile {
  const safe = employerFacingCandidateProfile(profile);
  return {
    ...safe,
    experience: applicationExperience(safe),
    projects: (safe.projects ?? []).filter(isExternalApplicationProject),
    // Publications may remain in the master profile for the user's own records,
    // but they are never available to employer-facing resume/package generation.
    publications: [],
  };
}
