import type { MatchScore } from './types';

export type ApplicationPackEligibility = {
  allowed: boolean;
  code?: 'hard_blockers' | 'skip';
  reason?: string;
  blockers: string[];
};

export function applicationPackEligibility(match?: MatchScore): ApplicationPackEligibility {
  if (!match) return { allowed: true, blockers: [] };

  const blockers = (match.blockers ?? []).filter(Boolean);
  if (blockers.length) {
    return {
      allowed: false,
      code: 'hard_blockers',
      reason: 'Application-pack generation is unavailable because this role has mandatory requirements that are not supported by the verified profile.',
      blockers,
    };
  }

  if (match.recommendation === 'skip') {
    return {
      allowed: false,
      code: 'skip',
      reason: 'Application-pack generation is unavailable because this role is currently classified as Skip. Re-analyze the job if the posting or profile evidence has changed.',
      blockers: [],
    };
  }

  return { allowed: true, blockers: [] };
}
