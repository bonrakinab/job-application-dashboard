import type { AtsSource, Job } from '@/lib/types';
import { stableJobId, stripHtml } from '@/lib/utils';
import type { JobSourceAdapter } from './job-source';

type GreenhouseJob = {
  id: number;
  title: string;
  updated_at?: string;
  absolute_url: string;
  location?: { name?: string };
  content?: string;
  departments?: Array<{ name?: string }>;
};

export const greenhouseAdapter: JobSourceAdapter = {
  kind: 'greenhouse',
  async fetch(source: AtsSource) {
    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(source.key)}/jobs?content=true`;
    const response = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 1800 } });
    if (!response.ok) throw new Error(`Greenhouse ${source.company}: ${response.status}`);
    const payload = await response.json() as { jobs?: GreenhouseJob[] };
    return (payload.jobs ?? []).map((item): Job => ({
      id: stableJobId('greenhouse', source.key, String(item.id)),
      externalId: String(item.id),
      source: 'greenhouse',
      sourceKey: source.key,
      url: item.absolute_url,
      applyUrl: item.absolute_url,
      title: item.title,
      company: source.company,
      location: item.location?.name,
      description: stripHtml(item.content ?? ''),
      postedAt: item.updated_at,
      discoveredAt: new Date().toISOString(),
      department: item.departments?.map((d) => d.name).filter(Boolean).join(', '),
      raw: item,
    }));
  },
};
