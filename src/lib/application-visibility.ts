import type { CandidateProfile, ProjectItem } from './types';
import { employerFacingCandidateProfile, resumeExperience } from './profile-curation';
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

const IMPORT_DUMP_MARKERS = /\b(?:objective|technologies used|technology used|dataset|preprocessing|key achievements|impact|major challenges on initial configuration|benefits of new setup)\s*:/i;

/**
 * LinkedIn/imported profiles sometimes contain a whole project card copied into
 * one "bullet". Those strings rank artificially well because they contain many
 * keywords and then render as an unreadable paragraph. Employer output only uses
 * concise evidence statements; the master profile is left untouched.
 */
export function isEmployerQualityProjectBullet(value: string) {
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text || text.length < 18 || text.length > 360) return false;
  if (IMPORT_DUMP_MARKERS.test(text)) return false;
  if ((text.match(/◦/g) ?? []).length >= 1) return false;
  const colonLabels = text.match(/\b[A-Z][A-Za-z /&-]{2,24}:\s/g) ?? [];
  if (colonLabels.length >= 2) return false;
  return true;
}

export function isExternalApplicationProject(project: ProjectItem): boolean {
  const applicationProject = project as ApplicationProject;
  if (applicationProject.externalApplicationEligible === false) return false;
  return !LEGACY_INTERNAL_PROJECT_NAMES.has(normalizeText(project.name));
}

function cleanProject(project: ProjectItem): ProjectItem {
  const bullets = (project.bullets ?? [])
    .map((bullet) => bullet.replace(/\s+/g, ' ').trim())
    .filter(isEmployerQualityProjectBullet);
  const rawDescription = project.description?.replace(/\s+/g, ' ').trim() ?? '';
  const description = isEmployerQualityProjectBullet(rawDescription)
    ? rawDescription
    : bullets[0] ?? project.name;
  return { ...project, bullets, description };
}

export function externalApplicationProfile(profile: CandidateProfile): CandidateProfile {
  const safe = employerFacingCandidateProfile(profile);
  return {
    ...safe,
    experience: resumeExperience(safe),
    projects: (safe.projects ?? []).filter(isExternalApplicationProject).map(cleanProject),
    // Publications may remain in the master profile for the user's own records,
    // but they are never available to employer-facing resume/package generation.
    publications: [],
  };
}
