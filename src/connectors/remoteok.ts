import type { Job } from '@/lib/types';
import { stableJobId, stripHtml } from '@/lib/utils';

type RemoteOkItem = {
  id?: string | number;
  slug?: string;
  position?: string;
  company?: string;
  description?: string;
  location?: string;
  date?: string;
  tags?: string[];
  apply_url?: string;
  url?: string;
  salary_min?: number;
  salary_max?: number;
};

const DEFAULT_TAGS = [
  'dev',
  'engineer',
  'software',
  'python',
  'data',
  'ai',
  'cloud',
  'sys admin',
  'entry level',
  'intern',
];

function configuredTags() {
  const configured = process.env.REMOTEOK_TAGS?.split(',').map((value) => value.trim()).filter(Boolean);
  return configured?.length ? [...new Set(configured)].slice(0, 20) : DEFAULT_TAGS;
}

async function fetchFeed(url: string) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'JobAgent/1.0 personal-job-search' },
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Remote OK: ${response.status}`);
  const payload = await response.json() as RemoteOkItem[];
  return Array.isArray(payload) ? payload.filter((item) => item.id != null) : [];
}

export async function fetchRemoteOkJobs(): Promise<Job[]> {
  const urls = [
    'https://remoteok.com/api',
    ...configuredTags().map((tag) => `https://remoteok.com/api?tag=${encodeURIComponent(tag)}`),
  ];
  const settled = await Promise.allSettled(urls.map(fetchFeed));
  const rows = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  if (!rows.length && settled.every((result) => result.status === 'rejected')) {
    const first = settled.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    throw first?.reason instanceof Error ? first.reason : new Error('Remote OK requests failed.');
  }

  const deduped = [...new Map(rows.map((item) => [String(item.id), item])).values()];
  return deduped
    .filter((item) => item.position && item.company && (item.url || item.apply_url))
    .map((item) => {
      const externalId = String(item.id);
      const url = item.url || item.apply_url!;
      return {
        id: stableJobId('remoteok', 'public-api', externalId),
        externalId,
        source: 'remoteok',
        sourceKey: 'public-api',
        url,
        applyUrl: item.apply_url || url,
        title: item.position!,
        company: item.company!,
        location: item.location || 'Remote',
        description: stripHtml(item.description || ''),
        postedAt: item.date,
        salaryMin: item.salary_min && item.salary_min > 0 ? item.salary_min : undefined,
        salaryMax: item.salary_max && item.salary_max > 0 ? item.salary_max : undefined,
        remote: true,
        workplaceType: 'Remote',
        department: item.tags?.slice(0, 10).join(', '),
        raw: { sourceAttribution: 'Remote OK', slug: item.slug },
      } satisfies Job;
    });
}
