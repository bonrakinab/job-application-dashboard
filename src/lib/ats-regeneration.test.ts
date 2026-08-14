import assert from 'node:assert/strict';
import test from 'node:test';
import { ATS_PASS_SCORE, scoreTailoredResume } from './ats-score';
import type { ApplicationPack, CandidateProfile, Job, MatchScore } from './types';

const profile: CandidateProfile = {
  name: 'Candidate',
  email: 'candidate@example.com',
  phone: '+1 555 0100',
  targetTitles: ['AI Software Engineer'],
  preferredLocations: ['Canada'],
  skills: ['TypeScript', 'SQL', 'Python'],
  degrees: [{ institution: 'University', degree: 'Master of Science in Computer Science', end: 'Aug 2026 (Expected)' }],
  experience: [{ organization: 'Example', title: 'Developer', bullets: ['Built TypeScript and SQL applications.'], skills: ['TypeScript', 'SQL'] }],
  projects: [{ name: 'AI Project', description: 'AI application', bullets: ['Built a Python AI application.'], skills: ['Python'] }],
};

const job: Job = {
  externalId: '1', source: 'test', sourceKey: 'test', url: 'https://example.com',
  title: 'AI Software Engineer', company: 'Acme', location: 'Canada',
  description: 'Design and build production AI applications using TypeScript and SQL. Develop RESTful services in Java and work with agent frameworks, distributed systems, and modern development workflows. This role also requires system design and scalable backend thinking. The engineer will collaborate across product and engineering, own implementation decisions, evaluate reliability, improve observability, and support production AI services across multiple integrations and data sources.',
};

const pack: ApplicationPack = {
  summary: 'pack',
  resumeHeadline: 'AI Software Engineer | TypeScript | SQL',
  resumeSummary: 'MSc Computer Science candidate with TypeScript, SQL, and Python project experience relevant to AI software engineering.',
  skills: ['TypeScript', 'SQL', 'Python'],
  experience: [{ organization: 'Example', title: 'Developer', bullets: ['Built TypeScript and SQL applications.'] }],
  projects: [{ name: 'AI Project', bullets: ['Built a Python AI application.'] }],
  coverLetter: 'Dear Hiring Manager,\n\nApplication.\n\nSincerely,\nCandidate', outreachMessage: 'Hello', interviewThemes: [], claimsAudit: [],
};

test('deterministic match without extracted requirements cannot receive ATS PASS', () => {
  const match: MatchScore = {
    overall: 90, skills: 95, experience: 90, education: 90, domain: 90, location: 100,
    recommendation: 'exceptional', blockers: [], strengths: ['TypeScript', 'SQL'], gaps: [],
    mustHave: [], preferred: [], matchedSkills: ['TypeScript', 'SQL'], missingSkills: [],
    explanation: 'Broad deterministic score.', model: 'deterministic-expanded-remote-v2',
  };
  const score = scoreTailoredResume(job, profile, pack, match);
  assert.equal(score.analysisIncomplete, true);
  assert.equal(score.status, 'conditional');
  assert.equal(score.eligibleToApply, false);
  assert.ok(score.overall < ATS_PASS_SCORE);
});
