import type { CandidateProfile, Job, JobWithMatch, MatchScore } from './types';
import { deterministicScore, titleMatchesTarget } from './scoring';
import { clamp, normalizeText } from './utils';

export type OpportunityStage = 'internship' | 'new-grad' | 'entry-level' | 'experienced';

export interface RecommendedOpportunity {
  job: JobWithMatch;
  match: MatchScore;
  priority: number;
  stage: OpportunityStage;
  family: string;
  highlySuitable: boolean;
  reasons: string[];
}

export function opportunityStage(job: Pick<Job, 'title' | 'description' | 'employmentType'>): OpportunityStage {
  const text = normalizeText(`${job.title} ${job.employmentType ?? ''} ${job.description}`);
  if (/\b(intern|internship|co-op|coop)\b/.test(text)) return 'internship';
  if (/\b(new grad|new graduate|graduate program|graduate role|campus hire|early career)\b/.test(text)) return 'new-grad';
  if (/\b(entry level|entry-level|junior|associate|level i|engineer i|analyst i)\b/.test(text)) return 'entry-level';
  return 'experienced';
}

export function roleFamily(job: Pick<Job, 'title' | 'description'>) {
  const text = normalizeText(`${job.title} ${job.description}`);
  if (/\b(oracle fusion|oracle erp|erp|enterprise applications|business systems)\b/.test(text)) return 'ERP & enterprise systems';
  if (/\b(machine learning|artificial intelligence|ai engineer|ml engineer|data scientist|computer vision|nlp)\b/.test(text)) return 'AI & machine learning';
  if (/\b(data analyst|data analytics|business intelligence|bi analyst|analytics engineer|data engineer)\b/.test(text)) return 'Data & analytics';
  if (/\b(solution engineer|solutions engineer|cloud engineer|cloud analyst|technical consultant|implementation consultant)\b/.test(text)) return 'Cloud & solutions';
  if (/\b(software engineer|software developer|full stack|full-stack|backend|frontend|application developer)\b/.test(text)) return 'Software engineering';
  if (/\b(it analyst|systems analyst|business analyst|technical support|application support|information technology)\b/.test(text)) return 'IT & business systems';
  return 'Target technical role';
}

function recommendationReasons(job: JobWithMatch, profile: CandidateProfile, match: MatchScore, stage: OpportunityStage, family: string) {
  const reasons: string[] = [];
  if (stage === 'internship') reasons.push('Internship/co-op opportunity: intentionally included in your search.');
  else if (stage === 'new-grad') reasons.push('New-graduate / early-career opportunity.');
  else if (stage === 'entry-level') reasons.push('Entry-level or junior opportunity aligned with an early-career profile.');

  if (titleMatchesTarget(job.title, profile.targetTitles)) reasons.push(`${family} matches one of your target role families.`);
  if (match.matchedSkills.length) reasons.push(`Direct skill evidence: ${match.matchedSkills.slice(0, 4).join(', ')}.`);
  if (match.education >= 85) reasons.push('Your CS/AI education is a strong requirement match.');
  if (match.location >= 80) reasons.push('Location / remote eligibility aligns with your preferences.');
  if (!reasons.length) reasons.push('The role clears hard eligibility checks and has a competitive overall match.');
  return reasons.slice(0, 3);
}

export function rankRecommendedJobs(jobs: JobWithMatch[], profile: CandidateProfile): RecommendedOpportunity[] {
  return jobs.map((job) => {
    const match = job.match ?? deterministicScore(job, profile);
    const stage = opportunityStage(job);
    const family = roleFamily(job);
    const earlyCareer = stage !== 'experienced';
    const stageBoost = stage === 'internship' ? 8 : stage === 'new-grad' ? 7 : stage === 'entry-level' ? 5 : 0;
    const targetBoost = titleMatchesTarget(job.title, profile.targetTitles) ? 2 : 0;
    const priority = match.blockers.length ? match.overall : clamp(match.overall + stageBoost + targetBoost);
    const highlySuitable = match.blockers.length === 0 && (
      match.recommendation === 'exceptional'
      || match.recommendation === 'strong'
      || (earlyCareer && match.overall >= 70)
    );
    return {
      job,
      match,
      priority,
      stage,
      family,
      highlySuitable,
      reasons: recommendationReasons(job, profile, match, stage, family),
    };
  })
    .filter((item) => item.match.blockers.length === 0 && (item.highlySuitable || item.match.recommendation === 'reasonable'))
    .sort((a, b) => b.priority - a.priority || b.match.overall - a.match.overall);
}
