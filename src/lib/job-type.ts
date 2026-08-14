import type { Job } from './types';

export type JobTypeFilter = 'all' | 'full-time' | 'part-time' | 'contract' | 'remote' | 'hybrid';

function normalizedJobText(job: Pick<Job, 'title' | 'location' | 'employmentType' | 'workplaceType'>) {
  return `${job.title ?? ''} ${job.location ?? ''} ${job.employmentType ?? ''} ${job.workplaceType ?? ''}`.toLowerCase();
}

export function jobMatchesType(job: Pick<Job, 'title' | 'location' | 'employmentType' | 'workplaceType' | 'remote'>, filter: JobTypeFilter) {
  if (filter === 'all') return true;
  const text = normalizedJobText(job);
  if (filter === 'full-time') return /\b(full[ -]?time|permanent)\b/.test(text);
  if (filter === 'part-time') return /\b(part[ -]?time)\b/.test(text);
  if (filter === 'contract') return /\b(contract|contractor|contractual|temporary|temp\b|fixed[ -]?term|freelance)\b/.test(text);
  if (filter === 'remote') return job.remote === true || /\b(remote|work from home|wfh|distributed)\b/.test(text);
  return /\b(hybrid|hybrid-remote|flexible workplace)\b/.test(text);
}

export function jobTypeLabels(job: Pick<Job, 'title' | 'location' | 'employmentType' | 'workplaceType' | 'remote'>) {
  const labels: string[] = [];
  if (jobMatchesType(job, 'full-time')) labels.push('Full-time');
  if (jobMatchesType(job, 'part-time')) labels.push('Part-time');
  if (jobMatchesType(job, 'contract')) labels.push('Contract');
  if (jobMatchesType(job, 'remote')) labels.push('Remote');
  if (jobMatchesType(job, 'hybrid')) labels.push('Hybrid');
  return labels;
}
