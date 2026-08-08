import assert from 'node:assert/strict';
import test from 'node:test';
import { deterministicScore, hardEligibility, locationMatchesPreference, titleMatchesTarget } from './scoring';
import type { CandidateProfile, Job } from './types';

const profile: CandidateProfile = {
  name: 'Test Candidate',
  targetTitles: ['AI Engineer', 'Machine Learning Engineer', 'Data Scientist'],
  preferredLocations: ['Ontario', 'Toronto', 'Remote Canada'],
  skills: ['Python', 'SQL', 'Machine Learning'],
  yearsExperience: 2,
  degrees: [{ institution: 'Example University', degree: 'MSc', field: 'Computer Science' }],
  workAuthorization: ['Canada'],
};

function job(overrides: Partial<Job> = {}): Job {
  return {
    externalId: '1',
    source: 'test',
    sourceKey: 'test',
    url: 'https://example.com/job/1',
    title: 'AI Engineer',
    company: 'Example',
    location: 'Toronto, Ontario, Canada',
    description: 'Build machine learning systems using Python and SQL.',
    ...overrides,
  };
}

test('role-family matching preserves AI/ML domain meaning', () => {
  assert.equal(titleMatchesTarget('Civil Engineer', profile.targetTitles), false);
  assert.equal(titleMatchesTarget('AI Platform Engineer', profile.targetTitles), true);
  assert.equal(titleMatchesTarget('Machine Learning Engineer', profile.targetTitles), true);
});

test('location matching does not treat Remote US as Remote Canada', () => {
  assert.equal(locationMatchesPreference(job({ location: 'Remote - United States', remote: true }), profile), false);
  assert.equal(locationMatchesPreference(job({ location: 'Remote Canada', remote: true }), profile), true);
  assert.equal(locationMatchesPreference(job({ location: undefined, remote: false }), profile), false);
});

test('principal seniority is blocked for a low-experience profile', () => {
  const blockers = hardEligibility(job({ title: 'Principal AI Engineer' }), profile);
  assert.ok(blockers.some((value) => value.includes('seniority')));
});

test('manager titles are blocked for a low-experience profile even when AI/engineering keywords match', () => {
  const score = deterministicScore(job({ title: 'AI Engineering Manager' }), profile);
  assert.ok(score.blockers.some((value) => value.includes('seniority')));
  assert.equal(score.recommendation, 'skip');
  assert.ok(score.overall <= 49);
});

test('explicit U.S. citizenship restrictions are hard blockers', () => {
  const blockers = hardEligibility(job({ description: 'Must be a US citizen. Build AI systems.' }), profile);
  assert.ok(blockers.some((value) => value.includes('U.S. citizenship')));
});

test('active security clearance requirements are hard blockers', () => {
  const blockers = hardEligibility(job({ description: 'Active security clearance required.' }), profile);
  assert.ok(blockers.some((value) => value.includes('security clearance')));
});

test('large stated experience gaps are hard blockers', () => {
  const blockers = hardEligibility(job({ description: 'Requires 8+ years of professional experience in machine learning.' }), profile);
  assert.ok(blockers.some((value) => value.includes('8+ years')));
});

test('hard blockers cap the score below recommendation threshold', () => {
  const score = deterministicScore(job({ title: 'Principal AI Engineer' }), profile);
  assert.equal(score.recommendation, 'skip');
  assert.ok(score.overall <= 49);
});

test('a relevant eligible role can score strongly when the compact profile skills match', () => {
  const score = deterministicScore(job(), profile);
  assert.equal(score.blockers.length, 0);
  assert.ok(score.skills >= 90);
  assert.ok(score.overall >= 80);
});

test('broad profiles are not penalized for carrying unrelated skills', () => {
  const broadProfile: CandidateProfile = {
    ...profile,
    skills: [
      'Python', 'SQL', 'Machine Learning', 'Deep Learning', 'LLMs', 'Computer Vision',
      'R', 'MATLAB', 'JavaScript', 'Oracle Fusion ERP', 'OCI', 'JIRA', 'Linux',
      'BERT', 'GNN', 'CLIP', 'HNSW', 'FAISS', 'Postman', 'Agile',
    ],
  };
  const score = deterministicScore(job({ description: 'Build machine learning systems using Python, SQL, and deep learning.' }), broadProfile);
  assert.ok(score.skills >= 80);
  assert.ok(score.overall >= 80);
});

test('senior titles are treated as stretch roles for low-experience profiles without becoming hard blockers', () => {
  const score = deterministicScore(job({ title: 'Senior AI Engineer' }), profile);
  assert.equal(score.blockers.length, 0);
  assert.ok(score.overall <= 69);
  assert.equal(score.recommendation, 'stretch');
  assert.ok(score.gaps.some((value) => value.includes('seniority')));
});

test('a role with no configured skill evidence cannot become a strong recommendation from title and location alone', () => {
  const score = deterministicScore(job({ description: 'Own stakeholder planning, roadmaps and vendor contracts.' }), profile);
  assert.ok(score.skills <= 20);
  assert.ok(score.overall < 80);
});
