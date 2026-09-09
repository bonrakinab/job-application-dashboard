import type { CandidateProfile, Job, MatchScore } from './types';
import { normalizeText } from './utils';

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'with', 'role', 'required',
  'preferred', 'candidate', 'position', 'experience', 'skills', 'skill', 'professional', 'certified', 'certificate',
]);

function tokens(value: string) {
  return [...new Set(normalizeText(value).split(/\s+/)
    .map((token) => token.replace(/^[-/.]+|[-/.]+$/g, ''))
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token)))];
}

function context(job: Job, match?: MatchScore) {
  return [job.title, job.department, job.description, ...(match?.mustHave ?? []), ...(match?.preferred ?? [])]
    .filter(Boolean).join(' ');
}

function overlapScore(value: string, jobContext: string) {
  const evidenceTokens = tokens(value);
  if (!evidenceTokens.length) return 0;
  const jobTokens = new Set(tokens(jobContext));
  const hits = evidenceTokens.filter((token) => jobTokens.has(token)).length;
  return hits / Math.min(8, evidenceTokens.length);
}

function certificationBoost(value: string, jobContext: string) {
  const item = normalizeText(value);
  const job = normalizeText(jobContext);
  let score = 0;
  if (/data science|machine learning|artificial intelligence/.test(item) && /\b(ai|ml|machine learning|data science|data analyst|data engineer)\b/.test(job)) score += 0.8;
  if (/aws|oracle cloud infrastructure|cloud foundations/.test(item) && /\b(cloud|devops|platform engineering|infrastructure|aws|oci|oracle cloud)\b/.test(job)) score += 0.65;
  if (/oracle cloud data management/.test(item) && /\b(data|database|oracle|erp|migration|governance|integration)\b/.test(job)) score += 0.8;
  if (/google it support|operating systems/.test(item) && /\b(it support|help desk|service desk|desktop support|technical support|systems administration|system administration|infrastructure support)\b/.test(job)) score += 0.75;
  if (/it security/.test(item) && /\b(cybersecurity|information security|security operations|security analyst|it security)\b/.test(job)) score += 0.75;
  if (/algorithmic toolbox|programming|html|css/.test(item) && /\b(software developer|software engineer|frontend|front end|web developer|algorithm)\b/.test(job)) score += 0.55;
  return score;
}

function ranked(values: string[], jobContext: string, boost: (value: string, jobContext: string) => number, limit: number) {
  return values.map((value, index) => ({ value, index, score: overlapScore(value, jobContext) + boost(value, jobContext) }))
    .filter((item) => item.score >= 0.28)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((item) => item.value);
}

export function selectApplicationSupplements(job: Job, profile: CandidateProfile, match?: MatchScore) {
  const jobContext = context(job, match);
  return {
    certifications: ranked(profile.certifications ?? [], jobContext, certificationBoost, 6),
    publications: [] as string[],
    awards: [] as string[],
  };
}
