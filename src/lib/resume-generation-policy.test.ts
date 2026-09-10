import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApplicationPack, CandidateProfile, Job, RequirementEvidence } from './types';
import { evidenceBackedJdKeywords, finalResumeArtifactState, literalJdKeywordCandidates, strengthenResumeForJob } from './resume-generation-policy';

const job: Job = {
  externalId: 'jd-keyword-test',
  source: 'manual',
  sourceKey: 'manual:jd-keyword-test',
  url: 'https://example.com/job',
  title: 'Business Systems Analyst',
  company: 'Example Co',
  description: `We are looking for strong stakeholder management and requirements gathering skills.
Experience with relational databases is preferred. Kubernetes orchestration is a plus.`,
};

const profile: CandidateProfile = {
  name: 'Candidate',
  targetTitles: ['Business Systems Analyst'],
  preferredLocations: ['Ontario'],
  skills: ['SQL', 'PostgreSQL', 'Python'],
  experience: [{
    organization: 'Example Employer',
    title: 'Systems Specialist',
    bullets: [
      'Coordinated with business teams to gather requirements and map system changes across enterprise applications.',
      'Worked with SQL and PostgreSQL for reporting and operational data analysis.',
    ],
    skills: ['SQL', 'PostgreSQL'],
  }],
  projects: [{ name: 'Project', description: 'Database project', bullets: ['Built reporting workflows.'], skills: ['PostgreSQL'] }],
  degrees: [{ institution: 'Example University', degree: 'MSc', field: 'Computer Science', coursework: ['Database Systems'] }],
  publications: ['Publication that must never render'],
  location: 'Windsor, Ontario',
};

const requirements: RequirementEvidence[] = [
  {
    requirement: 'Manage stakeholders and gather requirements',
    importance: 'must-have',
    category: 'responsibility',
    exactTerms: [],
    support: 'supported',
    confidence: 82,
    evidence: [{ id: 'EXP:0:0', label: 'Systems Specialist · Example Employer', excerpt: profile.experience![0].bullets[0], score: 82 }],
  },
  {
    requirement: 'SQL and relational database experience',
    importance: 'preferred',
    category: 'hard-skill',
    exactTerms: ['SQL'],
    support: 'supported',
    confidence: 76,
    evidence: [{ id: 'EXP:0:1', label: 'Systems Specialist · Example Employer', excerpt: profile.experience![0].bullets[1], score: 76 }],
  },
  {
    requirement: 'Kubernetes orchestration',
    importance: 'preferred',
    category: 'tool',
    exactTerms: ['Kubernetes'],
    support: 'gap',
    confidence: 95,
    evidence: [],
  },
];

function pack(): ApplicationPack {
  return {
    summary: 'Tailored pack',
    resumeHeadline: 'Business Systems Analyst',
    resumeSummary: 'Systems specialist with enterprise application experience, business-facing coordination, and data reporting work across operational environments.',
    skills: ['SQL', 'PostgreSQL'],
    experience: [{
      organization: 'Example Employer',
      title: 'Systems Specialist',
      bullets: [...profile.experience![0].bullets],
      bulletEvidence: [['EXP:0:0'], ['EXP:0:1']],
    }],
    projects: [],
    certifications: [],
    publications: ['Publication that must never render'],
    coverLetter: '',
    outreachMessage: '',
    interviewThemes: [],
    claimsAudit: [],
    requirementEvidence: requirements,
  };
}

test('maps literal JD phrases to semantically supported evidence even when the source resume used different wording', () => {
  const keywords = evidenceBackedJdKeywords(job, requirements).map((item) => item.phrase.toLowerCase());
  assert.ok(keywords.includes('stakeholder management'));
  assert.ok(keywords.includes('requirements gathering'));
  assert.ok(keywords.includes('relational databases'));
  assert.ok(!keywords.some((keyword) => keyword.includes('kubernetes')));
});

test('adds evidence-backed JD wording to the summary without inventing a new exact skill', () => {
  const result = strengthenResumeForJob(job, profile, pack(), pack(), requirements);
  const summary = result.resumeSummary.toLowerCase();
  assert.match(summary, /stakeholder management/);
  assert.match(summary, /requirements gathering/);
  assert.match(summary, /relational databases/);
  assert.doesNotMatch(summary, /kubernetes/);
  assert.ok(!result.skills.includes('stakeholder management'));
  assert.ok(!result.skills.includes('requirements gathering'));
  assert.ok(!result.skills.includes('relational databases'));
  assert.ok(result.skills.includes('SQL'));
  const reconciled = result.requirementEvidence?.find((item) => item.requirement === 'Manage stakeholders and gather requirements');
  assert.ok(reconciled?.exactTerms?.some((term) => term.toLowerCase() === 'stakeholder management'));
});

test('JD reconciliation is source-agnostic and applies to all career job sources', () => {
  for (const source of ['himalayas', 'workday', 'greenhouse', 'ashby', 'ycombinator', 'manual']) {
    const sourceJob = { ...job, source, sourceKey: `${source}:test` };
    const result = strengthenResumeForJob(sourceJob, profile, pack(), pack(), requirements);
    assert.match(result.resumeSummary.toLowerCase(), /stakeholder management/, source);
    assert.doesNotMatch(result.resumeSummary.toLowerCase(), /kubernetes/, source);
  }
});

test('career final artifact matches the uploaded reference field policy', () => {
  const state = finalResumeArtifactState({ ...profile, profilePurpose: 'career' }, pack());
  assert.equal(state.profile.location, '');
  assert.deepEqual(state.profile.projects?.[0].skills, []);
  assert.deepEqual(state.profile.degrees?.[0].coursework, []);
  assert.deepEqual(state.profile.publications, []);
  assert.equal(state.pack.resumeHeadline, '');
  assert.deepEqual(state.pack.publications, []);
});

test('part-time jobs use the same safety pipeline without losing their separate contact location', () => {
  const state = finalResumeArtifactState({ ...profile, profilePurpose: 'part-time' }, pack());
  assert.equal(state.profile.location, 'Windsor, Ontario');
  assert.deepEqual(state.profile.publications, []);
  assert.deepEqual(state.pack.publications, []);
});

test('generic design phrases are not harvested as ATS filler', () => {
  const designJob = {
    ...job,
    description: 'Own enterprise architecture, solution design, and design development. Strong stakeholder management is required.',
  };
  const phrases = literalJdKeywordCandidates(designJob).map((value) => value.toLowerCase());
  assert.ok(!phrases.includes('enterprise architecture'));
  assert.ok(!phrases.includes('solution design'));
  assert.ok(!phrases.includes('design development'));
  assert.ok(phrases.includes('stakeholder management'));
});

test('final artifact removes raw imported project dumps and keeps the concise evidence bullet', () => {
  const badDump = 'Major challenges on Initial Configuration: Complex and redundant tax configuration. Benefits of New Setup: Tax Conditions reduced to 450 from 15K. Technologies Used: Oracle Fusion.';
  const concise = 'Revamped the ESS tax engine by consolidating approximately 15,000 tax conditions to about 450 and resolving PO/invoice tax-calculation issues.';
  const sourceProfile: CandidateProfile = {
    ...profile,
    projects: [{ name: 'Go-Live of ESS Tax Engine Revamp', description: 'ERP tax project', bullets: [badDump, concise], skills: ['SQL'] }],
  };
  const sourcePack: ApplicationPack = {
    ...pack(),
    projects: [{ name: 'Go-Live of ESS Tax Engine Revamp', bullets: [badDump, concise], bulletEvidence: [['PROJ:0:0'], ['PROJ:0:1']] }],
  };
  const state = finalResumeArtifactState(sourceProfile, sourcePack);
  assert.deepEqual(state.pack.projects[0].bullets, [concise]);
  assert.deepEqual(state.pack.projects[0].bulletEvidence, [['PROJ:0:1']]);
});
