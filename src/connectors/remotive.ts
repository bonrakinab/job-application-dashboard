import type { Job } from '@/lib/types';
import { stableJobId, stripHtml } from '@/lib/utils';

type RemotiveItem = {
  id?: number;
  url?: string;
  title?: string;
  company_name?: string;
  category?: string;
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
};

type RemotiveResponse = { jobs?: RemotiveItem[] };

export async function fetchRemotiveJobs(): Promise<Job[]> {
  const response = await fetch('https://remotive.com/api/remote-jobs', {
    headers: { Accept: 'application/json', 'User-Agent': 'JobAgent/1.0 personal-job-search' },
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Remotive: ${response.status}`);
  const payload = await response.json() as RemotiveResponse;
  return (payload.jobs ?? [])
    .filter((item) => item.id != null && item.title && item.company_name && item.url)
    .map((item) => {
      const externalId = String(item.id);
      return {
        id: stableJobId('remotive', 'public-api', externalId),
        externalId,
        source: 'remotive',
        sourceKey: 'public-api',
        url: item.url!,
        applyUrl: item.url!,
        title: item.title!,
        company: item.company_name!,
        location: item.candidate_required_location || 'Remote',
        description: stripHtml(item.description || ''),
        postedAt: item.publication_date,
        salaryText: item.salary || undefined,
        employmentType: item.job_type,
        remote: true,
        workplaceType: 'Remote',
        department: item.category,
        raw: { sourceAttribution: 'Remotive' },
      } satisfies Job;
    });
}
