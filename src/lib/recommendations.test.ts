import assert from 'node:assert/strict';
import test from 'node:test';
import { rankRecommendedJobs, opportunityStage, roleFamily } from './recommendations';
import type { CandidateProfile, JobWithMatch } from './types';

const profile: CandidateProfile = {
  name: 'Candidate',
  targetTitles: ['Machine Learning Engineer', 'Machine Learning Intern', 'ERP Analyst', 'Software Engineer Intern'],
  preferredLocations: ['Canada', 'Remote Canada'],
  skills: ['Python', 'SQL', 'Machine Learning', 'Oracle Fusion ERP Cloud'],
  yearsExperience: 2,
  degrees: [{ institution: 'University', degree: 'MSc', field: 'Computer Science' }],
};

function job(overrides: Partial<JobWithMatch>): JobWithMatch {
  return {
    id: 'job-1',
    externalId: 'external-1',
    source: 'test',
    sourceKey: 'test',
    url: 'https://example.com/job',
    title: 'Machine Learning Intern',
    company: 'Example',
    location: 'Canada',
    description: 'Internship using Python, SQL and machine learning.',
    remote: true,
    ...overrides,
  };
}

test('classifies internships and role families', () => {
  assert.equal(opportunityStage(job({})), 'internship');
  assert.equal(roleFamily(job({})), 'AI & machine learning');
  assert.equal(roleFamily(job({ title: 'Oracle Fusion ERP Analyst', description: 'Oracle Fusion ERP Cloud' })), 'ERP & enterprise systems');
});

test('promotes a relevant internship into recommended jobs', () => {
  const ranked = rankRecommendedJobs([job({})], profile);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].stage, 'internship');
  assert.equal(ranked[0].highlySuitable, true);
  assert.ok(ranked[0].priority >= ranked[0].match.overall);
});

test('does not recommend a hard-blocked senior role', () => {
  const ranked = rankRecommendedJobs([job({
    id: 'manager',
    title: 'Machine Learning Manager',
    description: 'Lead a team building machine learning systems with Python.',
  })], profile);
  assert.equal(ranked.length, 0);
});
