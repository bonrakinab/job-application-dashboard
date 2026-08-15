import assert from 'node:assert/strict';
import test from 'node:test';
import { resumePdf } from './application-pdf';
import type { ApplicationPack, CandidateProfile, Job } from './types';

const job: Job = {
  externalId: 'layout-test',
  source: 'test',
  sourceKey: 'test',
  url: 'https://example.com',
  title: 'Machine Learning Engineer',
  company: 'Example',
  description: 'Machine learning and software engineering role.',
};

const profile: CandidateProfile = {
  name: 'Arnob Banik',
  email: 'arnob@example.com',
  phone: '+1 555 555 5555',
  targetTitles: [],
  preferredLocations: [],
  skills: ['Python', 'Machine Learning'],
  degrees: [
    {
      institution: 'University of Windsor',
      degree: 'Master of Science in Computer Science',
      field: 'AI Specialization',
      start: 'Sept 2024',
      end: 'Aug 2026 (Expected)',
      location: 'Windsor, Ontario, Canada',
      coursework: ['Statistical Learning', 'Neural Networks and Deep Learning'],
    },
    {
      institution: 'Vellore Institute of Technology',
      degree: 'Bachelor of Technology',
      field: 'Computer Science and Engineering',
      start: 'July 2019',
      end: 'July 2023',
      location: 'Vellore, Tamil Nadu, India',
      gpa: '8.20/10',
      coursework: ['Software Engineering', 'Data Structures and Algorithms'],
    },
  ],
};

const pack: ApplicationPack = {
  summary: 'test',
  resumeHeadline: 'Machine Learning Engineer',
  resumeSummary: 'MSc Computer Science candidate with verified machine-learning and software-engineering coursework.',
  skills: ['Python', 'Machine Learning'],
  experience: [],
  projects: [],
  education: [],
  coverLetter: '',
  outreachMessage: '',
  interviewThemes: [],
  claimsAudit: [],
};

test('coursework renders as dedicated education text instead of being concatenated into degree/date lines', () => {
  const pdf = resumePdf(profile, job, pack).toString('utf8');
  assert.match(pdf, /Relevant Coursework: Statistical Learning/);
  assert.match(pdf, /Relevant Coursework: Software Engineering/);
  assert.doesNotMatch(pdf, /AI Specialization; Relevant Coursework/);
  assert.doesNotMatch(pdf, /Computer Science and Engineering; Relevant Coursework/);
});
