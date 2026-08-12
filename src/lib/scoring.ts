import type { CandidateProfile, Job, MatchScore, Recommendation } from './types';
import { clamp, normalizeText } from './utils';

const SENIORITY_BLOCKERS = ['principal', 'staff', 'director', 'manager', 'vp ', 'vice president', 'head of', 'chief '];
const CLEARANCE_PATTERNS = ['active security clearance', 'top secret clearance', 'secret clearance required'];
const COUNTRY_BLOCKERS = ['us citizens only', 'u.s. citizens only', 'must be a us citizen', 'must be a u.s. citizen'];
const STOP_WORDS = new Set(['and', 'the', 'for', 'with', 'role', 'senior', 'junior']);
const DOMAIN_ACRONYMS = new Set(['ai', 'ml', 'bi', 'it']);
const SKILL_EVIDENCE_CURVE = [20, 45, 62, 74, 82, 88, 93, 96, 98, 100];

function scoreSkillEvidence(haystack: string, configuredSkills: string[]) {
  if (!configuredSkills.length) return { score: 50, matched: [] as string[] };
  const matched = configuredSkills.filter((skill) => haystack.includes(normalizeText(skill)));
  const saturation = SKILL_EVIDENCE_CURVE[Math.min(matched.length, SKILL_EVIDENCE_CURVE.length - 1)];
  const compactProfileCoverage = configuredSkills.length <= 6 ? (matched.length / configuredSkills.length) * 95 : 0;
  return { score: clamp(Math.max(saturation, compactProfileCoverage)), matched };
}

export function titleMatchesTarget(title: string, targets: string[]) {
  const normalizedTitle = normalizeText(title);
  return targets.some((target) => {
    const normalizedTarget = normalizeText(target);
    if (normalizedTitle.includes(normalizedTarget)) return true;
    const words = normalizedTarget.split(' ').filter((word) => (word.length > 2 || DOMAIN_ACRONYMS.has(word)) && !STOP_WORDS.has(word));
    const hits = words.filter((word) => normalizedTitle.includes(word)).length;
    return words.length === 1 ? hits === 1 : hits >= Math.min(2, words.length);
  });
}

function remoteRegionMatches(location: string, preferred: string[]) {
  if (!location) return true;
  if (
    location === 'remote'
    || location === 'anywhere'
    || location === 'worldwide'
    || location === 'global'
    || location.includes('anywhere in the world')
    || location.includes('remote worldwide')
    || location.includes('remote anywhere')
    || location.includes('probably worldwide')
  ) return true;

  const preferenceText = preferred.join(' ');
  const wantsCanada = preferenceText.includes('canada');
  if (wantsCanada && (
    location === 'canada'
    || location.includes('canada only')
    || location.includes('north america only')
    || location === 'north america'
    || location.includes('americas only')
  )) return true;

  return false;
}

export function locationMatchesPreference(job: Job, profile: CandidateProfile) {
  const location = normalizeText(job.location ?? '');
  const preferred = profile.preferredLocations.map(normalizeText).filter(Boolean);
  if (job.remote && remoteRegionMatches(location, preferred)) return true;
  if (!location) return Boolean(job.remote);
  if (preferred.some((place) => location.includes(place) || place.includes(location))) return true;
  return false;
}

function statedYearsRequirement(text: string) {
  const matches = [...text.matchAll(/(?:at least\s*)?(\d{1,2})\+?\s*(?:or more\s*)?years?\s+(?:of\s+)?(?:professional\s+|industry\s+)?experience/g)];
  return matches.reduce((max, match) => Math.max(max, Number(match[1]) || 0), 0);
}

function hasSoftSeniorityGap(title: string, yearsExperience: number) {
  const normalized = normalizeText(title);
  if (normalized.includes('lead') && yearsExperience < 5) return true;
  return normalized.includes('senior') && yearsExperience < 4;
}

export function hardEligibility(job: Job, profile: CandidateProfile) {
  const text = normalizeText(`${job.title} ${job.description}`);
  const blockers: string[] = [];

  const authorization = normalizeText([...(profile.workAuthorization ?? []), ...(profile.certifications ?? [])].join(' '));
  const hasClearance = CLEARANCE_PATTERNS.some((pattern) => authorization.includes(pattern.replace(' required', ''))) || authorization.includes('active clearance');
  const hasUsCitizenship = authorization.includes('us citizen') || authorization.includes('u.s. citizen');
  for (const pattern of CLEARANCE_PATTERNS) if (text.includes(pattern) && !hasClearance) blockers.push('Requires an active security clearance not present in the candidate profile.');
  for (const pattern of COUNTRY_BLOCKERS) if (text.includes(pattern) && !hasUsCitizenship) blockers.push('Explicit U.S. citizenship restriction detected.');

  const seniorTitle = normalizeText(job.title);
  if (SENIORITY_BLOCKERS.some((term) => seniorTitle.includes(term)) && (profile.yearsExperience ?? 0) < 6) {
    blockers.push('Role seniority appears materially above the configured experience level.');
  }

  const requiredYears = statedYearsRequirement(text);
  const candidateYears = profile.yearsExperience ?? 0;
  if (requiredYears >= candidateYears + 4) blockers.push(`Job explicitly asks for about ${requiredYears}+ years of experience.`);

  for (const excluded of profile.excludedKeywords ?? []) {
    if (text.includes(normalizeText(excluded))) blockers.push(`Excluded requirement detected: ${excluded}.`);
  }

  return [...new Set(blockers)];
}

export function deterministicScore(job: Job, profile: CandidateProfile): MatchScore {
  const text = normalizeText(`${job.title} ${job.location ?? ''} ${job.description}`);
  const blockers = hardEligibility(job, profile);
  const skillEvidence = scoreSkillEvidence(text, profile.skills);
  const skills = skillEvidence.score;
  const matchedSkills = skillEvidence.matched;
  const targetHit = titleMatchesTarget(job.title, profile.targetTitles);
  const targets = targetHit ? 100 : 25;
  const location = locationMatchesPreference(job, profile) ? 100 : 20;
  const candidateYears = profile.yearsExperience ?? 0;
  const softSeniorityGap = hasSoftSeniorityGap(job.title, candidateYears);
  const experience = softSeniorityGap
    ? clamp(50 + Math.min(candidateYears, 4) * 5)
    : clamp(candidateYears >= 2 ? 65 + targets * 0.25 : 50 + targets * 0.2);
  const education = profile.degrees?.length ? 90 : 70;
  const domain = clamp(targets * 0.65 + skills * 0.35);
  const weighted = clamp(skills * 0.35 + experience * 0.2 + education * 0.1 + domain * 0.2 + location * 0.15);
  const eligibleScore = softSeniorityGap ? Math.min(69, weighted) : weighted;
  const overall = blockers.length ? Math.min(49, eligibleScore) : eligibleScore;
  const recommendation: Recommendation = blockers.length ? 'skip' : overall >= 90 ? 'exceptional' : overall >= 80 ? 'strong' : overall >= 70 ? 'reasonable' : overall >= 60 ? 'stretch' : 'skip';
  const gaps = softSeniorityGap ? ['Title indicates a seniority level above the configured experience level; keep as a stretch unless the description is unusually flexible.'] : [];

  return {
    overall,
    skills,
    experience,
    education,
    domain,
    location,
    recommendation,
    blockers,
    strengths: matchedSkills.slice(0, 6),
    gaps,
    mustHave: [],
    preferred: [],
    matchedSkills,
    missingSkills: [],
    explanation: blockers.length
      ? blockers.join(' ')
      : softSeniorityGap
        ? 'Deterministic score uses role family, skill evidence, location and education, with a soft cap for a seniority mismatch.'
        : 'Deterministic first-pass score based on role family, skill evidence, location, education and experience.',
    model: 'deterministic-v3',
  };
}
