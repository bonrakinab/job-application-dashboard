import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateStartupFit } from './startup-fit';
import type { CandidateProfile, Job } from './types';

const profile: CandidateProfile = {
  name: 'Candidate', targetTitles: ['Software Engineer'], preferredLocations: ['Canada'],
  skills: ['TypeScript', 'API Integration', 'Workflow Automation'],
  experience: [{ organization: 'Example', title: 'Engineer', bullets: ['Led and deployed an end-to-end API integration.'] }],
  projects: [{ name: 'Automation agent', description: 'Workflow automation product.', bullets: ['Built a full-stack workflow automation product.'] }],
};

const ycJob: Job = {
  externalId: '1', source: 'ycombinator', sourceKey: 'yc-startup-jobs', url: 'https://example.com',
  title: 'Product Engineer', company: 'Startup', location: 'Remote (CA)',
  description: 'Own a full-stack product end to end with high autonomy. Build API integrations and automation.', yc: { batch: 'W26' },
};

test('calculates a separate YC startup-fit score from verified builder evidence', () => {
  const score = calculateStartupFit(ycJob, profile);
  assert.ok(score != null && score >= 50 && score <= 100);
});

test('does not create startup-fit scores for ordinary jobs', () => {
  assert.equal(calculateStartupFit({ ...ycJob, source: 'greenhouse', sourceKey: 'company', yc: undefined }, profile), undefined);
});
