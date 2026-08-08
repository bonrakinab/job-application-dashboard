import type { CandidateProfile, CompanyWatch, JobWithMatch, MatchScore } from './types';
import { companyGroups } from './company-groups';
import { opportunityStage, roleFamily, type OpportunityStage } from './recommendations';
import { deterministicScore, titleMatchesTarget } from './scoring';
import { clamp, normalizeText } from './utils';

export interface TargetCompanyOpportunity {
  job: JobWithMatch;
  match: MatchScore;
  watchedCompany: string;
  sector: string;
  groups: Array<{ id: string; label: string }>;
  stage: OpportunityStage;
  family: string;
  priority: number;
  highlySuitable: boolean;
  recommended: boolean;
  reasons: string[];
}

function canonicalCompany(value: string) {
  return normalizeText(value)
    .replace(/\b(inc|incorporated|corp|corporation|ltd|limited|llc|plc|canada|technologies|technology)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sameCompany(target: string, actual: string) {
  const a = canonicalCompany(target);
  const b = canonicalCompany(actual).replace(/\bconfidential\b/g, '').trim();
  if (!a || !b) return false;
  return a === b || (Math.min(a.length, b.length) >= 5 && (a.startsWith(b) || b.startsWith(a)));
}

function reasonsFor(job: JobWithMatch, profile: CandidateProfile, match: MatchScore, stage: OpportunityStage, family: string, watchedCompany: string, groupLabels: string[]) {
  const reasons: string[] = [`${watchedCompany} is in your target-employer watchlist.`];
  if (groupLabels.length) reasons.push(`Employer groups: ${groupLabels.slice(0, 3).join(', ')}.`);
  if (stage === 'internship') reasons.push('Internship/co-op role; early-career opportunities are intentionally prioritized.');
  else if (stage === 'new-grad') reasons.push('New-graduate / early-career role.');
  else if (stage === 'entry-level') reasons.push('Entry-level or junior role.');
  if (family !== 'Other' && titleMatchesTarget(job.title, profile.targetTitles)) reasons.push(`${family} aligns with your target role families.`);
  if (match.matchedSkills.length) reasons.push(`Direct skill evidence: ${match.matchedSkills.slice(0, 4).join(', ')}.`);
  if (match.location >= 80) reasons.push('Location / remote eligibility aligns with your preferences.');
  if (match.blockers.length) reasons.push(`Eligibility concern: ${match.blockers[0]}`);
  else if (family === 'Other') reasons.push('Target employer, but this title is outside your main technical role families.');
  return reasons.slice(0, 4);
}

export function rankTargetCompanyJobs(jobs: JobWithMatch[], watchlist: CompanyWatch[], profile: CandidateProfile): TargetCompanyOpportunity[] {
  const enabled = watchlist.filter((company) => company.enabled !== false);

  return jobs.flatMap((job) => {
    const watched = enabled.find((company) => sameCompany(company.company, job.company));
    if (!watched) return [];

    const match = job.match ?? deterministicScore(job, profile);
    const stage = opportunityStage(job);
    const family = roleFamily(job);
    const groups = companyGroups(watched.company).map(({ id, label }) => ({ id, label }));
    const earlyCareer = stage !== 'experienced';
    const stageBoost = stage === 'internship' ? 8 : stage === 'new-grad' ? 7 : stage === 'entry-level' ? 5 : 0;
    const titleBoost = titleMatchesTarget(job.title, profile.targetTitles) ? 3 : 0;
    const familyBoost = family === 'Other' ? 0 : 2;
    const priority = match.blockers.length
      ? Math.max(0, match.overall - 20)
      : clamp(match.overall + stageBoost + titleBoost + familyBoost);
    const highlySuitable = match.blockers.length === 0 && family !== 'Other' && (
      match.recommendation === 'exceptional'
      || match.recommendation === 'strong'
      || (earlyCareer && match.overall >= 70)
    );
    const recommended = match.blockers.length === 0 && family !== 'Other' && (
      highlySuitable || match.recommendation === 'reasonable'
    );

    return [{
      job,
      match,
      watchedCompany: watched.company,
      sector: watched.sector,
      groups,
      stage,
      family,
      priority,
      highlySuitable,
      recommended,
      reasons: reasonsFor(job, profile, match, stage, family, watched.company, groups.map((group) => group.label)),
    } satisfies TargetCompanyOpportunity];
  }).sort((a, b) => {
    if (a.highlySuitable !== b.highlySuitable) return a.highlySuitable ? -1 : 1;
    if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
    const aEligible = a.match.blockers.length === 0;
    const bEligible = b.match.blockers.length === 0;
    if (aEligible !== bEligible) return aEligible ? -1 : 1;
    if (b.priority !== a.priority) return b.priority - a.priority;
    const aDate = a.job.postedAt ? new Date(a.job.postedAt).getTime() : 0;
    const bDate = b.job.postedAt ? new Date(b.job.postedAt).getTime() : 0;
    return bDate - aDate;
  });
}
