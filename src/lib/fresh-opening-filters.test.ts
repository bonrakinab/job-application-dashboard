import assert from 'node:assert/strict';
import test from 'node:test';
import {
  countActiveFreshOpeningFilters,
  DEFAULT_FRESH_OPENING_FILTERS,
  matchesFreshOpening,
  type FreshOpeningFilters,
} from './fresh-opening-filters';
import type { JobWithMatch } from './types';

const NOW = Date.parse('2026-08-25T04:00:00.000Z');

const job: JobWithMatch = {
  id: 'job-1',
  externalId: 'external-1',
  source: 'greenhouse',
  sourceKey: 'atlas',
  url: 'https://example.com/job-1',
  title: 'Full Stack Developer',
  company: 'Atlas Systems',
  location: 'Toronto, ON (Hybrid)',
  description: 'Build web applications.',
  postedAt: '2026-08-25T02:00:00.000Z',
  discoveredAt: '2026-08-25T03:00:00.000Z',
  workplaceType: 'Hybrid',
  validityStatus: 'active',
  application: { jobId: 'job-1', status: 'applied' },
  match: {
    overall: 86,
    skills: 88,
    experience: 82,
    education: 90,
    domain: 84,
    location: 90,
    recommendation: 'strong',
    blockers: [],
    strengths: [],
    gaps: [],
    mustHave: [],
    preferred: [],
    matchedSkills: [],
    missingSkills: [],
    explanation: '',
  },
};

function withFilters(values: Partial<FreshOpeningFilters>): FreshOpeningFilters {
  return { ...DEFAULT_FRESH_OPENING_FILTERS, ...values };
}

test('default Fresh openings filters keep every supplied job', () => {
  assert.equal(matchesFreshOpening(job, DEFAULT_FRESH_OPENING_FILTERS, NOW), true);
});

test('Fresh openings can be filtered through every visible column', () => {
  const filters = withFilters({
    query: 'atlas',
    source: 'greenhouse',
    postedWithin: '3',
    addedWithin: '1',
    application: 'submitted',
    jobType: 'hybrid',
    location: 'toronto',
    postingState: 'active',
    match: '80-89',
    decision: 'strong',
  });

  assert.equal(matchesFreshOpening(job, filters, NOW), true);
  assert.equal(matchesFreshOpening(job, { ...filters, postedWithin: '1' }, NOW), false);
  assert.equal(matchesFreshOpening(job, { ...filters, location: 'Ottawa' }, NOW), false);
  assert.equal(matchesFreshOpening(job, { ...filters, match: '90-100' }, NOW), false);
  assert.equal(matchesFreshOpening(job, { ...filters, decision: 'exceptional' }, NOW), false);
});

test('application and unanalyzed filters distinguish exact states', () => {
  assert.equal(matchesFreshOpening(job, withFilters({ application: 'applied' }), NOW), true);
  assert.equal(matchesFreshOpening(job, withFilters({ application: 'not-applied' }), NOW), false);

  const unanalyzed = { ...job, match: undefined, application: undefined };
  assert.equal(matchesFreshOpening(unanalyzed, withFilters({ application: 'discovered', match: 'unanalyzed', decision: 'unanalyzed' }), NOW), true);
});

test('active filter count supports the Clear control', () => {
  assert.equal(countActiveFreshOpeningFilters(DEFAULT_FRESH_OPENING_FILTERS), 0);
  assert.equal(countActiveFreshOpeningFilters(withFilters({ query: 'developer', location: 'Toronto', decision: 'strong' })), 3);
});
