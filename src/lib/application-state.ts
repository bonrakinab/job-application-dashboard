import type { ApplicationRecord } from './types';

export type ApplicationFilter = 'all' | 'applied' | 'not-applied';

const APPLIED_STATUSES = new Set<ApplicationRecord['status']>([
  'applied',
  'interview',
  'rejected',
  'offer',
  'withdrawn',
]);

export function hasApplied(application?: Pick<ApplicationRecord, 'status'>) {
  return Boolean(application && APPLIED_STATUSES.has(application.status));
}

export function applicationLabel(application?: Pick<ApplicationRecord, 'status'>) {
  const status = application?.status ?? 'discovered';
  if (status === 'applied') return '✓ Applied';
  if (status === 'interview') return '✓ Applied · Interview';
  if (status === 'rejected') return '✓ Applied · Rejected';
  if (status === 'offer') return '✓ Applied · Offer';
  if (status === 'withdrawn') return '✓ Applied · Withdrawn';
  if (status === 'reviewing') return 'Not applied · Reviewing';
  if (status === 'approved') return 'Not applied · Ready';
  return 'Not applied';
}

export function matchesApplicationFilter(
  application: Pick<ApplicationRecord, 'status'> | undefined,
  filter: ApplicationFilter,
) {
  if (filter === 'all') return true;
  return filter === 'applied' ? hasApplied(application) : !hasApplied(application);
}
