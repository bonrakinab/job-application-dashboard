import type { Job } from '@/lib/types';
import { stableJobId, stripHtml } from '@/lib/utils';

type HimalayasItem = {
  guid?: string;
  title?: string;
  excerpt?: string;
  companyName?: string;
  companySlug?: string;
  employmentType?: string;
  locationRestrictions?: string[];
  category?: string[];
  minSalary?: number | null;
  maxSalary?: number | null;
  salaryPeriod?: string;
  currency?: string;
  description?: string;
  pubDate?: string;
  applicationLink?: string;
};

type HimalayasPayload = { jobs?: HimalayasItem[] } | HimalayasItem[];

async function fetchPage(url: string) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'JobAgent/1.0 personal-job-search' },
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Himalayas: ${response.status}`);
  const payload = await response.json() as HimalayasPayload;
  return Array.isArray(payload) ? payload : payload.jobs ?? [];
}

export async function fetchHimalayasJobs(): Promise<Job[]> {
  const urls = [
    'https://himalayas.app/jobs/api/search?country=Canada&sort=recent&page=1',
    'https://himalayas.app/jobs/api/search?country=Canada&sort=recent&page=2',
    'https://himalayas.app/jobs/api/search?worldwide=true&sort=recent&page=1',
    'https://himalayas.app/jobs/api/search?worldwide=true&sort=recent&page=2',
  ];
  const settled = await Promise.allSettled(urls.map(fetchPage));
  const rows = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  if (!rows.length && settled.every((result) => result.status === 'rejected')) {
    const first = settled.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    throw first?.reason instanceof Error ? first.reason : new Error('Himalayas request failed.');
  }

  const deduped = [...new Map(rows.filter((item) => item.guid).map((item) => [item.guid!, item])).values()];
  return deduped
    .filter((item) => item.guid && item.title && item.companyName && item.applicationLink)
    .map((item) => {
      const location = item.locationRestrictions?.length ? item.locationRestrictions.join(', ') : 'Worldwide';
      return {
        id: stableJobId('himalayas', 'public-api', item.guid!),
        externalId: item.guid!,
        source: 'himalayas',
        sourceKey: 'public-api',
        url: item.applicationLink!,
        applyUrl: item.applicationLink!,
        title: item.title!,
        company: item.companyName!,
        location,
        description: stripHtml(item.description || item.excerpt || ''),
        postedAt: item.pubDate,
        salaryMin: item.minSalary ?? undefined,
        salaryMax: item.maxSalary ?? undefined,
        currency: item.currency,
        salaryText: item.minSalary || item.maxSalary
          ? `${item.currency ?? ''} ${item.minSalary ?? ''}${item.maxSalary ? `–${item.maxSalary}` : ''} ${item.salaryPeriod ?? ''}`.trim()
          : undefined,
        employmentType: item.employmentType,
        remote: true,
        workplaceType: 'Remote',
        department: item.category?.join(', '),
        raw: { sourceAttribution: 'Himalayas', companySlug: item.companySlug },
      } satisfies Job;
    });
}
