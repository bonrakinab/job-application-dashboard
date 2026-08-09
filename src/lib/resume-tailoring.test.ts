import test from 'node:test';
import assert from 'node:assert/strict';
import type { ApplicationPack, CandidateProfile, Job } from './types';
import { sanitizeApplicationPack } from './resume-tailoring';
import { resumePdf } from './pdf';

const profile: CandidateProfile = {
  name: 'Arnob Banik',
  email: 'arnob@example.com',
  phone: '+1 555 0100',
  location: 'Windsor, Ontario, Canada',
  links: { linkedin: 'https://linkedin.com/in/example', github: 'https://github.com/example', portfolio: 'https://example.com' },
  headline: 'MSc Computer Science (AI)',
  summary: 'Technical professional currently completing an MSc in Computer Science (AI) with enterprise IT and applied AI experience.',
  targetTitles: ['Software Engineer'],
  preferredLocations: ['Canada'],
  skills: ['Python', 'TypeScript', 'GitHub Actions/CI', 'Machine Learning', 'Oracle Fusion ERP Cloud'],
  skillGroups: [
    { label: 'Languages', skills: ['Python', 'TypeScript'] },
    { label: 'Applied AI & ML', skills: ['Machine Learning'] },
    { label: 'Cloud, DevOps & Enterprise', skills: ['GitHub Actions/CI', 'Oracle Fusion ERP Cloud'] },
  ],
  degrees: [{ institution: 'University of Windsor', degree: 'Master of Science in Computer Science', field: 'Artificial Intelligence Specialization', start: 'Sept 2024', end: 'Aug 2026 (Expected)', location: 'Windsor, Ontario, Canada' }],
  experience: [{ organization: 'Banglalink', title: 'Specialist Engineer', start: 'Sept 2023', end: 'June 2024', location: 'Dhaka, Bangladesh', bullets: ['Reduced approximately 15,000 tax conditions to 460 maintainable rules.', 'Supported Oracle Fusion ERP Cloud Financials and Procurement workflows.'], skills: ['Oracle Fusion ERP Cloud'] }],
  projects: [{ name: 'Job Application Intelligence Dashboard', description: 'Human-in-the-loop job intelligence system.', bullets: ['Implemented GitHub Actions/CI and deterministic eligibility safeguards.', 'Built the dashboard with TypeScript and AI integrations.'], skills: ['TypeScript', 'GitHub Actions/CI', 'Python'] }],
  certifications: ['Google IT Support'],
};

const basePack: ApplicationPack = {
  summary: 'pack',
  resumeHeadline: 'Software Engineer | AI Tooling',
  resumeSummary: 'Technical professional currently completing an MSc in Computer Science (AI), with TypeScript and GitHub Actions/CI experience.',
  skills: ['TypeScript', 'GitHub Actions/CI', 'Go'],
  experience: [{ organization: 'Banglalink', title: 'Specialist Engineer', bullets: ['Invented a Kubernetes microservice platform.', 'Reduced approximately 15,000 tax conditions to 460 maintainable rules.'] }],
  projects: [{ name: 'Job Application Intelligence Dashboard', bullets: ['Implemented GitHub Actions/CI and deterministic eligibility safeguards.', 'Added Kafka and Kubernetes.'] }],
  coverLetter: 'Hello',
  outreachMessage: 'Hello',
  interviewThemes: [],
  claimsAudit: [],
};

const job: Job = { externalId: '1', source: 'test', sourceKey: 'test', url: 'https://example.com', title: 'Software Engineer', company: 'Example', description: 'TypeScript and CI' };

test('sanitizer only keeps exact master skills and source bullets', () => {
  const pack = sanitizeApplicationPack(basePack, profile);
  assert.deepEqual(pack.skills, ['TypeScript', 'GitHub Actions/CI']);
  assert.deepEqual(pack.experience[0].bullets, ['Reduced approximately 15,000 tax conditions to 460 maintainable rules.']);
  assert.deepEqual(pack.projects[0].bullets, ['Implemented GitHub Actions/CI and deterministic eligibility safeguards.']);
});

test('sanitizer rejects completed-degree wording when the degree is expected', () => {
  const pack = sanitizeApplicationPack({ ...basePack, resumeSummary: 'Computer Science graduate with strong software experience.' }, profile);
  assert.equal(pack.resumeSummary, profile.summary);
});

test('resume PDF follows template sections and omits generic tailored-for footer', () => {
  const pack = sanitizeApplicationPack(basePack, profile);
  const pdfText = resumePdf(profile, job, pack).toString('utf8');
  assert.match(pdfText, /PROFESSIONAL SUMMARY/);
  assert.match(pdfText, /EXPERIENCE/);
  assert.match(pdfText, /SKILLS/);
  assert.match(pdfText, /PROJECTS/);
  assert.match(pdfText, /EDUCATION/);
  assert.match(pdfText, /CERTIFICATIONS/);
  assert.match(pdfText, /University of Windsor/);
  assert.doesNotMatch(pdfText, /Tailored for/);
});
