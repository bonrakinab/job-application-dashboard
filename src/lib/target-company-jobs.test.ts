import assert from 'node:assert/strict';
import test from 'node:test';
import { rankTargetCompanyJobs, sameCompany } from './target-company-jobs';
import type { CandidateProfile, CompanyWatch, JobWithMatch } from './types';

const profile: CandidateProfile = {
  name: 'Candidate',
  targetTitles: ['Machine Learning Engineer', 'Software Engineer Intern', 'ERP Analyst'],
  preferredLocations: ['Canada', 'Toronto', 'Remote Canada'],
  skills: ['Python', 'SQL', 'Machine Learning', 'Oracle Fusion ERP Cloud'],
  yearsExperience: 2,
  degrees: [{ institution: 'University', degree: 'MSc', field: 'Computer Science' }],
};

const watchlist: CompanyWatch[] = [
  { company: 'Google', sector: 'Technology', priority: 1, enabled: true },
  { company: 'DoorDash', sector: 'Technology', priority: 2, enabled: true },
];

function job(overrides: Partial<JobWithMatch>): JobWithMatch {
  return {
    id: 'job-1',
    externalId: 'external-1',
    source: 'greenhouse',
    sourceKey: 'test',
    url: 'https://example.com/job',
    title: 'Software Engineer Intern',
    company: 'Google',
    location: 'Toronto, Canada',
    description: 'Internship using Python, SQL and machine learning.',
    remote: false,
    ...overrides,
  };
}

test('matches common company-name variants', () => {
  assert.equal(sameCompany('DoorDash', 'DoorDash Canada'), true);
  assert.equal(sameCompany('Google', 'Google Canada Inc.'), true);
  assert.equal(sameCompany('Google', 'Microsoft'), false);
});

test('ranks a target-company internship as highly suitable', () => {
  const ranked = rankTargetCompanyJobs([job({})], watchlist, profile);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].watchedCompany, 'Google');
  assert.equal(ranked[0].stage, 'internship');
  assert.equal(ranked[0].highlySuitable, true);
});

test('keeps off-profile target-company jobs but does not mark them recommended', () => {
  const ranked = rankTargetCompanyJobs([job({
    title: 'Enterprise Account Executive',
    description: 'Sales role managing enterprise accounts.',
  })], watchlist, profile);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].family, 'Other');
  assert.equal(ranked[0].recommended, false);
});

test('excludes jobs from employers outside the watchlist', () => {
  const ranked = rankTargetCompanyJobs([job({ company: 'Unwatched Startup' })], watchlist, profile);
  assert.equal(ranked.length, 0);
});
