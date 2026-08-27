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
  if (/aws|oracle cloud infrastructure|cloud foundations/.test(item) && /\b(cloud|devops|platform|infrastructure|aws|oci|software)\b/.test(job)) score += 0.65;
  if (/oracle cloud data management/.test(item) && /\b(data|database|oracle|erp|migration|governance)\b/.test(job)) score += 0.8;
  if (/google it support|operating systems|it security/.test(item) && /\b(it|support|systems|infrastructure|security|help desk|application analyst)\b/.test(job)) score += 0.75;
  if (/algorithmic toolbox|programming|html|css/.test(item) && /\b(software|developer|engineer|frontend|web|algorithm)\b/.test(job)) score += 0.55;
  return score;
}

function ranked(values: string[], jobContext: string, boost: (value: string, jobContext: string) => number, limit: number) {
  return values.map((value, index) => ({ value, index, score: overlapScore(value, jobContext) + boost(value, jobContext) }))
    .filter((item) => item.score >= 0.28)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((item) => item.value);
}

function publicationBoost(value: string, jobContext: string) {
  const job = normalizeText(jobContext);
  const item = normalizeText(value);
  if (!/\b(ai|artificial intelligence|machine learning|data|research|nlp|security|cloud|algorithm|analysis)\b/.test(job)) return -1;
  let score = 0.1;
  if (/cloud failure/.test(item) && /cloud|infrastructure|reliability/.test(job)) score += 0.8;
  if (/vaccine|social media|opinion analysis/.test(item) && /nlp|analysis|data|research/.test(job)) score += 0.5;
  if (/gene ontology|algorithm|hashing/.test(item) && /algorithm|data|research|software/.test(job)) score += 0.5;
  if (/smart helmet|monitoring/.test(item) && /iot|monitoring|systems|hardware/.test(job)) score += 0.55;
  return score;
}

export function selectApplicationSupplements(job: Job, profile: CandidateProfile, match?: MatchScore) {
  const jobContext = context(job, match);
  return {
    certifications: ranked(profile.certifications ?? [], jobContext, certificationBoost, 3),
    publications: ranked(profile.publications ?? [], jobContext, publicationBoost, 1),
    awards: [] as string[],
  };
}
