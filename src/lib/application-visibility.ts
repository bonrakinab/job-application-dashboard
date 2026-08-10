import type { CandidateProfile, ProjectItem } from './types';
import { normalizeText } from './utils';

/**
 * Projects may remain in the master profile while being explicitly hidden from
 * employer-facing application materials. The legacy-name guard ensures the
 * Job Application Intelligence Dashboard stays private even if an older saved
 * profile does not yet contain the eligibility flag.
 */
const LEGACY_INTERNAL_PROJECT_NAMES = new Set([
  'job application intelligence dashboard',
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
  return {
    ...profile,
    projects: (profile.projects ?? []).filter(isExternalApplicationProject),
  };
}
