import type { JobWithMatch } from './types';
import { normalizeText } from './utils';

export interface DuplicateMeta {
  canonicalId?: string;
  duplicateCount: number;
  reposted: boolean;
  firstSeen?: string;
  lastSeen?: string;
  sources: string[];
}

export interface DuplicateGroup {
  key: string;
  canonical: JobWithMatch;
  jobs: JobWithMatch[];
  meta: DuplicateMeta;
}

function normalizedCompany(value: string) {
  return normalizeText(value)
    .replace(/\b(inc|incorporated|corp|corporation|ltd|limited|llc|company|co)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizedTitle(value: string) {
  return normalizeText(value)
    .replace(/\b(remote|hybrid)\b/g, ' ')
    .replace(/\b(canada|ontario|toronto|vancouver|montreal|ottawa|waterloo|windsor)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function canonicalJobKey(job: Pick<JobWithMatch, 'company' | 'title'>) {
  return `${normalizedCompany(job.company)}::${normalizedTitle(job.title)}`;
}

function timestamp(job: JobWithMatch) {
  const values = [job.postedAt, job.discoveredAt, job.lastSeenAt]
    .map((value) => value ? Date.parse(value) : Number.NaN)
    .filter(Number.isFinite);
  return values.length ? Math.max(...values) : 0;
}

function winnerScore(job: JobWithMatch) {
  const validity = job.validityStatus === 'active' ? 40 : job.validityStatus === 'likely_active' ? 20 : job.validityStatus === 'unknown' || !job.validityStatus ? 0 : -100;
  const match = job.match?.overall ?? 0;
  const health = job.healthScore ?? 50;
  return validity + match + health * 0.4 + timestamp(job) / 1e13;
}

function seenRange(jobs: JobWithMatch[]) {
  const dates = jobs.flatMap((job) => [job.postedAt, job.discoveredAt])
    .filter((value): value is string => Boolean(value))
    .map((value) => Date.parse(value))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (!dates.length) return {};
  return {
    firstSeen: new Date(dates[0]).toISOString(),
    lastSeen: new Date(dates[dates.length - 1]).toISOString(),
    spanDays: (dates[dates.length - 1] - dates[0]) / 86_400_000,
  };
}

export function duplicateGroups(jobs: JobWithMatch[]): DuplicateGroup[] {
  const buckets = new Map<string, JobWithMatch[]>();
  for (const job of jobs) {
    if (!job.id) continue;
    const key = canonicalJobKey(job);
    if (!key || key === '::') continue;
    const bucket = buckets.get(key) ?? [];
    bucket.push(job);
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => {
      const jobsSorted = [...group].sort((a, b) => winnerScore(b) - winnerScore(a));
      const canonical = jobsSorted[0];
      const range = seenRange(group);
      const sources = [...new Set(group.map((job) => job.source))].sort();
      const reposted = group.length > 1 && ((range.spanDays ?? 0) >= 3 || sources.length === 1);
      return {
        key,
        canonical,
        jobs: jobsSorted,
        meta: {
          canonicalId: canonical.id,
          duplicateCount: group.length - 1,
          reposted,
          firstSeen: range.firstSeen,
          lastSeen: range.lastSeen,
          sources,
        },
      };
    })
    .sort((a, b) => b.jobs.length - a.jobs.length || winnerScore(b.canonical) - winnerScore(a.canonical));
}

export function collapseDuplicateJobs(jobs: JobWithMatch[]) {
  const groups = duplicateGroups(jobs);
  const duplicateIds = new Set<string>();
  const meta = new Map<string, DuplicateMeta>();
  for (const group of groups) {
    if (group.canonical.id) meta.set(group.canonical.id, group.meta);
    for (const duplicate of group.jobs.slice(1)) if (duplicate.id) duplicateIds.add(duplicate.id);
  }
  return {
    jobs: jobs.filter((job) => !job.id || !duplicateIds.has(job.id)),
    meta,
    groups,
  };
}
