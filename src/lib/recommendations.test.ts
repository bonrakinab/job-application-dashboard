import assert from 'node:assert/strict';
import test from 'node:test';
import { rankRecommendedJobs, opportunityStage, roleFamily } from './recommendations';
import type { CandidateProfile, JobWithMatch, MatchScore } from './types';

const profile: CandidateProfile = {
  name: 'Candidate',
  targetTitles: ['Machine Learning Engineer', 'Machine Learning Intern', 'ERP Analyst', 'Software Engineer Intern', 'Enterprise Applications Engineer', 'IT Analyst'],
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

function strongMatch(): MatchScore {
  return {
    overall: 90,
    skills: 90,
    experience: 80,
    education: 90,
    domain: 90,
    location: 100,
    recommendation: 'exceptional',
    blockers: [],
    strengths: ['Python'],
    gaps: [],
    mustHave: [],
    preferred: [],
    matchedSkills: ['Python'],
    missingSkills: [],
    explanation: 'Test match',
    model: 'test',
  };
}

test('classifies internships and role families', () => {
  assert.equal(opportunityStage(job({})), 'internship');
  assert.equal(roleFamily(job({})), 'AI & machine learning');
  assert.equal(roleFamily(job({ title: 'Oracle Fusion ERP Analyst', description: 'Oracle Fusion ERP Cloud' })), 'ERP & enterprise systems');
  assert.equal(roleFamily(job({ title: 'Software Engineering Intern, Backend', description: 'Build APIs.' })), 'Software engineering');
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

test('keeps sales and finance false positives out of Recommended Jobs even with high stored scores', () => {
  const ranked = rankRecommendedJobs([
    job({
      id: 'sales',
      title: 'Enterprise Sales Engineer - Toronto',
      description: 'Technical enterprise sales role using Python.',
      match: strongMatch(),
    }),
    job({
      id: 'finance',
      title: 'Financial Analyst',
      description: 'Financial reporting and analysis.',
      match: { ...strongMatch(), recommendation: 'strong', overall: 85 },
    }),
  ], profile);
  assert.equal(ranked.length, 0);
});
