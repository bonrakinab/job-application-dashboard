import type { MatchScore } from './types';

export type ApplicationPackEligibility = {
  allowed: boolean;
  code?: 'hard_blockers' | 'skip';
  reason?: string;
  blockers: string[];
  conditional: boolean;
};

export function applicationPackEligibility(match?: MatchScore): ApplicationPackEligibility {
  if (!match) return { allowed: true, blockers: [], conditional: false };

  const blockers = (match.blockers ?? []).filter(Boolean);
  if (blockers.length) {
    return {
      allowed: true,
      code: 'hard_blockers',
      reason: 'A gap-aware application pack can still be generated. It will maximize supported ATS terms and verified transferable evidence while leaving unsupported mandatory requirements visible as warnings.',
      blockers,
      conditional: true,
    };
  }

  if (match.recommendation === 'skip') {
    return {
      allowed: true,
      code: 'skip',
      reason: 'This is a low-fit role, but a gap-aware application pack can still be generated from the strongest verified evidence in the profile.',
      blockers: [],
      conditional: true,
    };
  }

  return { allowed: true, blockers: [], conditional: false };
}
