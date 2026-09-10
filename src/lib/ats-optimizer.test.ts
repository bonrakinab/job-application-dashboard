import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApplicationPack, CandidateProfile, Job, MatchScore } from './types';
import { optimizeApplicationPackForAts } from './ats-optimizer';

const profile: CandidateProfile = {
  name: 'Arnob Banik', email: 'arnob@example.com', phone: '+1 555 0100', location: 'Windsor, Ontario, Canada',
  targetTitles: ['Software Engineer'], preferredLocations: ['Canada'], skills: ['TypeScript', 'React', 'PostgreSQL', 'Python', 'Machine Learning'],
  degrees: [{ institution: 'University of Windsor', degree: 'Master of Science in Computer Science', field: 'Artificial Intelligence Specialization', end: 'Aug 2026 (Expected)' }],
  experience: [{
    organization: 'Example Co', title: 'Software Development Intern',
    bullets: ['Built TypeScript application components and integrated PostgreSQL-backed APIs.', 'Reviewed frontend defects and supported React component delivery.'],
    skills: ['TypeScript', 'React', 'PostgreSQL'],
  }],
  projects: [
    { name: 'MSc Thesis - Retrieval', description: 'Machine learning retrieval research.', bullets: ['Developed a Python machine learning retrieval prototype.'], skills: ['Python', 'Machine Learning'] },
    { name: 'Family CRM', description: 'Full-stack CRM.', bullets: ['Built a React and TypeScript CRM backed by PostgreSQL.'], skills: ['React', 'TypeScript', 'PostgreSQL'] },
  ],
};

const job: Job = { externalId: 'software-1', source: 'test', sourceKey: 'test', url: 'https://example.com/job', title: 'Software Engineer', company: 'Example', description: 'Build TypeScript and React applications using PostgreSQL. Maintain APIs and frontend components.' };

const match: MatchScore = {
  overall: 86, skills: 90, experience: 82, education: 90, domain: 88, location: 100, recommendation: 'strong', blockers: [],
  strengths: ['TypeScript', 'React', 'PostgreSQL'], gaps: [], mustHave: ['TypeScript', 'React', 'PostgreSQL'], preferred: [],
  matchedSkills: ['TypeScript', 'React', 'PostgreSQL'], missingSkills: [], explanation: 'Strong software fit.',
};

function weakPack(): ApplicationPack {
  return {
    summary: 'test', resumeHeadline: 'MSc Candidate', resumeSummary: 'Computer science candidate.', skills: ['Machine Learning'],
    experience: [{ organization: 'Example Co', title: 'Software Development Intern', bullets: [] }],
    projects: [{ name: 'MSc Thesis - Retrieval', bullets: ['Developed a Python machine learning retrieval prototype.'] }],
    coverLetter: 'test', outreachMessage: 'test', interviewThemes: [], claimsAudit: [],
  };
}

test('optimizer promotes verified JD evidence until the internal target is reached when possible', () => {
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
  assert.ok(result.pack.projects.every((project) => project.bullets.length === 1));
  assert.ok(result.pack.skills.every((skill) => profile.skills.includes(skill)));
});

test('optimizer stops below 90 rather than inventing an unsupported mandatory technology', () => {
  const missingJava: MatchScore = { ...match, mustHave: ['TypeScript', 'React', 'Java'], matchedSkills: ['TypeScript', 'React'], missingSkills: ['Java'] };
  const result = optimizeApplicationPackForAts({ ...job, description: `${job.description} Java is mandatory.` }, profile, weakPack(), missingJava);
  assert.equal(result.score.eligibleToApply, false);
  assert.ok(result.score.overall < 90);
  assert.equal(result.pack.atsOptimization?.status, 'conditional');
  assert.equal(result.pack.atsOptimization?.truthfulCeilingReached, true);
  assert.ok(!result.pack.skills.includes('Java'));
  assert.ok(result.score.unsupportedMustHaves.includes('Java'));
});

test('optimizer preserves the selected professional shortlist instead of appending the full LinkedIn history', () => {
  const expandedProfile: CandidateProfile = {
    ...profile,
    experience: [
      ...(profile.experience ?? []),
      { organization: 'University', title: 'Student Representative', bullets: ['Supported committee hiring discussions.'] },
      { organization: 'Student Club', title: 'Head of Finance', bullets: ['Prepared budgets and reports.'] },
      { organization: 'Foundation', title: 'Volunteer', bullets: ['Supported community programs.'] },
    ],
  };
  const selected = weakPack();
  selected.experience = [{ organization: 'Example Co', title: 'Software Development Intern', bullets: ['Built TypeScript application components and integrated PostgreSQL-backed APIs.'] }];
  const result = optimizeApplicationPackForAts(job, expandedProfile, selected, match);
  assert.deepEqual(result.pack.experience.map((item) => item.title), ['Software Development Intern']);
  assert.ok(result.pack.experience.length <= 3);
});

test('primary role curation retains the quantified achievement and uses reference bullet budgets', () => {
  const erpProfile: CandidateProfile = {
    ...profile,
    skills: ['Oracle Fusion ERP Cloud', 'Procurement', 'SQL'],
    experience: [
      { organization: 'Banglalink', title: 'ERP Specialist', bullets: [
        'Consolidated approximately 15,000 Oracle ERP tax conditions into 460 maintainable rules, improving time-to-market and reducing calculation issues.',
        'Supported Oracle Fusion ERP Cloud Financials and Procurement workflows for vendor and financial documentation.',
        'Prepared ISO 27001 audit artifacts, contributing to a 90% audit score.',
      ], skills: ['Oracle Fusion ERP Cloud', 'Procurement'] },
      { organization: 'Banglalink', title: 'IT Intern', bullets: ['Assisted with Oracle ERP documentation and EDMS configuration.', 'Developed an internal IT-support chatbot.'] },
      { organization: 'GAOTek', title: 'Software Intern', bullets: ['Led Angular component delivery and defect triage.', 'Supported intern onboarding.'] },
    ],
    projects: [
      { name: 'ERP Tax Revamp', description: 'Oracle ERP tax-engine work.', bullets: ['Consolidated tax conditions and resolved PO/invoice calculation issues.', 'Second project detail.'], skills: ['Oracle Fusion ERP Cloud'] },
      { name: 'EDMS Migration', description: 'Enterprise systems migration.', bullets: ['Migrated production EDMS and SQL connectivity to new hardware.'], skills: ['SQL'] },
      { name: 'Flowdesk', description: 'Workflow CRM.', bullets: ['Built REST APIs and PostgreSQL workflows.'], skills: ['SQL'] },
    ],
  };
  const erpJob: Job = { ...job, title: 'Oracle Fusion ERP Technical Analyst', description: 'Support Oracle Fusion ERP Cloud Financials, Procurement, SQL, and enterprise integrations.' };
  const erpMatch: MatchScore = { ...match, mustHave: ['Oracle Fusion ERP Cloud', 'Procurement'], matchedSkills: ['Oracle Fusion ERP Cloud', 'Procurement'], strengths: ['Oracle Fusion ERP Cloud'], recommendation: 'strong' };
  const input = weakPack();
  input.experience = erpProfile.experience!.map((item) => ({ organization: item.organization, title: item.title, bullets: item.bullets.slice(0, 1) }));
  input.projects = [{ name: 'ERP Tax Revamp', bullets: erpProfile.projects![0].bullets!.slice(0, 1) }];
  const result = optimizeApplicationPackForAts(erpJob, erpProfile, input, erpMatch);
  assert.ok(result.pack.experience[0].bullets.some((bullet) => /15,000.*460/.test(bullet)));
  assert.equal(result.pack.experience[0].bullets.length, 3);
  assert.equal(result.pack.experience[1].bullets.length, 2);
  assert.equal(result.pack.experience[2].bullets.length, 1);
  assert.equal(result.pack.projects.length, 3);
  assert.ok(result.pack.projects.every((project) => project.bullets.length === 1));
});
