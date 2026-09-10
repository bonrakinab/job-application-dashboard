import assert from 'node:assert/strict';
import test from 'node:test';
import { resumePdf } from './application-pdf';
import { finalResumeArtifactState } from './resume-generation-policy';
import type { ApplicationPack, CandidateProfile, Job } from './types';

const job: Job = {
  externalId: 'layout-test', source: 'test', sourceKey: 'test', url: 'https://example.com',
  title: 'Machine Learning Engineer', company: 'Example', description: 'Machine learning and software engineering role.',
};

const profile: CandidateProfile = {
  name: 'Arnob Banik', email: 'arnob@example.com', phone: '+1 555 555 5555', links: { linkedin: 'https://linkedin.com/in/arnob', github: 'https://github.com/arnob', portfolio: 'https://example.com' },
  targetTitles: [], preferredLocations: [], skills: ['Python', 'Machine Learning'],
  experience: [
    { organization: 'Banglalink', title: 'Enterprise Solutions and Services Specialist Engineer, IT', start: 'Sept 2023', end: 'June 2024', location: 'Dhaka, Bangladesh', bullets: ['Supported enterprise systems and reduced approximately 15,000 tax conditions to 460 rules.'] },
    { organization: 'Banglalink', title: 'Information Technology Intern', start: 'June 2023', end: 'Sept 2023', location: 'Dhaka, Bangladesh', bullets: ['Built an internal support chatbot and maintained ERP documentation.'] },
    { organization: 'GAOTek Inc.', title: 'Software Development Intern - Team Leader', start: 'Dec 2022', end: 'March 2023', location: 'Remote', bullets: ['Led Angular component delivery and defect triage.'] },
  ],
  degrees: [
    { institution: 'University of Windsor', degree: 'Master of Science in Computer Science', field: 'AI Specialization', start: 'Sept 2024', end: 'Aug 2026 (Expected)', location: 'Windsor, Ontario, Canada', coursework: ['Statistical Learning', 'Neural Networks and Deep Learning'] },
    { institution: 'Vellore Institute of Technology', degree: 'Bachelor of Technology', field: 'Computer Science and Engineering', start: 'July 2019', end: 'July 2023', location: 'Vellore, Tamil Nadu, India', gpa: '8.20/10', coursework: ['Software Engineering', 'Data Structures and Algorithms'] },
  ],
};

const pack: ApplicationPack = {
  summary: 'test', resumeHeadline: 'Machine Learning Engineer',
  resumeSummary: 'MSc Computer Science candidate with verified machine-learning and software-engineering coursework.',
  skills: ['Python', 'Machine Learning'], experience: [], projects: [], education: [], coverLetter: '', outreachMessage: '', interviewThemes: [], claimsAudit: [],
};

test('coursework renders as dedicated education text when the profile allows it', () => {
  const pdf = resumePdf(profile, job, pack).toString('utf8');
  assert.match(pdf, /Relevant Coursework: Statistical Learning/);
  assert.match(pdf, /Relevant Coursework: Software Engineering/);
  assert.doesNotMatch(pdf, /AI Specialization; Relevant Coursework/);
});

test('v12 renderer uses A4, Times reference typography, title-case sections, and readable margins', () => {
  const crowded: ApplicationPack = { ...pack, experience: profile.experience!.map((item) => ({ organization: item.organization, title: item.title, bullets: item.bullets })) };
  const pdf = resumePdf(profile, job, crowded).toString('utf8');
  assert.match(pdf, /\/MediaBox \[0 0 595\.28 841\.89\]/);
  assert.match(pdf, /\/Subtype \/Type1/);
  assert.match(pdf, /\/BaseFont \/Times-Roman/);
  assert.match(pdf, /\/BaseFont \/Times-Bold/);
  assert.match(pdf, /\(Professional Summary\)/);
  assert.doesNotMatch(pdf, /\(PROFESSIONAL SUMMARY\)/);
  assert.match(pdf, /\(LinkedIn \| GitHub \| Portfolio\)/);
  const xPositions = [...pdf.matchAll(/Tf\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+Td/g)].map((match) => Number(match[1]));
  assert.ok(xPositions.length > 0);
  assert.ok(Math.min(...xPositions) >= 32);
});

test('final career reference export renders all selected certifications and never publications or coursework', () => {
  const certifications = ['Google IT Support', 'Oracle Data Science Professional', 'Oracle Cloud Foundations Associate', 'Oracle Cloud Data Management Foundations Associate', 'AWS Academy Cloud Foundations', 'Machine Learning for All'];
  const state = finalResumeArtifactState({ ...profile, profilePurpose: 'career', publications: ['Hidden Publication'] }, { ...pack, certifications, publications: ['Hidden Publication'] });
  const pdf = resumePdf(state.profile, job, state.pack).toString('utf8');
  for (const certification of certifications) assert.match(pdf, new RegExp(certification.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(pdf, /PUBLICATIONS|Hidden Publication|Relevant Coursework/);
});
