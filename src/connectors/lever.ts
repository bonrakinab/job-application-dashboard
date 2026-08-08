import type { AtsSource, Job } from '@/lib/types';
import { stableJobId, stripHtml } from '@/lib/utils';
import type { JobSourceAdapter } from './job-source';

type LeverPosting = {
  id: string;
  text: string;
  hostedUrl?: string;
  applyUrl?: string;
  descriptionPlain?: string;
  description?: string;
  createdAt?: number;
  workplaceType?: string;
  categories?: { location?: string; team?: string; commitment?: string };
};

export const leverAdapter: JobSourceAdapter = {
  kind: 'lever',
  async fetch(source: AtsSource) {
    const url = `https://api.lever.co/v0/postings/${encodeURIComponent(source.key)}?mode=json`;
    const response = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 1800 } });
    if (!response.ok) throw new Error(`Lever ${source.company}: ${response.status}`);
    const payload = await response.json() as LeverPosting[];
    return payload.map((item): Job => ({
      id: stableJobId('lever', source.key, item.id),
      externalId: item.id,
      source: 'lever',
      sourceKey: source.key,
      url: item.hostedUrl ?? item.applyUrl ?? `https://jobs.lever.co/${source.key}/${item.id}`,
      applyUrl: item.applyUrl ?? item.hostedUrl,
      title: item.text,
      company: source.company,
      location: item.categories?.location,
      description: item.descriptionPlain ?? stripHtml(item.description ?? ''),
      postedAt: item.createdAt ? new Date(item.createdAt).toISOString() : undefined,
      discoveredAt: new Date().toISOString(),
      employmentType: item.categories?.commitment,
      department: item.categories?.team,
      remote: item.workplaceType?.toLowerCase() === 'remote',
      workplaceType: item.workplaceType,
      raw: item,
    }));
  },
};
