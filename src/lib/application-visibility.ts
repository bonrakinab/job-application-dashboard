import type { CandidateProfile, ProjectItem } from './types';
import { employerFacingCandidateProfile } from './profile-curation';
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

export function externalApplicationProfile(profile: CandidateProfile): CandidateProfile {
  const safe = employerFacingCandidateProfile(profile);
  return {
    ...safe,
    projects: (safe.projects ?? []).filter(isExternalApplicationProject),
  };
}
