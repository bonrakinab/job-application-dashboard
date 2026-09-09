import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProfessionalFallbackCoverLetter } from './cover-letter-tailoring';
import { isCareerTrackJob, isMainCareerJob, isWindsorPartTimeJob, profileIdForJob } from './part-time-jobs';
import { normalizePartTimeCandidateProfile } from './profile-curation';
import { partTimeProfileFromResumeExtraction, type ResumeProfileExtraction } from './resume-profile-import';
import {
  applicationPackStaleness,
  applicationPackSystemPromptForProfile,
  attachApplicationPackGenerationMeta,
  deterministicTailoringPlan,
  materializeApplicationPack,
} from './resume-tailoring';
import type { CandidateProfile, Job } from './types';

const profile: CandidateProfile = normalizePartTimeCandidateProfile({
  profilePurpose: 'part-time',
  name: 'Test Candidate',
  location: 'Windsor, Ontario',
  headline: 'Customer service and retail associate',
  targetTitles: ['Retail Associate'],
  preferredLocations: ['Windsor, Ontario'],
  skills: ['Customer Service', 'Communication', 'Point of Sale'],
  experience: [{
    organization: 'Local Market',
    title: 'Store Associate',
    start: '2024',
    end: '2025',
    bullets: ['Assisted customers and processed purchases using the point-of-sale system.'],
    skills: ['Customer Service', 'Point of Sale'],
  }],
});

const job: Job = {
  id: 'part-time-test',
  externalId: 'part-time-test',
  source: 'workopolis',
  sourceKey: 'windsor-part-time',
  url: 'https://example.com/job',
  title: 'Part-Time Sales Associate',
  company: 'Windsor Shop',
  location: 'Windsor, ON',
  employmentType: 'PART_TIME',
  description: 'Assist customers, operate a point-of-sale system, maintain displays, and communicate with the store team.',
};

test('Windsor part-time jobs are routed to the isolated profile', () => {
  assert.equal(profileIdForJob(job), 'part-time');
  assert.equal(isWindsorPartTimeJob(job), true);
  assert.equal(isWindsorPartTimeJob({ ...job, location: 'Toronto, ON' }), false);
  assert.equal(profileIdForJob({ ...job, employmentType: 'Full Time', title: 'Sales Associate' }), 'default');
  assert.equal(isMainCareerJob(job), false);
  assert.equal(isMainCareerJob({ ...job, employmentType: 'Full Time', title: 'Sales Associate' }), true);
});

test('technical part-time jobs use the career profile even when legacy metadata says part-time', () => {
  const technical: Job = {
    ...job,
    title: 'AI Evaluation Engineer (Python, QA or Security)',
    company: 'Mindrift',
    location: 'Canada',
    applicationProfileId: 'part-time',
  };
  assert.equal(isCareerTrackJob(technical), true);
  assert.equal(profileIdForJob(technical), 'default');
  assert.equal(isMainCareerJob(technical), true);
  assert.equal(profileIdForJob({ ...technical, title: 'Data & Reporting Analyst (Part Time)' }), 'default');
  assert.equal(profileIdForJob({ ...technical, title: 'Business Analyst (Pre-Sales & Delivery)' }), 'default');
  assert.equal(profileIdForJob({ ...technical, title: 'Software Engineering Evaluation Specialist' }), 'default');
});

test('part-time profile keeps general workplace skills and its own experience', () => {
  assert.deepEqual(profile.skills, ['Customer Service', 'Communication', 'Point of Sale']);
  assert.deepEqual(profile.experience?.map((item) => item.organization), ['Local Market']);
});

test('part-time generation uses only uploaded profile evidence', () => {
  const system = applicationPackSystemPromptForProfile(profile);
  assert.match(system, /separate part-time resume/i);
  assert.doesNotMatch(system, /select the 3 supplied professional experience roles/i);

  const plan = deterministicTailoringPlan(job, profile);
  const pack = materializeApplicationPack(plan, profile, job);
  const letter = buildProfessionalFallbackCoverLetter(pack, profile, job);
  assert.deepEqual(pack.experience.map((item) => item.organization), ['Local Market']);
  assert.match(letter, /Local Market/);
  assert.doesNotMatch(`${pack.resumeSummary}\n${letter}`, /MSc|Computer Science|enterprise IT|applied AI/i);
});

test('pack generated with the wrong profile is stale', () => {
  const pack = materializeApplicationPack(deterministicTailoringPlan(job, profile), profile, job);
  const tagged = attachApplicationPackGenerationMeta(pack, {
    model: 'test',
    provider: 'gemini',
    profileId: 'part-time',
    generatedAt: '2026-09-06T10:00:00Z',
  });
  assert.equal(applicationPackStaleness(tagged, undefined, 'part-time').stale, false);
  assert.equal(applicationPackStaleness(tagged, undefined, 'default').stale, true);
});

test('resume extraction becomes a dedicated Windsor part-time profile', () => {
  const extraction: ResumeProfileExtraction = {
    name: 'Test Candidate', email: 'candidate@example.com', phone: '', location: 'Windsor, ON',
    headline: 'Retail associate', summary: '', skills: ['Customer Service'], yearsExperience: 0,
    degrees: [],
    experience: [{ organization: 'Local Market', title: 'Associate', start: '2024', end: '2025', location: 'Windsor, ON', bullets: ['Helped customers find products.'], skills: ['Customer Service'] }],
    projects: [], certifications: [], languages: [], courses: [], awards: [], publications: [], workAuthorization: [], links: [],
  };
  const imported = partTimeProfileFromResumeExtraction(extraction);
  assert.equal(imported.profilePurpose, 'part-time');
  assert.equal(imported.location, 'Windsor, ON');
  assert.deepEqual(imported.experience?.map((item) => item.organization), ['Local Market']);
  assert.ok(imported.targetTitles.includes('Warehouse Associate'));
});
