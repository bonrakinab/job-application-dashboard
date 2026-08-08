import type { Recommendation } from '@/lib/types';
export function StatusPill({ value }: { value: Recommendation }) { return <span className={`pill ${value}`}>{value}</span>; }
