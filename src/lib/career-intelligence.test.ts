import assert from 'node:assert/strict';
import test from 'node:test';
import { collapseDuplicateJobs } from './job-duplicates';
import { buildInterviewPrep } from './interview-prep';
import { buildMarketInsights } from './market-insights';
import { filterJobsForSearchProfile, profileForSearch } from './search-profiles';
import type { ApplicationPack, CandidateProfile, JobWithMatch, SearchProfile } from './types';

const profile: CandidateProfile = {
  name: 'Candidate',
  targetTitles: ['Software Engineer', 'ERP Analyst'],
  preferredLocations: ['Canada'],
  skills: ['Python', 'SQL', 'Oracle Fusion', 'Machine Learning'],
  yearsExperience: 2,
  degrees: [{ institution: 'University', degree: 'MSc' }],
};

function job(id: string, title: string, company = 'Acme', description = '', source = 'workday'): JobWithMatch {
  return {
    id,
    externalId: id,
    source,
    sourceKey: company.toLowerCase(),
    url: `https://example.com/${id}`,
    title,
    company,
    location: 'Canada',
    description,
    discoveredAt: id === 'old' ? '2026-08-01T00:00:00Z' : '2026-08-10T00:00:00Z',
    validityStatus: 'active',
    healthScore: id === 'old' ? 80 : 95,
  };
}

test('duplicate intelligence collapses repeated company/title listings', () => {
  const first = job('old', 'ERP Analyst');
  const second = job('new', 'ERP Analyst');
  const result = collapseDuplicateJobs([first, second, job('software', 'Software Engineer')]);
  assert.equal(result.jobs.length, 2);
  assert.ok(result.jobs.some((item) => item.id === 'new'));
  assert.equal(result.groups[0].meta.duplicateCount, 1);
  assert.equal(result.groups[0].meta.reposted, true);
});

test('market insights distinguish present skills from recurring gaps and count ERP roles', () => {
  const jobs = [
    job('erp', 'Oracle Fusion ERP Analyst', 'Acme', 'SQL Docker Oracle Fusion Financials'),
    job('swe', 'Software Engineer', 'Beta', 'Python SQL Docker Kubernetes'),
  ];
  const insights = buildMarketInsights(jobs, profile);
  const sql = insights.skills.find((row) => row.skill === 'SQL');
  const docker = insights.skills.find((row) => row.skill === 'Docker');
  assert.equal(sql?.owned, true);
  assert.equal(docker?.owned, false);
  assert.equal(insights.erpJobs, 1);
  assert.ok(insights.gaps.some((row) => row.skill === 'Docker'));
});

test('saved search profiles narrow jobs without replacing candidate skills', () => {
  const saved: SearchProfile = {
    id: 'erp',
    name: 'ERP',
    description: '',
    targetTitles: ['ERP Analyst'],
    includeKeywords: ['oracle fusion', 'erp'],
    minMatch: 60,
    enabled: true,
  };
  const effective = profileForSearch(profile, saved);
  assert.deepEqual(effective.targetTitles, ['ERP Analyst']);
  assert.deepEqual(effective.skills, profile.skills);
  const filtered = filterJobsForSearchProfile([
    job('erp', 'ERP Analyst', 'Acme', 'Oracle Fusion implementation'),
    job('swe', 'Software Engineer', 'Beta', 'React application'),
  ], saved);
  assert.deepEqual(filtered.map((item) => item.id), ['erp']);
});

test('interview prep uses role requirements and application-pack evidence', () => {
  const erpJob = job('erp', 'Oracle Fusion Analyst', 'Acme', 'Support Oracle Fusion ERP Financials and SQL integrations');
  erpJob.match = {
    overall: 82,
    skills: 85,
    experience: 80,
    education: 90,
    domain: 85,
    location: 100,
    recommendation: 'strong',
    blockers: [],
    strengths: ['Oracle Fusion'],
    gaps: [],
    mustHave: ['Oracle Fusion', 'SQL'],
    preferred: [],
    matchedSkills: ['Oracle Fusion', 'SQL'],
    missingSkills: [],
    explanation: 'test',
  };
  const pack: ApplicationPack = {
    summary: 'test',
    resumeHeadline: 'ERP Analyst',
    resumeSummary: 'test',
    skills: ['Oracle Fusion', 'SQL'],
    experience: [{ organization: 'Employer', title: 'IT Specialist', bullets: ['Supported Oracle Fusion financial workflows.'] }],
    projects: [],
    coverLetter: 'test',
    outreachMessage: 'test',
    interviewThemes: ['ERP support'],
    claimsAudit: [],
  };
  const prep = buildInterviewPrep(erpJob, pack);
  assert.ok(prep.topics.some((topic) => topic.toLowerCase().includes('oracle fusion')));
  assert.equal(prep.evidence[0].label, 'Employer — IT Specialist');
  assert.ok(prep.likelyQuestions.length >= 3);
});
