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

export async function fetchRemoteOkJobs(): Promise<Job[]> {
  const response = await fetch('https://remoteok.com/api', {
    headers: { Accept: 'application/json', 'User-Agent': 'JobAgent/1.0 personal-job-search' },
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Remote OK: ${response.status}`);
  const payload = await response.json() as RemoteOkItem[];
  return (Array.isArray(payload) ? payload : [])
    .filter((item) => item.id != null && item.position && item.company && (item.url || item.apply_url))
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
        department: item.tags?.slice(0, 6).join(', '),
        raw: { sourceAttribution: 'Remote OK', slug: item.slug },
      } satisfies Job;
    });
}
