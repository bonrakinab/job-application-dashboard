import type { JobWithMatch } from './types';

export const FRESH_OPENINGS_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function discoveredTime(job: JobWithMatch) {
  if (!job.discoveredAt) return Number.NaN;
  return Date.parse(job.discoveredAt);
}

export function isFreshOpening(job: JobWithMatch, now = Date.now()) {
  const discovered = discoveredTime(job);
  if (!Number.isFinite(discovered)) return false;
  const cutoff = now - FRESH_OPENINGS_RETENTION_DAYS * DAY_MS;
  return discovered >= cutoff && discovered <= now;
}

export function freshOpenings(jobs: JobWithMatch[], now = Date.now()) {
  return jobs
    .filter((job) => isFreshOpening(job, now))
    .sort((a, b) => {
      const discoveredDelta = discoveredTime(b) - discoveredTime(a);
      if (discoveredDelta) return discoveredDelta;
      const postedA = a.postedAt ? Date.parse(a.postedAt) : 0;
      const postedB = b.postedAt ? Date.parse(b.postedAt) : 0;
      return postedB - postedA;
    });
}
