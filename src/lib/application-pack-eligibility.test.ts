import assert from 'node:assert/strict';
import test from 'node:test';
import { applicationPackEligibility } from './application-pack-eligibility';
import type { MatchScore } from './types';

function match(overrides: Partial<MatchScore> = {}): MatchScore {
  return {
    overall: 80,
    skills: 80,
    experience: 80,
    education: 80,
    domain: 80,
    location: 80,
    recommendation: 'strong',
    blockers: [],
    strengths: [],
    gaps: [],
    mustHave: [],
    preferred: [],
    matchedSkills: [],
    missingSkills: [],
    explanation: '',
    ...overrides,
  };
}

test('allows application packs for non-skip jobs without blockers', () => {
  assert.equal(applicationPackEligibility(match()).allowed, true);
});

test('blocks application packs when hard blockers are present and exposes them', () => {
  const result = applicationPackEligibility(match({
    recommendation: 'skip',
    blockers: ['Missing mandatory Sage ERP experience.'],
  }));
  assert.equal(result.allowed, false);
  assert.equal(result.code, 'hard_blockers');
  assert.deepEqual(result.blockers, ['Missing mandatory Sage ERP experience.']);
});

test('blocks skip jobs even when the model did not emit a blocker list', () => {
  const result = applicationPackEligibility(match({ recommendation: 'skip' }));
  assert.equal(result.allowed, false);
  assert.equal(result.code, 'skip');
});
