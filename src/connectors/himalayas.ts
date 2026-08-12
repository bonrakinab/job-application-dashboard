import type { Job } from '@/lib/types';
import { stableJobId, stripHtml } from '@/lib/utils';

type HimalayasLocation = string | { name?: string; alpha2?: string; slug?: string };

type HimalayasItem = {
  guid?: string;
  title?: string;
  excerpt?: string;
  companyName?: string;
  companySlug?: string;
  employmentType?: string;
  locationRestrictions?: HimalayasLocation[];
  category?: string[];
  categories?: string[];
  minSalary?: number | null;
  maxSalary?: number | null;
  salaryPeriod?: string;
  currency?: string;
  description?: string;
  pubDate?: string | number;
  applicationLink?: string;
};

type HimalayasPayload = { jobs?: HimalayasItem[]; totalCount?: number } | HimalayasItem[];

const DEFAULT_SEARCH_QUERIES = [
  'machine learning',
  'artificial intelligence',
  'data analyst',
  'data scientist',
  'software engineer',
  'business analyst',
  'solutions engineer',
  'technical consultant',
  'oracle',
  'erp',
  'cloud',
  'intern',
];

function searchQueries() {
  const configured = process.env.HIMALAYAS_SEARCH_QUERIES?.split(',').map((value) => value.trim()).filter(Boolean);
  return configured?.length ? [...new Set(configured)].slice(0, 20) : DEFAULT_SEARCH_QUERIES;
}

function maxPagesPerQuery() {
  const value = Number(process.env.HIMALAYAS_MAX_PAGES_PER_QUERY || 6);
  return Math.max(1, Math.min(10, Number.isFinite(value) ? Math.floor(value) : 6));
}

function normalizeDate(value?: string | number) {
  if (value == null || value === '') return undefined;
  let timestamp: number;
  if (typeof value === 'number') {
    timestamp = value < 100_000_000_000 ? value * 1000 : value;
  } else if (/^\d{10,13}$/.test(value.trim())) {
    const numeric = Number(value);
    timestamp = numeric < 100_000_000_000 ? numeric * 1000 : numeric;
  } else {
    timestamp = new Date(value).getTime();
  }
  if (!Number.isFinite(timestamp)) return undefined;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function locationLabel(restrictions?: HimalayasLocation[]) {
  if (!restrictions?.length) return 'Worldwide';
  const values = restrictions.map((restriction) => {
    if (typeof restriction === 'string') return restriction;
    return restriction.name || restriction.alpha2 || restriction.slug || '';
  }).filter(Boolean);
  return values.length ? values.join(', ') : 'Worldwide';
}

function companyLabel(item: HimalayasItem) {
  const name = item.companyName?.trim();
  if (name && name.toLowerCase() !== 'name') return name;
  if (!item.companySlug) return 'Company not listed';
  return item.companySlug.split('-').filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export function normalizeHimalayasItem(item: HimalayasItem): Job | null {
  if (!item.guid || !item.title || !item.applicationLink) return null;
  const categories = item.categories ?? item.category ?? [];
  return {
    id: stableJobId('himalayas', 'public-api', item.guid),
    externalId: item.guid,
    source: 'himalayas',
    sourceKey: 'public-api',
    url: item.applicationLink,
    applyUrl: item.applicationLink,
    title: item.title,
    company: companyLabel(item),
    location: locationLabel(item.locationRestrictions),
    description: stripHtml(item.description || item.excerpt || ''),
    postedAt: normalizeDate(item.pubDate),
    salaryMin: item.minSalary ?? undefined,
    salaryMax: item.maxSalary ?? undefined,
    currency: item.currency,
    salaryText: item.minSalary || item.maxSalary
      ? `${item.currency ?? ''} ${item.minSalary ?? ''}${item.maxSalary ? `–${item.maxSalary}` : ''} ${item.salaryPeriod ?? ''}`.trim()
      : undefined,
    employmentType: item.employmentType,
    remote: true,
    workplaceType: 'Remote',
    department: categories.length ? categories.join(', ') : undefined,
    raw: { sourceAttribution: 'Himalayas', companySlug: item.companySlug },
  } satisfies Job;
}

async function fetchPage(query: string, page: number) {
  const params = new URLSearchParams({ q: query, country: 'Canada', sort: 'recent', page: String(page) });
  const response = await fetch(`https://himalayas.app/jobs/api/search?${params.toString()}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'JobAgent/1.0 personal-job-search' },
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Himalayas ${query} page ${page}: ${response.status}`);
  const payload = await response.json() as HimalayasPayload;
  return Array.isArray(payload) ? payload : payload.jobs ?? [];
}

async function fetchQuery(query: string) {
  const rows: HimalayasItem[] = [];
  for (let page = 1; page <= maxPagesPerQuery(); page += 1) {
    try {
      const next = await fetchPage(query, page);
      rows.push(...next);
      if (next.length < 20) break;
    } catch (error) {
      if (!rows.length) throw error;
      break;
    }
  }
  return rows;
}

export async function fetchHimalayasJobs(): Promise<Job[]> {
  const settled = await Promise.allSettled(searchQueries().map(fetchQuery));
  const rows = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  if (!rows.length && settled.every((result) => result.status === 'rejected')) {
    const first = settled.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    throw first?.reason instanceof Error ? first.reason : new Error('Himalayas requests failed.');
  }

  const deduped = [...new Map(rows.filter((item) => item.guid).map((item) => [item.guid!, item])).values()];
  return deduped.map(normalizeHimalayasItem).filter((job): job is Job => Boolean(job));
}
