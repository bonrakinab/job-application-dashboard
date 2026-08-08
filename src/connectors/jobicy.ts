import type { Job } from '@/lib/types';
import { stableJobId, stripHtml } from '@/lib/utils';

type JobicyItem = {
  id?: string | number;
  url?: string;
  jobTitle?: string;
  companyName?: string;
  jobIndustry?: string[];
  jobType?: string[];
  jobGeo?: string;
  jobLevel?: string;
  jobExcerpt?: string;
  jobDescription?: string;
  pubDate?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: string;
};

type JobicyResponse = { jobs?: JobicyItem[]; results?: JobicyItem[] };

export async function fetchJobicyJobs(): Promise<Job[]> {
  const response = await fetch('https://jobicy.com/api/v2/remote-jobs?count=100&geo=canada', {
    headers: { Accept: 'application/json', 'User-Agent': 'JobAgent/1.0 personal-job-search' },
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Jobicy: ${response.status}`);
  const payload = await response.json() as JobicyResponse;
  const rows = payload.jobs ?? payload.results ?? [];
  return rows
    .filter((item) => item.id != null && item.jobTitle && item.companyName && item.url)
    .map((item) => {
      const externalId = String(item.id);
      return {
        id: stableJobId('jobicy', 'remote-canada', externalId),
        externalId,
        source: 'jobicy',
        sourceKey: 'remote-canada',
        url: item.url!,
        applyUrl: item.url!,
        title: item.jobTitle!,
        company: item.companyName!,
        location: item.jobGeo || 'Remote',
        description: stripHtml(item.jobDescription || item.jobExcerpt || ''),
        postedAt: item.pubDate,
        salaryMin: item.salaryMin,
        salaryMax: item.salaryMax,
        currency: item.salaryCurrency,
        salaryText: item.salaryMin || item.salaryMax
          ? `${item.salaryCurrency ?? ''} ${item.salaryMin ?? ''}${item.salaryMax ? `–${item.salaryMax}` : ''} ${item.salaryPeriod ?? ''}`.trim()
          : undefined,
        employmentType: item.jobType?.join(', '),
        remote: true,
        workplaceType: 'Remote',
        department: item.jobIndustry?.join(', '),
        raw: { level: item.jobLevel, industry: item.jobIndustry, jobType: item.jobType },
      } satisfies Job;
    });
}
