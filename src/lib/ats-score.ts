import type { ApplicationPack, CandidateProfile, Job, MatchScore } from './types';
import { normalizeText } from './utils';

export const ATS_PASS_SCORE = 90;

export interface AtsReadinessScore {
  overall: number;
  label: 'pass' | 'conditional';
  status: 'pass' | 'conditional';
  eligibleToApply: boolean;
  passScore: number;
  skillCoverage: number;
  requirementCoverage: number;
  evidenceRelevance: number;
  formatHygiene: number;
  rolePositioning: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  improvableKeywords: string[];
  unsupportedMustHaves: string[];
  hardBlockers: string[];
  explanation: string;
}

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'have', 'in', 'into', 'is', 'it', 'of',
  'on', 'or', 'our', 'the', 'their', 'this', 'to', 'using', 'with', 'you', 'your', 'will', 'work', 'working',
  'role', 'team', 'experience', 'skills', 'skill', 'required', 'preferred', 'requirements', 'responsibilities',
  'candidate', 'position', 'ability', 'knowledge', 'strong', 'excellent', 'including',
]);

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function tokens(value: string) {
  return [...new Set(normalizeText(value)
    .split(/\s+/)
    .map((token) => token.replace(/^[-/.]+|[-/.]+$/g, ''))
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token)))];
}

function uniqueByNormalized(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalizeText(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function selectedSupportingSkills(profile: CandidateProfile, pack: ApplicationPack) {
  const selectedProjects = new Set(pack.projects.map((project) => normalizeText(project.name)));
  const selectedExperience = new Set(pack.experience.map((item) => `${normalizeText(item.organization)}|${normalizeText(item.title)}`));
  return uniqueByNormalized([
    ...(profile.projects ?? [])
      .filter((project) => selectedProjects.has(normalizeText(project.name)))
      .flatMap((project) => project.skills ?? []),
    ...(profile.experience ?? [])
      .filter((item) => selectedExperience.has(`${normalizeText(item.organization)}|${normalizeText(item.title)}`))
      .flatMap((item) => item.skills ?? []),
  ]);
}

function resumeText(profile: CandidateProfile, pack: ApplicationPack) {
  const supportingSkills = selectedSupportingSkills(profile, pack);
  return normalizeText([
    pack.resumeHeadline,
    pack.resumeSummary,
    ...pack.skills,
    ...supportingSkills,
    ...pack.experience.flatMap((item) => [item.organization, item.title, ...item.bullets]),
    ...pack.projects.flatMap((project) => [project.name, ...project.bullets]),
    ...(profile.degrees ?? []).flatMap((degree) => [degree.degree, degree.field ?? '', degree.institution]),
    ...(profile.certifications ?? []),
  ].join(' '));
}

function profileSkillMap(profile: CandidateProfile) {
  return new Map(profile.skills.map((skill) => [normalizeText(skill), skill]));
}

function jobSkillUniverse(job: Job, profile: CandidateProfile, match?: MatchScore) {
  const jd = normalizeText(`${job.title} ${job.description}`);
  const allowed = profileSkillMap(profile);
  const exact = profile.skills.filter((skill) => {
    const normalized = normalizeText(skill);
    return normalized.length >= 2 && jd.includes(normalized);
  });
  const matched = (match?.matchedSkills ?? [])
    .map((skill) => allowed.get(normalizeText(skill)) ?? skill)
    .filter(Boolean);
  const missing = match?.missingSkills ?? [];
  return uniqueByNormalized([...exact, ...matched, ...missing]);
}

function phraseCoverage(phrase: string, haystack: string) {
  const phraseTokens = tokens(phrase);
  if (!phraseTokens.length) return 1;
  const haystackTokens = new Set(tokens(haystack));
  const hits = phraseTokens.filter((token) => haystackTokens.has(token)).length;
  return hits / phraseTokens.length;
}

function average(values: number[], fallback: number) {
  if (!values.length) return fallback;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function evidenceRelevance(job: Job, profile: CandidateProfile, pack: ApplicationPack, match?: MatchScore) {
  const contextTokens = new Set(tokens([
    job.title,
    job.description,
    ...(match?.mustHave ?? []),
    ...(match?.preferred ?? []),
    ...(match?.matchedSkills ?? []),
  ].join(' ')));
  const evidence = [
    ...pack.experience.flatMap((item) => item.bullets),
    ...pack.projects.flatMap((item) => item.bullets),
    ...selectedSupportingSkills(profile, pack),
  ];
  if (!evidence.length || !contextTokens.size) return 45;

  const scores = evidence.map((item) => {
    const itemTokens = tokens(item);
    if (!itemTokens.length) return 0;
    const hits = itemTokens.filter((token) => contextTokens.has(token)).length;
    const denominator = Math.min(8, Math.max(3, itemTokens.length));
    return Math.min(1, (hits / denominator) * 2.35);
  });
  return clampScore(average(scores, 0.45) * 100);
}

function formatHygiene(profile: CandidateProfile, pack: ApplicationPack) {
  let score = 100;
  if (!profile.email) score -= 10;
  if (!profile.phone) score -= 5;
  if (!pack.resumeHeadline?.trim()) score -= 10;
  if (!pack.resumeSummary?.trim()) score -= 15;
  if (!pack.skills.length) score -= 20;
  if (!pack.experience.some((item) => item.bullets.length)) score -= 20;
  if (!(profile.degrees ?? []).length) score -= 10;
  if (pack.resumeSummary.length > 700) score -= 10;
  if (pack.skills.length > 30) score -= 5;
  return clampScore(score);
}

function rolePositioning(job: Job, profile: CandidateProfile, pack: ApplicationPack, supportedJobSkills: string[]) {
  const positioningText = normalizeText(`${pack.resumeHeadline} ${pack.resumeSummary}`);
  const titleCoverage = phraseCoverage(job.title, positioningText);
  const skillCoverage = supportedJobSkills.length
    ? supportedJobSkills.filter((skill) => positioningText.includes(normalizeText(skill))).length / supportedJobSkills.length
    : 1;
  const degreePresent = (profile.degrees ?? []).length
    ? /msc|master|computer science|bachelor|btech/i.test(positioningText)
    : true;
  return clampScore((titleCoverage * 0.55 + Math.min(1, skillCoverage * 1.5) * 0.35 + (degreePresent ? 0.1 : 0)) * 100);
}

function unsupportedMustHaves(match?: MatchScore) {
  const missing = (match?.missingSkills ?? []).map((skill) => ({ raw: skill, normalized: normalizeText(skill) })).filter((item) => item.normalized.length >= 2);
  return uniqueByNormalized((match?.mustHave ?? []).filter((requirement) => {
    const normalizedRequirement = normalizeText(requirement);
    return missing.some((skill) => normalizedRequirement.includes(skill.normalized));
  }));
}

export function scoreTailoredResume(job: Job, profile: CandidateProfile, pack: ApplicationPack, match?: MatchScore): AtsReadinessScore {
  const text = resumeText(profile, pack);
  const allowedSkills = profileSkillMap(profile);
  const jobSkills = jobSkillUniverse(job, profile, match);
  const supportedJobSkills = jobSkills.filter((skill) => allowedSkills.has(normalizeText(skill)));
  const unsupportedJobSkills = jobSkills.filter((skill) => !allowedSkills.has(normalizeText(skill)));
  const matchedSkills = supportedJobSkills.filter((skill) => text.includes(normalizeText(skill)));
  const improvableKeywords = supportedJobSkills.filter((skill) => !matchedSkills.some((matched) => normalizeText(matched) === normalizeText(skill)));
  const skillCoverage = clampScore(jobSkills.length ? (matchedSkills.length / jobSkills.length) * 100 : (match?.skills ?? 75));

  const mustHave = match?.mustHave ?? [];
  const preferred = match?.preferred ?? [];
  const mustCoverage = clampScore(average(mustHave.map((requirement) => phraseCoverage(requirement, text)), skillCoverage / 100) * 100);
  const preferredCoverage = clampScore(average(preferred.map((requirement) => phraseCoverage(requirement, text)), skillCoverage / 100) * 100);
  const requirementCoverage = clampScore(mustCoverage * 0.85 + preferredCoverage * 0.15);
  const evidence = evidenceRelevance(job, profile, pack, match);
  const hygiene = formatHygiene(profile, pack);
  const positioning = rolePositioning(job, profile, pack, supportedJobSkills);

  const unsupportedRequired = unsupportedMustHaves(match);
  const hardBlockers = [...new Set(match?.blockers ?? [])];
  let overall = clampScore(
    requirementCoverage * 0.40
    + skillCoverage * 0.25
    + evidence * 0.20
    + hygiene * 0.10
    + positioning * 0.05,
  );

  if (unsupportedRequired.length) overall = Math.min(89, overall);
  if (hardBlockers.length) overall = Math.min(49, overall);

  const eligibleToApply = overall >= ATS_PASS_SCORE && !unsupportedRequired.length && !hardBlockers.length;
  const status: AtsReadinessScore['status'] = eligibleToApply ? 'pass' : 'conditional';
  const missingKeywords = uniqueByNormalized([...improvableKeywords, ...unsupportedJobSkills]).slice(0, 14);
  const matchedKeywords = uniqueByNormalized([
    ...matchedSkills,
    ...(match?.strengths ?? []).filter((item) => item.length <= 55),
  ]).slice(0, 14);

  return {
    overall,
    label: status,
    status,
    eligibleToApply,
    passScore: ATS_PASS_SCORE,
    skillCoverage,
    requirementCoverage,
    evidenceRelevance: evidence,
    formatHygiene: hygiene,
    rolePositioning: positioning,
    matchedKeywords,
    missingKeywords,
    improvableKeywords: improvableKeywords.slice(0, 12),
    unsupportedMustHaves: unsupportedRequired.slice(0, 8),
    hardBlockers,
    explanation: `Internal ATS-readiness estimate using a 90/100 pass standard. It weighs must-have requirement coverage (40%), JD skill coverage (25%), evidence relevance (20%), ATS-safe structure (10%), and role positioning (5%). Unsupported mandatory requirements and hard eligibility blockers cannot be hidden by keyword tailoring. This is not a score from the employer's proprietary ATS.`,
  };
}
