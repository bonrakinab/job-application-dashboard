import type { AtsSource, Job } from '@/lib/types';

export interface JobSourceAdapter {
  kind: AtsSource['kind'];
  fetch(source: AtsSource): Promise<Job[]>;
}
