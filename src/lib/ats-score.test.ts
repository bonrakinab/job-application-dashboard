import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApplicationPack, CandidateProfile, Job, MatchScore } from './types';
import { scoreTailoredResume } from './ats-score';
import { coverLetterBodyParagraphs, coverLetterText } from './cover-letter';
import { coverLetterPdf, resumePdf } from './application-pdf';

const profile: CandidateProfile = {
  name: 'Arnob Banik',
  email: 'arnob@example.com',
  phone: '+1 555 0100',
  location: 'Windsor, Ontario, Canada',
  links: { linkedin: 'https://linkedin.com/in/example', github: 'https://github.com/example' },
  headline: 'MSc Computer Science (AI)',
  summary: 'Technical professional with software and AI experience.',
  targetTitles: ['Software Engineer'],
  preferredLocations: ['Canada'],
  skills: ['Python', 'TypeScript', 'PostgreSQL', 'React', 'Machine Learning'],
  skillGroups: [
    { label: 'Languages', skills: ['Python', 'TypeScript'] },
    { label: 'Full-Stack & APIs', skills: ['React'] },
    { label: 'Data & Backend', skills: ['PostgreSQL'] },
    { label: 'Applied AI & ML', skills: ['Machine Learning'] },
  ],
  degrees: [{ institution: 'University of Windsor', degree: 'Master of Science in Computer Science', field: 'Artificial Intelligence Specialization', start: 'Sept 2024', end: 'Aug 2026 (Expected)', location: 'Windsor, Ontario, Canada' }],
  experience: [{ organization: 'Example Co', title: 'Software Development Intern', location: 'Remote', start: 'Jan 2024', end: 'Apr 2024', bullets: ['Built TypeScript application components and integrated PostgreSQL-backed APIs.'], skills: ['TypeScript', 'PostgreSQL'] }],
  projects: [{ name: 'Dashboard', description: 'Full-stack dashboard', bullets: ['Built a React and TypeScript dashboard backed by PostgreSQL.'], skills: ['React', 'TypeScript', 'PostgreSQL'] }],
  certifications: ['Google IT Support'],
};

const job: Job = {
  externalId: '1', source: 'test', sourceKey: 'test', url: 'https://example.com',
  title: 'Software Engineer', company: 'Example', location: 'Toronto, Canada',
  description: 'Build TypeScript and React applications backed by PostgreSQL. Python is preferred.',
};

const match: MatchScore = {
  overall: 85, skills: 90, experience: 78, education: 90, domain: 88, location: 100,
  recommendation: 'strong', blockers: [], strengths: ['TypeScript', 'React', 'PostgreSQL'], gaps: [],
  mustHave: ['TypeScript', 'React', 'PostgreSQL'], preferred: ['Python'],
  matchedSkills: ['TypeScript', 'React', 'PostgreSQL', 'Python'], missingSkills: [], explanation: 'good fit',
};

function pack(skills: string[]): ApplicationPack {
  return {
    summary: 'Tailored pack',
    resumeHeadline: 'Software Engineer | TypeScript & React',
    resumeSummary: 'Software engineer candidate with TypeScript, React, PostgreSQL, and Python experience.',
    skills,
    experience: [{ organization: 'Example Co', title: 'Software Development Intern', bullets: ['Built TypeScript application components and integrated PostgreSQL-backed APIs.'] }],
    projects: [{ name: 'Dashboard', bullets: ['Built a React and TypeScript dashboard backed by PostgreSQL.'] }],
    coverLetter: 'Dear Hiring Manager,\n\nI am applying for the Software Engineer role because my TypeScript and React work aligns with the position.\n\nIn my recent work, I built application components and PostgreSQL-backed APIs, giving me practical experience relevant to the team.\n\nI would welcome the opportunity to discuss how I can contribute to Example.\n\nSincerely,\nArnob Banik',
    outreachMessage: 'Hello', interviewThemes: [], claimsAudit: [],
  };
}

test('ATS estimate rewards JD-aligned selected skills and evidence', () => {
  const strong = scoreTailoredResume(job, profile, pack(['TypeScript', 'React', 'PostgreSQL', 'Python']), match);
  const weak = scoreTailoredResume(job, profile, pack(['Machine Learning']), match);
  assert.ok(strong.overall > weak.overall);
  assert.ok(strong.skillCoverage >= 90);
  assert.deepEqual(strong.missingKeywords, []);
});

test('cover letter normalizes generated prose into professional template blocks', () => {
  const p = pack(['TypeScript', 'React', 'PostgreSQL']);
  assert.equal(coverLetterBodyParagraphs(p).length, 3);
  const text = coverLetterText(profile, job, p, new Date('2026-08-09T12:00:00-04:00'));
  assert.match(text, /Arnob Banik/);
  assert.match(text, /Hiring Manager\nExample/);
  assert.match(text, /Re: Software Engineer/);
  assert.match(text, /Dear Hiring Manager,/);
  assert.match(text, /Sincerely,/);
});

test('resume and cover-letter PDFs remain single-page template documents', () => {
  const p = pack(['TypeScript', 'React', 'PostgreSQL', 'Python']);
  const resume = resumePdf(profile, job, p).toString('utf8');
  const cover = coverLetterPdf(profile, job, p).toString('utf8');
  assert.equal((resume.match(/\/Type \/Page\b/g) ?? []).length, 1);
  assert.equal((cover.match(/\/Type \/Page\b/g) ?? []).length, 1);
  assert.match(resume, /PROFESSIONAL SUMMARY/);
  assert.match(resume, /CERTIFICATIONS/);
  assert.match(cover, /Dear Hiring Manager/);
  assert.match(cover, /Re: Software Engineer/);
  assert.match(cover, /Sincerely/);
});
