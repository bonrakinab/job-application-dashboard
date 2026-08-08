import type { AtsSource, Job } from '@/lib/types';
import { stableJobId } from '@/lib/utils';
import type { JobSourceAdapter } from './job-source';

type SalaryComponent = { compensationType?: string; currencyCode?: string | null; minValue?: number | null; maxValue?: number | null };
type AshbyJob = {
  title: string;
  location?: string;
  department?: string;
  team?: string;
  isListed?: boolean;
  isRemote?: boolean;
  workplaceType?: string;
  descriptionPlain?: string;
  publishedAt?: string;
  employmentType?: string;
  jobUrl: string;
  applyUrl?: string;
  compensation?: { scrapeableCompensationSalarySummary?: string; summaryComponents?: SalaryComponent[] };
};

export const ashbyAdapter: JobSourceAdapter = {
  kind: 'ashby',
  async fetch(source: AtsSource) {
    const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(source.key)}?includeCompensation=true`;
    const response = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 1800 } });
    if (!response.ok) throw new Error(`Ashby ${source.company}: ${response.status}`);
    const payload = await response.json() as { jobs?: AshbyJob[] };
    return (payload.jobs ?? []).filter((j) => j.isListed !== false).map((item): Job => {
      const externalId = item.jobUrl.split('/').filter(Boolean).at(-1) ?? item.jobUrl;
      const salary = item.compensation?.summaryComponents?.find((c) => c.compensationType === 'Salary');
      return {
        id: stableJobId('ashby', source.key, externalId),
        externalId,
        source: 'ashby',
        sourceKey: source.key,
        url: item.jobUrl,
        applyUrl: item.applyUrl ?? item.jobUrl,
        title: item.title,
        company: source.company,
        location: item.location,
        description: item.descriptionPlain ?? '',
        postedAt: item.publishedAt,
        discoveredAt: new Date().toISOString(),
        salaryMin: salary?.minValue ?? undefined,
        salaryMax: salary?.maxValue ?? undefined,
        currency: salary?.currencyCode ?? undefined,
        salaryText: item.compensation?.scrapeableCompensationSalarySummary,
        employmentType: item.employmentType,
        department: item.team ?? item.department,
        remote: item.isRemote,
        workplaceType: item.workplaceType,
        raw: item,
      };
    });
  },
};
