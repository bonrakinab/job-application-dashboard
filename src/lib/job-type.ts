import type { Job } from './types';

export type JobTypeFilter = 'all' | 'full-time' | 'part-time' | 'contract' | 'remote' | 'hybrid' | 'on-site';

function normalizedJobText(job: Pick<Job, 'title' | 'location' | 'employmentType' | 'workplaceType'>) {
  return `${job.title ?? ''} ${job.location ?? ''} ${job.employmentType ?? ''} ${job.workplaceType ?? ''}`.toLowerCase();
}

function hasRemoteSignal(text: string) {
  return /\b(remote|work from home|wfh|distributed)\b/.test(text);
}

function hasHybridSignal(text: string) {
  return /\b(hybrid|hybrid-remote|flexible workplace)\b/.test(text);
}

function hasOnSiteSignal(text: string) {
  return /\b(on[ -]?site|in[ -]?office|office[ -]?based|office based|work(?:ing)? on[ -]?site)\b/.test(text);
}

export function jobMatchesType(job: Pick<Job, 'title' | 'location' | 'employmentType' | 'workplaceType' | 'remote'>, filter: JobTypeFilter) {
  if (filter === 'all') return true;
  const text = normalizedJobText(job);
  if (filter === 'full-time') return /\b(full[\s_-]*time|permanent)\b/.test(text);
  if (filter === 'part-time') return /\b(part[\s_-]*time|casual)\b/.test(text);
  if (filter === 'contract') return /\b(contract|contractor|contractual|temporary|temp\b|fixed[ -]?term|freelance)\b/.test(text);
  // Hybrid is often also flagged remote by source feeds. Give explicit workplace
  // information precedence so the three workplace filters do not overlap.
  const structured = (job.workplaceType ?? '').toLowerCase();
  const signal = hasHybridSignal(structured) ? 'hybrid'
    : hasOnSiteSignal(structured) ? 'on-site'
    : hasRemoteSignal(structured) ? 'remote'
    : hasHybridSignal(text) ? 'hybrid'
    : hasOnSiteSignal(text) ? 'on-site'
    : job.remote === true || hasRemoteSignal(text) ? 'remote'
    : job.remote === false ? 'on-site' : undefined;
  return signal === filter;
}

export function jobTypeLabels(job: Pick<Job, 'title' | 'location' | 'employmentType' | 'workplaceType' | 'remote'>) {
  const labels: string[] = [];
  if (jobMatchesType(job, 'full-time')) labels.push('Full-time');
  if (jobMatchesType(job, 'part-time')) labels.push('Part-time');
  if (jobMatchesType(job, 'contract')) labels.push('Contract');
  if (jobMatchesType(job, 'remote')) labels.push('Remote');
  if (jobMatchesType(job, 'hybrid')) labels.push('Hybrid');
  if (jobMatchesType(job, 'on-site')) labels.push('On-site');
  return labels;
}
