import { hasApplied } from './application-state';
import { jobMatchesType, type JobTypeFilter } from './job-type';
import type { ApplicationStatus, JobValidityStatus, JobWithMatch, Recommendation } from './types';

export type FreshAgeFilter = 'all' | '1' | '3' | '6' | '12' | '24';
export type FreshApplicationFilter = 'all' | 'not-applied' | 'submitted' | ApplicationStatus;
export type FreshPostingStateFilter = 'all' | 'viable' | JobValidityStatus;
export type FreshMatchFilter = 'all' | '90-100' | '80-89' | '70-79' | '60-69' | 'below-60' | 'unanalyzed';
export type FreshDecisionFilter = 'all' | Recommendation | 'unanalyzed';

export interface FreshOpeningFilters {
  query: string;
  source: string;
  postedWithin: FreshAgeFilter;
  addedWithin: FreshAgeFilter;
  application: FreshApplicationFilter;
  jobType: JobTypeFilter;
  location: string;
  postingState: FreshPostingStateFilter;
  match: FreshMatchFilter;
  decision: FreshDecisionFilter;
}

export const DEFAULT_FRESH_OPENING_FILTERS: FreshOpeningFilters = {
  query: '',
  source: 'all',
  postedWithin: 'all',
  addedWithin: 'all',
  application: 'all',
  jobType: 'all',
  location: '',
  postingState: 'all',
  match: 'all',
  decision: 'all',
};

function withinHours(value: string | undefined, filter: FreshAgeFilter, now: number) {
  if (filter === 'all') return true;
  if (!value) return false;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return false;
  const age = now - timestamp;
  return age >= 0 && age <= Number(filter) * 60 * 60 * 1000;
}

function matchesApplication(job: JobWithMatch, filter: FreshApplicationFilter) {
  if (filter === 'all') return true;
  if (filter === 'not-applied') return !hasApplied(job.application);
  if (filter === 'submitted') return hasApplied(job.application);
  return (job.application?.status ?? 'discovered') === filter;
}

function matchesPostingState(job: JobWithMatch, filter: FreshPostingStateFilter) {
  const state = job.validityStatus ?? 'unknown';
  if (filter === 'all') return true;
  if (filter === 'viable') return !['closed', 'likely_closed'].includes(state);
  return state === filter;
}

function matchesScore(score: number | undefined, filter: FreshMatchFilter) {
  if (filter === 'all') return true;
  if (filter === 'unanalyzed') return score == null;
  if (score == null) return false;
  if (filter === '90-100') return score >= 90;
  if (filter === '80-89') return score >= 80 && score < 90;
  if (filter === '70-79') return score >= 70 && score < 80;
  if (filter === '60-69') return score >= 60 && score < 70;
  return score < 60;
}

export function matchesFreshOpening(job: JobWithMatch, filters: FreshOpeningFilters, now = Date.now()) {
  const query = filters.query.trim().toLowerCase();
  const location = filters.location.trim().toLowerCase();
  const opportunity = `${job.title} ${job.company} ${job.source}`.toLowerCase();
  const decision = job.match?.recommendation ?? 'unanalyzed';

  return (!query || opportunity.includes(query))
    && (filters.source === 'all' || job.source === filters.source)
    && withinHours(job.postedAt, filters.postedWithin, now)
    && withinHours(job.discoveredAt, filters.addedWithin, now)
    && matchesApplication(job, filters.application)
    && jobMatchesType(job, filters.jobType)
    && (!location || (job.location ?? '').toLowerCase().includes(location))
    && matchesPostingState(job, filters.postingState)
    && matchesScore(job.match?.overall, filters.match)
    && (filters.decision === 'all' || decision === filters.decision);
}

export function countActiveFreshOpeningFilters(filters: FreshOpeningFilters) {
  return Object.entries(filters).filter(([key, value]) => value !== DEFAULT_FRESH_OPENING_FILTERS[key as keyof FreshOpeningFilters]).length;
}
