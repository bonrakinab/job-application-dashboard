import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApplicationPack, CandidateProfile, Job, MatchScore } from './types';
import { optimizeApplicationPackForAts } from './ats-optimizer';

const profile: CandidateProfile = {
  name: 'Arnob Banik',
  email: 'arnob@example.com',
  phone: '+1 555 0100',
  location: 'Windsor, Ontario, Canada',
  targetTitles: ['Software Engineer'],
  preferredLocations: ['Canada'],
  skills: ['TypeScript', 'React', 'PostgreSQL', 'Python', 'Machine Learning'],
  degrees: [{
    institution: 'University of Windsor',
    degree: 'Master of Science in Computer Science',
    field: 'Artificial Intelligence Specialization',
    end: 'Aug 2026 (Expected)',
  }],
  experience: [{
    organization: 'Example Co',
    title: 'Software Development Intern',
    bullets: [
      'Built TypeScript application components and integrated PostgreSQL-backed APIs.',
      'Reviewed frontend defects and supported React component delivery.',
    ],
    skills: ['TypeScript', 'React', 'PostgreSQL'],
  }],
  projects: [{
    name: 'MSc Thesis - Retrieval',
    description: 'Machine learning retrieval research.',
    bullets: ['Developed a Python machine learning retrieval prototype.'],
    skills: ['Python', 'Machine Learning'],
  }, {
    name: 'Family CRM',
    description: 'Full-stack CRM.',
    bullets: ['Built a React and TypeScript CRM backed by PostgreSQL.'],
    skills: ['React', 'TypeScript', 'PostgreSQL'],
  }],
};

const job: Job = {
  externalId: 'software-1',
  source: 'test',
  sourceKey: 'test',
  url: 'https://example.com/job',
  title: 'Software Engineer',
  company: 'Example',
  description: 'Build TypeScript and React applications using PostgreSQL. Maintain APIs and frontend components.',
};

const match: MatchScore = {
  overall: 86,
  skills: 90,
  experience: 82,
  education: 90,
  domain: 88,
  location: 100,
  recommendation: 'strong',
  blockers: [],
  strengths: ['TypeScript', 'React', 'PostgreSQL'],
  gaps: [],
  mustHave: ['TypeScript', 'React', 'PostgreSQL'],
  preferred: [],
  matchedSkills: ['TypeScript', 'React', 'PostgreSQL'],
  missingSkills: [],
  explanation: 'Strong software fit.',
};

function weakPack(): ApplicationPack {
  return {
    summary: 'test',
    resumeHeadline: 'MSc Candidate',
    resumeSummary: 'Computer science candidate.',
    skills: ['Machine Learning'],
    experience: [{ organization: 'Example Co', title: 'Software Development Intern', bullets: [] }],
    projects: [{ name: 'MSc Thesis - Retrieval', bullets: ['Developed a Python machine learning retrieval prototype.'] }],
    coverLetter: 'test',
    outreachMessage: 'test',
    interviewThemes: [],
    claimsAudit: [],
  };
}

test('optimizer promotes verified JD evidence until the resume reaches the pass standard when possible', () => {
  const result = optimizeApplicationPackForAts(job, profile, weakPack(), match);
  assert.equal(result.score.eligibleToApply, true);
  assert.ok(result.score.overall >= 90);
  assert.equal(result.pack.atsOptimization?.status, 'pass');
  assert.ok((result.pack.atsOptimization?.attempts ?? 0) >= 1);
  assert.ok(result.pack.skills.includes('TypeScript'));
  assert.ok(result.pack.skills.includes('React'));
  assert.ok(result.pack.skills.includes('PostgreSQL'));
  assert.match(result.pack.resumeHeadline, /Software Engineer/);
  assert.ok(result.pack.projects.some((project) => project.name === 'MSc Thesis - Retrieval'));
  assert.ok(result.pack.projects.some((project) => project.name === 'Family CRM'));
  assert.ok(result.pack.skills.every((skill) => profile.skills.includes(skill)));
});

test('optimizer stops below 90 rather than inventing an unsupported mandatory technology', () => {
  const missingJava: MatchScore = {
    ...match,
    mustHave: ['TypeScript', 'React', 'Java'],
    matchedSkills: ['TypeScript', 'React'],
    missingSkills: ['Java'],
  };
  const result = optimizeApplicationPackForAts(
    { ...job, description: `${job.description} Java is mandatory.` },
    profile,
    weakPack(),
    missingJava,
  );
  assert.equal(result.score.eligibleToApply, false);
  assert.ok(result.score.overall < 90);
  assert.equal(result.pack.atsOptimization?.status, 'conditional');
  assert.equal(result.pack.atsOptimization?.truthfulCeilingReached, true);
  assert.ok(!result.pack.skills.includes('Java'));
  assert.ok(result.score.unsupportedMustHaves.includes('Java'));
});
