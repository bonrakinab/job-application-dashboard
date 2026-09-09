import { containsTerm } from './resume-evidence-guards';
import type { ApplicationPack, CandidateProfile, Job } from './types';
import { normalizeText } from './utils';

const MAX_RESUME_SKILLS = 22;

function exactProfileSkillMap(profile: CandidateProfile) {
  return new Map(profile.skills.map((skill) => [normalizeText(skill), skill]));
}

/**
 * Keep the generated skill section truthful and role-specific.
 *
 * The old policy appended a fixed AI/ML stack to every career resume, which
 * made ERP, IT, cloud and software resumes look generic and consumed space that
 * should have gone to the target JD. The final policy now keeps only verified
 * profile skills selected by the tailoring plan plus verified profile skills
 * literally requested by the JD. Nothing can be invented here.
 */
export function withPersistentApplicationSkills(
  pack: ApplicationPack,
  profile: CandidateProfile,
  job?: Job,
): ApplicationPack {
  if (profile.profilePurpose === 'part-time') return pack;

  const allowed = exactProfileSkillMap(profile);
  const selected = pack.skills
    .map((skill) => allowed.get(normalizeText(skill)))
    .filter((skill): skill is string => Boolean(skill));
  const jd = job ? `${job.title} ${job.department ?? ''} ${job.description}` : '';
  const jdExact = job
    ? profile.skills.filter((skill) => skill.length >= 2 && containsTerm(jd, skill))
    : [];

  const seen = new Set<string>();
  const skills = [...jdExact, ...selected].filter((skill) => {
    const key = normalizeText(skill);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, MAX_RESUME_SKILLS);

  return { ...pack, skills };
}
