import type { Job } from '../lib/types';

export interface JobSearchQuery {
  titles: string[];
  locations: string[];
  postedWithinHours?: number;
}

export interface JobSourceAdapter {
  name: string;
  search(query: JobSearchQuery): Promise<Job[]>;
}

export async function discoverJobs(
  adapters: JobSourceAdapter[],
  query: JobSearchQuery,
): Promise<Job[]> {
  const batches = await Promise.allSettled(adapters.map((adapter) => adapter.search(query)));
  return batches.flatMap((batch) => (batch.status === 'fulfilled' ? batch.value : []));
}
