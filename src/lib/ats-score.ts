import type { ApplicationPack, CandidateProfile, Job, MatchScore } from './types';
import { normalizeText } from './utils';

export interface AtsReadinessScore {
  overall: number;
  label: 'strong' | 'good' | 'moderate' | 'weak';
  skillCoverage: number;
  requirementCoverage: number;
  evidenceRelevance: number;
  formatHygiene: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  explanation: string;
}

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'have', 'in', 'into', 'is', 'it', 'of',
  'on', 'or', 'our', 'the', 'their', 'this', 'to', 'using', 'with', 'you', 'your', 'will', 'work', 'working',
  'role', 'team', 'experience', 'skills', 'skill', 'required', 'preferred', 'requirements', 'responsibilities',
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

function resumeText(profile: CandidateProfile, pack: ApplicationPack) {
  const selectedProjects = new Set(pack.projects.map((project) => normalizeText(project.name)));
  const selectedExperience = new Set(pack.experience.map((item) => `${normalizeText(item.organization)}|${normalizeText(item.title)}`));
  const supportingSkills = [
    ...(profile.projects ?? [])
      .filter((project) => selectedProjects.has(normalizeText(project.name)))
      .flatMap((project) => project.skills ?? []),
    ...(profile.experience ?? [])
      .filter((item) => selectedExperience.has(`${normalizeText(item.organization)}|${normalizeText(item.title)}`))
      .flatMap((item) => item.skills ?? []),
  ];

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

function exactJobSkills(job: Job, profile: CandidateProfile, match?: MatchScore) {
  const jd = normalizeText(`${job.title} ${job.description}`);
  const exact = profile.skills.filter((skill) => jd.includes(normalizeText(skill)));
  const matched = (match?.matchedSkills ?? []).filter((skill) => profile.skills.some((allowed) => normalizeText(allowed) === normalizeText(skill)));
  return [...new Set([...exact, ...matched])];
}

function phraseCoverage(phrase: string, haystack: string) {
  const phraseTokens = tokens(phrase);
  if (!phraseTokens.length) return 1;
  const hits = phraseTokens.filter((token) => haystack.includes(token)).length;
  return hits / phraseTokens.length;
}

function average(values: number[], fallback: number) {
  if (!values.length) return fallback;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function evidenceRelevance(job: Job, profile: CandidateProfile, pack: ApplicationPack) {
  const jdTokens = new Set(tokens(`${job.title} ${job.description}`));
  const selectedProjectNames = new Set(pack.projects.map((project) => normalizeText(project.name)));
  const selectedProjectSkills = (profile.projects ?? [])
    .filter((project) => selectedProjectNames.has(normalizeText(project.name)))
    .flatMap((project) => project.skills ?? []);
  const evidence = [
    ...pack.experience.flatMap((item) => item.bullets),
    ...pack.projects.flatMap((item) => item.bullets),
    ...selectedProjectSkills,
  ];
  if (!evidence.length || !jdTokens.size) return 50;

  const scores = evidence.map((item) => {
    const itemTokens = tokens(item);
    if (!itemTokens.length) return 0;
    const hits = itemTokens.filter((token) => jdTokens.has(token)).length;
    const density = hits / Math.min(8, Math.max(3, itemTokens.length));
    return Math.min(1, density * 2.4);
  });
  return clampScore(average(scores, 0.5) * 100);
}

function formatHygiene(profile: CandidateProfile, pack: ApplicationPack) {
  let score = 100;
  if (!profile.email) score -= 10;
  if (!profile.phone) score -= 5;
  if (!pack.resumeSummary?.trim()) score -= 15;
  if (!pack.skills.length) score -= 20;
  if (!pack.experience.some((item) => item.bullets.length)) score -= 20;
  if (!(profile.degrees ?? []).length) score -= 10;
  if (pack.resumeSummary.length > 800) score -= 10;
  return clampScore(score);
}

export function scoreTailoredResume(job: Job, profile: CandidateProfile, pack: ApplicationPack, match?: MatchScore): AtsReadinessScore {
  const text = resumeText(profile, pack);
  const jobSkills = exactJobSkills(job, profile, match);
  const selectedSkills = new Set(pack.skills.map(normalizeText));
  const matchedSkills = jobSkills.filter((skill) => selectedSkills.has(normalizeText(skill)) || text.includes(normalizeText(skill)));
  const missingJobSkills = jobSkills.filter((skill) => !matchedSkills.includes(skill));
  const skillCoverage = clampScore(jobSkills.length ? (matchedSkills.length / jobSkills.length) * 100 : (match?.skills ?? 75));

  const mustHave = match?.mustHave ?? [];
  const preferred = match?.preferred ?? [];
  const mustCoverage = clampScore(average(mustHave.map((requirement) => phraseCoverage(requirement, text)), skillCoverage / 100) * 100);
  const preferredCoverage = clampScore(average(preferred.map((requirement) => phraseCoverage(requirement, text)), skillCoverage / 100) * 100);
  const requirementCoverage = clampScore(mustCoverage * 0.8 + preferredCoverage * 0.2);
  const evidence = evidenceRelevance(job, profile, pack);
  const hygiene = formatHygiene(profile, pack);

  const modelMissing = (match?.missingSkills ?? []).filter(Boolean);
  const missingKeywords = [...new Set([...missingJobSkills, ...modelMissing])].slice(0, 12);
  const gapPenalty = Math.min(15, modelMissing.length * 2.5);
  const overall = clampScore(
    skillCoverage * 0.35
    + requirementCoverage * 0.30
    + evidence * 0.20
    + hygiene * 0.15
    - gapPenalty,
  );

  const label: AtsReadinessScore['label'] = overall >= 85 ? 'strong' : overall >= 72 ? 'good' : overall >= 58 ? 'moderate' : 'weak';
  const matchedKeywords = [...new Set([...matchedSkills, ...(match?.strengths ?? []).filter((item) => item.length <= 50)])].slice(0, 12);

  return {
    overall,
    label,
    skillCoverage,
    requirementCoverage,
    evidenceRelevance: evidence,
    formatHygiene: hygiene,
    matchedKeywords,
    missingKeywords,
    explanation: `Estimated ATS/JD alignment based on exact skill coverage, extracted requirement coverage, relevance of selected evidence, and ATS-safe resume structure. This is not a score from the employer's proprietary ATS.`,
  };
}
