import type { ApplicationPack, CandidateProfile } from './types';
import { normalizeText } from './utils';

export function applicationEvidenceProfile(profile: CandidateProfile) {
  const { email: _email, phone: _phone, links: _links, ...safe } = profile;
  return {
    ...safe,
    experience: (profile.experience ?? []).map((item, experienceIndex) => ({
      ...item,
      bullets: item.bullets.map((text, bulletIndex) => ({ id: `EXP:${experienceIndex}:${bulletIndex}`, text })),
    })),
    projects: (profile.projects ?? []).map((item, projectIndex) => ({
      ...item,
      bullets: (item.bullets ?? []).map((text, bulletIndex) => ({ id: `PROJ:${projectIndex}:${bulletIndex}`, text })),
    })),
  };
}

function exactSourceBullets(generated: string[] | undefined, source: string[], max: number) {
  const sourceByNormalized = new Map(source.map((text) => [normalizeText(text), text]));
  const selected = (generated ?? [])
    .map((text) => sourceByNormalized.get(normalizeText(text)))
    .filter((text): text is string => Boolean(text));
  return [...new Set(selected)].slice(0, max);
}

function numbers(text: string) {
  return text.match(/\b\d+(?:[.,]\d+)?(?:%|\+)?\b/g) ?? [];
}

function summaryLooksSupported(summary: string, profile: CandidateProfile) {
  const evidence = JSON.stringify(applicationEvidenceProfile(profile));
  const sourceNumbers = new Set(numbers(evidence));
  if (numbers(summary).some((value) => !sourceNumbers.has(value))) return false;
  const expectedDegree = (profile.degrees ?? []).some((degree) => /expected/i.test(degree.end ?? ''));
  if (expectedDegree && /\b(?:graduate|graduated)\b/i.test(summary)) return false;
  return summary.trim().length >= 40 && summary.trim().length <= 700;
}

export function sanitizeApplicationPack(pack: ApplicationPack, profile: CandidateProfile): ApplicationPack {
  const allowedSkills = new Map(profile.skills.map((skill) => [normalizeText(skill), skill]));
  const selectedSkills = pack.skills
    .map((skill) => allowedSkills.get(normalizeText(skill)))
    .filter((skill): skill is string => Boolean(skill));
  const skills = [...new Set(selectedSkills)].slice(0, 26);

  const generatedExperience = new Map(pack.experience.map((item) => [
    `${normalizeText(item.organization)}|${normalizeText(item.title)}`,
    item,
  ]));
  const experience = (profile.experience ?? []).map((source, index) => {
    const generated = generatedExperience.get(`${normalizeText(source.organization)}|${normalizeText(source.title)}`);
    const valid = exactSourceBullets(generated?.bullets, source.bullets, 3);
    const fallbackCount = index === 0 ? Math.min(3, source.bullets.length) : Math.min(2, source.bullets.length);
    return {
      organization: source.organization,
      title: source.title,
      bullets: valid.length ? valid : source.bullets.slice(0, fallbackCount),
    };
  });

  const sourceProjects = new Map((profile.projects ?? []).map((item) => [normalizeText(item.name), item]));
  const projects = pack.projects.flatMap((generated) => {
    const source = sourceProjects.get(normalizeText(generated.name));
    if (!source) return [];
    const valid = exactSourceBullets(generated.bullets, source.bullets ?? [], 3);
    return [{ name: source.name, bullets: valid.length ? valid : (source.bullets ?? []).slice(0, 2) }];
  }).slice(0, 4);

  const fallbackProjects = (profile.projects ?? []).slice(0, 3).map((project) => ({
    name: project.name,
    bullets: (project.bullets ?? []).slice(0, 2),
  }));

  const resumeSummary = summaryLooksSupported(pack.resumeSummary, profile)
    ? pack.resumeSummary.trim()
    : (profile.summary ?? pack.resumeSummary).trim();

  return {
    ...pack,
    resumeHeadline: pack.resumeHeadline.trim().slice(0, 140),
    resumeSummary,
    skills: skills.length ? skills : profile.skills.slice(0, 20),
    experience,
    projects: projects.length ? projects : fallbackProjects,
  };
}
