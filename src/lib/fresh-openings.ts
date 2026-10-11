import type { JobWithMatch } from './types';

export const FRESH_OPENINGS_WINDOW_HOURS = 24;
const HOUR_MS = 60 * 60 * 1000;

export type SourcePostingFreshness = 'verified-fresh' | 'older' | 'unverified';

function discoveredTime(job: JobWithMatch) {
  if (!job.discoveredAt) return Number.NaN;
  return Date.parse(job.discoveredAt);
}

function postedTime(job: JobWithMatch) {
  if (!job.postedAt) return Number.NaN;
  return Date.parse(job.postedAt);
}

function withinWindow(value: number, now: number) {
  const cutoff = now - FRESH_OPENINGS_WINDOW_HOURS * HOUR_MS;
  return Number.isFinite(value) && value >= cutoff && value <= now;
}

export function isFreshOpening(job: JobWithMatch, now = Date.now()) {
  const discovered = discoveredTime(job);
  return withinWindow(discovered, now);
}

export function sourcePostingFreshness(job: JobWithMatch, now = Date.now()): SourcePostingFreshness {
  const posted = postedTime(job);
  if (!Number.isFinite(posted) || posted > now) return 'unverified';
  return withinWindow(posted, now) ? 'verified-fresh' : 'older';
}

export function freshOpenings(jobs: JobWithMatch[], now = Date.now()) {
  return jobs
    .filter((job) => isFreshOpening(job, now))
    .sort((a, b) => {
      const freshnessDelta = Number(sourcePostingFreshness(b, now) === 'verified-fresh')
        - Number(sourcePostingFreshness(a, now) === 'verified-fresh');
      if (freshnessDelta) return freshnessDelta;
      const postedDelta = postedTime(b) - postedTime(a);
      if (Number.isFinite(postedDelta) && postedDelta) return postedDelta;
      return discoveredTime(b) - discoveredTime(a);
    });
}
