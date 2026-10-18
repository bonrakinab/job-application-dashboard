import type { JobWithMatch } from './types';
import { isMainCareerJob } from './part-time-jobs';

export const FORTUNE_500_CATALOG_PROFILE_ID = 'fortune500';

export function isFortune500CatalogJob(job: JobWithMatch) {
  if (String(job.applicationProfileId ?? '') === FORTUNE_500_CATALOG_PROFILE_ID) return true;
  if (!job.raw || typeof job.raw !== 'object') return false;
  return (job.raw as Record<string, unknown>).fortune500_catalog === true;
}

function canonicalUrl(value?: string) {
  if (!value) return '';
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|source$|src$|ref$|referrer$)/i.test(key)) url.searchParams.delete(key);
    }
    url.hash = '';
    const path = url.pathname.replace(/\/$/, '') || '/';
    return `${url.protocol}//${url.host}${path}${url.search}`.toLowerCase();
  } catch {
    return value.trim().replace(/\/$/, '').toLowerCase();
  }
}

function fallbackKey(job: JobWithMatch) {
  const url = canonicalUrl(job.applyUrl || job.url);
  if (url) return `url:${url}`;
  const external = `${job.company}|${job.externalId}`.trim().toLowerCase();
  if (external !== '|') return `external:${external}`;
  return `title:${job.company}|${job.title}|${job.location ?? ''}`.toLowerCase();
}

function prefer(left: JobWithMatch, right: JobWithMatch) {
  const leftCatalog = isFortune500CatalogJob(left);
  const rightCatalog = isFortune500CatalogJob(right);
  if (leftCatalog !== rightCatalog) return rightCatalog ? right : left;

  const leftVerified = left.validityStatus === 'active' ? 2 : left.validityStatus === 'likely_active' ? 1 : 0;
  const rightVerified = right.validityStatus === 'active' ? 2 : right.validityStatus === 'likely_active' ? 1 : 0;
  if (leftVerified !== rightVerified) return rightVerified > leftVerified ? right : left;

  const leftSeen = new Date(left.lastSeenAt ?? left.discoveredAt ?? 0).getTime() || 0;
  const rightSeen = new Date(right.lastSeenAt ?? right.discoveredAt ?? 0).getTime() || 0;
  return rightSeen > leftSeen ? right : left;
}

export function jobsForFortune500Catalog(jobs: JobWithMatch[]) {
  const eligible = jobs.filter((job) => isMainCareerJob(job) || isFortune500CatalogJob(job));
  const deduped = new Map<string, JobWithMatch>();
  for (const job of eligible) {
    const key = fallbackKey(job);
    const previous = deduped.get(key);
    deduped.set(key, previous ? prefer(previous, job) : job);
  }
  return [...deduped.values()];
}
