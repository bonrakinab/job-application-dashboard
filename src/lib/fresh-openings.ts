import type { JobWithMatch } from './types';

export const FRESH_OPENINGS_WINDOW_HOURS = 24;
const HOUR_MS = 60 * 60 * 1000;

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
  const posted = postedTime(job);
  return withinWindow(discovered, now) && withinWindow(posted, now);
}

export function freshOpenings(jobs: JobWithMatch[], now = Date.now()) {
  return jobs
    .filter((job) => isFreshOpening(job, now))
    .sort((a, b) => {
      const postedDelta = postedTime(b) - postedTime(a);
      if (postedDelta) return postedDelta;
      return discoveredTime(b) - discoveredTime(a);
    });
}
