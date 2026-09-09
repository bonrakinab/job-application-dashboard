import { containsTerm } from './resume-evidence-guards';
import type { ApplicationPack, CandidateProfile, Job, RequirementEvidence } from './types';
import { normalizeText } from './utils';

function unique(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalizeText(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function naturalList(values: string[]) {
  if (values.length <= 1) return values[0] ?? '';
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
}

function exactSupportedProfileSkills(profile: CandidateProfile, requirementEvidence: RequirementEvidence[]) {
  const allowed = new Map(profile.skills.map((skill) => [normalizeText(skill), skill]));
  return unique(requirementEvidence
    .filter((item) => item.support === 'supported')
    .flatMap((item) => item.exactTerms ?? [])
    .map((term) => allowed.get(normalizeText(term)))
    .filter((skill): skill is string => Boolean(skill)));
}

function jdMentionedProfileSkills(job: Job, profile: CandidateProfile) {
  const jd = `${job.title} ${job.department ?? ''} ${job.description}`;
  return profile.skills.filter((skill) => containsTerm(jd, skill));
}

function improvedSummary(
  sourceSummary: string,
  optimizedSummary: string,
  prioritizedSkills: string[],
) {
  const preferred = sourceSummary.trim().length >= 80 ? sourceSummary.trim() : optimizedSummary.trim();
  const base = preferred || optimizedSummary.trim();
  const missing = prioritizedSkills.filter((skill) => !containsTerm(base, skill)).slice(0, 4);
  if (!missing.length) return base;

  const sentence = `Key role-aligned strengths include ${naturalList(missing)}.`;
  if (`${base} ${sentence}`.length <= 520) return `${base.replace(/[.\s]+$/, '')}. ${sentence}`;
  return base;
}

/**
 * Final employer-facing resume policy.
 *
 * - Publications are never allowed into an application pack.
 * - Exact JD skills are promoted only when the exact skill already exists in the
 *   verified candidate profile.
 * - Preserve the higher-quality AI-authored summary when ATS retuning only
 *   changed ordering/coverage, then add a short exact-keyword sentence when needed.
 */
export function strengthenResumeForJob(
  job: Job,
  profile: CandidateProfile,
  optimizedPack: ApplicationPack,
  sourcePack: ApplicationPack,
  requirementEvidence: RequirementEvidence[] = [],
): ApplicationPack {
  const supportedExact = exactSupportedProfileSkills(profile, requirementEvidence);
  const jdSkills = jdMentionedProfileSkills(job, profile);
  const prioritizedSkills = unique([
    ...supportedExact,
    ...jdSkills,
    ...optimizedPack.skills.filter((skill) => profile.skills.some((candidate) => normalizeText(candidate) === normalizeText(skill))),
  ]).slice(0, 26);

  return {
    ...optimizedPack,
    resumeSummary: improvedSummary(sourcePack.resumeSummary, optimizedPack.resumeSummary, prioritizedSkills.slice(0, 8)),
    skills: prioritizedSkills,
    publications: [],
  };
}

/**
 * The uploaded reference resume is a compact one-page layout with no separate
 * headline, no location in the contact row, no project technology sub-line,
 * no education coursework sub-line, and no publications section.
 * Keep those details available in the master profile, but do not render them.
 */
export function referenceTemplateProfile(profile: CandidateProfile): CandidateProfile {
  return {
    ...profile,
    location: '',
    projects: (profile.projects ?? []).map((project) => ({ ...project, skills: [] })),
    degrees: (profile.degrees ?? []).map((degree) => ({ ...degree, coursework: [] })),
    publications: [],
  };
}

export function referenceTemplatePack(pack: ApplicationPack): ApplicationPack {
  return {
    ...pack,
    resumeHeadline: '',
    publications: [],
  };
}
