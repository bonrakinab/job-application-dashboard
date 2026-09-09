import { containsTerm, termOccurrences } from './resume-evidence-guards';
import type { ApplicationPack, CandidateProfile, Job, MatchScore } from './types';
import { isStandardAtsDate, renderedDates, visibleResumeText } from './resume-content';
import { normalizeText } from './utils';

/** A deliberately ambitious internal optimization target, not an employer ATS cutoff. */
export const ATS_TARGET_SCORE = 90;
/** @deprecated Kept for stored-pack and test compatibility. */
export const ATS_PASS_SCORE = ATS_TARGET_SCORE;

export interface AtsReadinessScore {
  overall: number;
  label: 'pass' | 'conditional';
  status: 'pass' | 'conditional';
  eligibleToApply: boolean;
  targetReached: boolean;
  passScore: number;
  targetScore: number;
  scoreKind: 'internal-estimate';
  skillCoverage: number;
  exactKeywordCoverage: number;
  requirementCoverage: number;
  evidenceRelevance: number;
  formatHygiene: number;
  keywordPlacement: number;
  rolePositioning: number;
  keywordUse: 'balanced' | 'sparse' | 'repetitive';
  repeatedKeywords: string[];
  formatIssues: string[];
  matchedKeywords: string[];
  missingKeywords: string[];
  improvableKeywords: string[];
  unsupportedMustHaves: string[];
  hardBlockers: string[];
  analysisIncomplete: boolean;
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

function stem(token: string) {
  const normalized = token.replace(/^[-/.]+|[-/.]+$/g, '');
  const irregular: Record<string, string> = {
    managed: 'manage', managing: 'manage', management: 'manage',
    projects: 'project', applications: 'application', systems: 'system',
    developed: 'develop', developing: 'develop', development: 'develop',
    designed: 'design', designing: 'design',
    implemented: 'implement', implementing: 'implement', implementation: 'implement',
    automated: 'automation', automating: 'automation',
    analyzed: 'analysis', analysing: 'analysis', analyzing: 'analysis', analytics: 'analysis',
  };
  if (irregular[normalized]) return irregular[normalized];
  if (normalized.length > 5 && normalized.endsWith('ies')) return `${normalized.slice(0, -3)}y`;
  if (normalized.length > 5 && normalized.endsWith('ing')) return normalized.slice(0, -3);
  if (normalized.length > 4 && normalized.endsWith('ed')) return normalized.slice(0, -2);
  if (normalized.length > 4 && normalized.endsWith('s')) return normalized.slice(0, -1);
  return normalized;
}

function tokens(value: string) {
  return [...new Set(normalizeText(value)
    .split(/\s+/)
    .map(stem)
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

function profileSkillMap(profile: CandidateProfile) {
  return new Map(profile.skills.map((skill) => [normalizeText(skill), skill]));
}

function jobSkillUniverse(job: Job, profile: CandidateProfile, match?: MatchScore) {
  const jd = normalizeText(`${job.title} ${job.description}`);
  const allowed = profileSkillMap(profile);
  const exact = profile.skills.filter((skill) => {
    const normalized = normalizeText(skill);
    return normalized.length >= 2 && containsTerm(jd, normalized);
  });
  const analyzed = [...(match?.matchedSkills ?? []), ...(match?.missingSkills ?? [])]
    .map((skill) => allowed.get(normalizeText(skill)) ?? skill)
    .filter(Boolean);
  return uniqueByNormalized([...exact, ...analyzed]);
}

function compactRequirementKeywords(match?: MatchScore) {
  return uniqueByNormalized([...(match?.mustHave ?? []), ...(match?.preferred ?? [])])
    .filter((requirement) => {
      const count = tokens(requirement).length;
      return count > 0 && count <= 5 && requirement.length <= 70;
    });
}

function exactKeywordUniverse(job: Job, profile: CandidateProfile, pack: ApplicationPack, match?: MatchScore) {
  const requirementTerms = uniqueByNormalized((pack.requirementEvidence ?? []).flatMap((item) => item.exactTerms ?? []));
  return uniqueByNormalized([
    job.title,
    ...jobSkillUniverse(job, profile, match),
    ...(requirementTerms.length ? requirementTerms : compactRequirementKeywords(match)),
  ]).slice(0, 28);
}

function phraseCoverage(phrase: string, haystack: string) {
  const normalizedPhrase = normalizeText(phrase);
  const normalizedHaystack = normalizeText(haystack);
  if (normalizedPhrase && containsTerm(normalizedHaystack, normalizedPhrase)) return 1;
  const phraseTokens = tokens(phrase);
  if (!phraseTokens.length) return 1;
  const haystackTokens = new Set(tokens(haystack));
  return phraseTokens.filter((token) => haystackTokens.has(token)).length / phraseTokens.length;
}

function exactPhrasePresent(phrase: string, haystack: string) {
  return containsTerm(haystack, phrase);
}

function phraseOccurrences(phrase: string, haystack: string) {
  return termOccurrences(haystack, phrase);
}

function average(values: number[], fallback: number) {
  if (!values.length) return fallback;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function evidenceRelevance(job: Job, pack: ApplicationPack, match?: MatchScore) {
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
  const issues: string[] = [];
  const penalize = (points: number, issue: string) => { score -= points; issues.push(issue); };
  if (!profile.email) penalize(12, 'Email address is missing.');
  if (!profile.phone) penalize(8, 'Phone number is missing.');
  if (!pack.resumeHeadline?.trim()) penalize(8, 'Target headline is missing.');
  if (!pack.resumeSummary?.trim()) penalize(15, 'Professional summary is missing.');
  if (!pack.skills.length) penalize(18, 'Skills section is empty.');
  if (!pack.experience.some((item) => item.bullets.length) && !pack.projects.some((item) => item.bullets.length)) {
    penalize(20, 'No accomplishment evidence is rendered.');
  }
  if (profile.profilePurpose !== 'part-time' && !(profile.degrees ?? []).length) penalize(8, 'Education section is missing.');
  if (pack.resumeSummary.length > 650) penalize(8, 'Professional summary is too long.');
  if (pack.skills.length > 28) penalize(6, 'Skills section is overfilled.');
  const longBullets = [...pack.experience, ...pack.projects].flatMap((item) => item.bullets).filter((bullet) => bullet.length > 330);
  if (longBullets.length) penalize(6, 'One or more bullets are too long for reliable scanning.');
  const dates = renderedDates(profile, pack);
  if (dates.some((date) => !isStandardAtsDate(date))) penalize(8, 'One or more dates cannot be normalized to MM/YYYY.');
  const visible = visibleResumeText(profile, pack);
  if (/[^\x09\x0A\x0D\x20-\x7E]/.test(visible)) penalize(3, 'Some characters may not parse consistently in older systems.');
  return { score: clampScore(score), issues };
}

function rolePositioning(job: Job, pack: ApplicationPack, supportedJobSkills: string[]) {
  const positioningText = `${pack.resumeHeadline} ${pack.resumeSummary}`;
  const titleCoverage = phraseCoverage(job.title, positioningText);
  const skillCoverage = supportedJobSkills.length
    ? supportedJobSkills.filter((skill) => exactPhrasePresent(skill, positioningText)).length / supportedJobSkills.length
    : 1;
  return clampScore((titleCoverage * 0.65 + Math.min(1, skillCoverage * 1.5) * 0.35) * 100);
}

function keywordPlacement(pack: ApplicationPack, supportedJobSkills: string[]) {
  if (!supportedJobSkills.length) return 100;
  const top = `${pack.resumeHeadline} ${pack.resumeSummary}`;
  const recent = pack.experience[0]?.bullets.join(' ') ?? '';
  const skills = pack.skills.join(' ');
  return clampScore(average(supportedJobSkills.map((skill) => {
    let score = 0;
    if (exactPhrasePresent(skill, top)) score += 0.45;
    if (exactPhrasePresent(skill, recent)) score += 0.35;
    if (exactPhrasePresent(skill, skills)) score += 0.20;
    return Math.min(1, score);
  }), 1) * 100);
}

function requirementCoverage(pack: ApplicationPack, match: MatchScore | undefined, text: string, fallback: number) {
  const matrix = pack.requirementEvidence ?? [];
  if (matrix.length) {
    let weighted = 0;
    let total = 0;
    for (const item of matrix) {
      const weight = item.importance === 'must-have' ? 1 : 0.35;
      const evidenceFactor = item.support === 'supported' ? 1 : item.support === 'partial' ? 0.55 : 0;
      const wordingFactor = phraseCoverage(item.requirement, text);
      weighted += weight * evidenceFactor * wordingFactor;
      total += weight;
    }
    return clampScore(total ? (weighted / total) * 100 : fallback);
  }
  const mustHave = match?.mustHave ?? [];
  const preferred = match?.preferred ?? [];
  const mustCoverage = average(mustHave.map((requirement) => phraseCoverage(requirement, text)), fallback / 100);
  const preferredCoverage = average(preferred.map((requirement) => phraseCoverage(requirement, text)), fallback / 100);
  return clampScore((mustCoverage * 0.85 + preferredCoverage * 0.15) * 100);
}

function unsupportedMustHaves(pack: ApplicationPack, match?: MatchScore) {
  const matrixGaps = (pack.requirementEvidence ?? [])
    .filter((item) => item.importance === 'must-have' && item.support === 'gap')
    .map((item) => item.requirement);
  if (matrixGaps.length) return uniqueByNormalized(matrixGaps);
  const missing = (match?.missingSkills ?? []).map((skill) => ({ raw: skill, normalized: normalizeText(skill) })).filter((item) => item.normalized.length >= 2);
  return uniqueByNormalized((match?.mustHave ?? []).filter((requirement) => {
    const normalizedRequirement = normalizeText(requirement);
    return missing.some((skill) => containsTerm(normalizedRequirement, skill.normalized));
  }));
}

function detailedAnalysisIncomplete(job: Job, match?: MatchScore) {
  if (job.description.trim().length < 300) return false;
  if (!match) return true;
  const noRequirements = !(match.mustHave?.length || match.preferred?.length || match.missingSkills?.length);
  return noRequirements;
}

export function scoreTailoredResume(job: Job, profile: CandidateProfile, pack: ApplicationPack, match?: MatchScore): AtsReadinessScore {
  const text = visibleResumeText(profile, pack);
  const allowedSkills = profileSkillMap(profile);
  const jobSkills = jobSkillUniverse(job, profile, match);
  const supportedJobSkills = jobSkills.filter((skill) => allowedSkills.has(normalizeText(skill)));
  const unsupportedJobSkills = jobSkills.filter((skill) => !allowedSkills.has(normalizeText(skill)));
  const matchedSkills = supportedJobSkills.filter((skill) => exactPhrasePresent(skill, text));
  const improvableKeywords = supportedJobSkills.filter((skill) => !matchedSkills.some((matched) => normalizeText(matched) === normalizeText(skill)));
  const skillCoverage = clampScore(jobSkills.length ? (matchedSkills.length / jobSkills.length) * 100 : (match?.skills ?? 75));

  const exactKeywords = exactKeywordUniverse(job, profile, pack, match);
  const exactMatched = exactKeywords.filter((keyword) => exactPhrasePresent(keyword, text));
  const exactKeywordCoverage = clampScore(exactKeywords.length ? (exactMatched.length / exactKeywords.length) * 100 : skillCoverage);
  const repeatedKeywords = exactKeywords.filter((keyword) => phraseOccurrences(keyword, text) > 8);
  const keywordUse: AtsReadinessScore['keywordUse'] = repeatedKeywords.length
    ? 'repetitive'
    : exactKeywordCoverage < 35 ? 'sparse' : 'balanced';

  const requirements = requirementCoverage(pack, match, text, skillCoverage);
  const evidence = evidenceRelevance(job, pack, match);
  const hygiene = formatHygiene(profile, pack);
  const placement = keywordPlacement(pack, supportedJobSkills);
  const positioning = rolePositioning(job, pack, supportedJobSkills);

  const unsupportedRequired = unsupportedMustHaves(pack, match);
  const hardBlockers = [...new Set(match?.blockers ?? [])];
  const analysisIncomplete = detailedAnalysisIncomplete(job, match);
  let overall = clampScore(
    requirements * 0.32
    + skillCoverage * 0.20
    + exactKeywordCoverage * 0.13
    + evidence * 0.17
    + hygiene.score * 0.10
    + placement * 0.05
    + positioning * 0.03,
  );

  if (keywordUse === 'repetitive') overall = Math.min(84, overall - 6);
  if (unsupportedRequired.length || analysisIncomplete) overall = Math.min(89, overall);
  if (hardBlockers.length) overall = Math.min(49, overall);

  const targetReached = overall >= ATS_TARGET_SCORE && !unsupportedRequired.length && !hardBlockers.length && !analysisIncomplete;
  const status: AtsReadinessScore['status'] = targetReached ? 'pass' : 'conditional';
  const missingKeywords = uniqueByNormalized([
    ...improvableKeywords,
    ...unsupportedJobSkills,
    ...exactKeywords.filter((keyword) => !exactMatched.some((matched) => normalizeText(matched) === normalizeText(keyword))),
  ]).slice(0, 14);
  const matchedKeywords = uniqueByNormalized([
    ...exactMatched,
  ]).slice(0, 14);

  return {
    overall,
    label: status,
    status,
    eligibleToApply: targetReached,
    targetReached,
    passScore: ATS_TARGET_SCORE,
    targetScore: ATS_TARGET_SCORE,
    scoreKind: 'internal-estimate',
    skillCoverage,
    exactKeywordCoverage,
    requirementCoverage: requirements,
    evidenceRelevance: evidence,
    formatHygiene: hygiene.score,
    keywordPlacement: placement,
    rolePositioning: positioning,
    keywordUse,
    repeatedKeywords: repeatedKeywords.slice(0, 8),
    formatIssues: hygiene.issues,
    matchedKeywords,
    missingKeywords,
    improvableKeywords: improvableKeywords.slice(0, 12),
    unsupportedMustHaves: unsupportedRequired.slice(0, 8),
    hardBlockers,
    analysisIncomplete,
    explanation: `Internal ATS-readiness estimate with an ambitious ${ATS_TARGET_SCORE}/100 optimization target. No score can guarantee passage through an employer's proprietary ATS. The estimate weighs requirement support, exact JD terminology visible in the exported résumé, evidence relevance, keyword placement, and ATS-safe structure; unsupported requirements and eligibility blockers remain visible.`,
  };
}
