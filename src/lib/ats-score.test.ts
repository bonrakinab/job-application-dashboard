import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApplicationPack, CandidateProfile, Job, MatchScore } from './types';
import { ATS_PASS_SCORE, scoreTailoredResume } from './ats-score';
import { coverLetterBodyParagraphs, coverLetterText } from './cover-letter';
import { resumePdf } from './application-pdf';
import { coverLetterPdf } from './indeed-cover-letter-pdf';

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
    coverLetter: 'Dear Hiring Manager,\n\nI am applying for the Software Engineer role because my TypeScript and React work aligns with the position.\n\nIn my recent work, I built application components and PostgreSQL-backed APIs, giving me practical experience relevant to the team.\n\nI would welcome the opportunity to discuss how I can contribute to Example. Thank you for your consideration.\n\nSincerely,\nArnob Banik',
    outreachMessage: 'Hello', interviewThemes: [], claimsAudit: [],
  };
}

test('ATS estimate rewards JD-aligned selected skills and evidence', () => {
  const strong = scoreTailoredResume(job, profile, pack(['TypeScript', 'React', 'PostgreSQL', 'Python']), match);
  const weakPack = {
    ...pack(['Machine Learning']),
    resumeHeadline: 'Applied AI Candidate',
    resumeSummary: 'Candidate with machine learning experience.',
    experience: [],
    projects: [],
  };
  const weak = scoreTailoredResume(job, profile, weakPack, match);
  assert.ok(strong.overall > weak.overall);
  assert.ok(strong.skillCoverage >= 90);
  assert.deepEqual(strong.missingKeywords, []);
  assert.ok(weak.missingKeywords.includes('TypeScript'));
  assert.equal(strong.passScore, ATS_PASS_SCORE);
  assert.equal(strong.status, 'pass');
  assert.equal(strong.eligibleToApply, true);
  assert.ok(strong.overall >= 90);
  assert.equal(weak.status, 'conditional');
});

test('unsupported mandatory requirements cannot be keyword-gamed into an ATS pass', () => {
  const missingJavaMatch: MatchScore = {
    ...match,
    mustHave: ['TypeScript', 'React', 'Java'],
    matchedSkills: ['TypeScript', 'React'],
    missingSkills: ['Java'],
  };
  const misleadingPack = {
    ...pack(['TypeScript', 'React', 'PostgreSQL', 'Python']),
    resumeSummary: 'Software Engineer candidate with TypeScript and React experience.',
  };
  const score = scoreTailoredResume({ ...job, description: `${job.description} Java is required.` }, profile, misleadingPack, missingJavaMatch);
  assert.equal(score.status, 'conditional');
  assert.equal(score.eligibleToApply, false);
  assert.ok(score.overall < ATS_PASS_SCORE);
  assert.ok(score.unsupportedMustHaves.includes('Java'));
  assert.ok(score.missingKeywords.includes('Java'));
});

test('cover letter normalizes generated prose into Indeed-style template blocks', () => {
  const p = pack(['TypeScript', 'React', 'PostgreSQL']);
  assert.equal(coverLetterBodyParagraphs(p).length, 3);
  const text = coverLetterText(profile, job, p, new Date('2026-08-09T12:00:00-04:00'));
  assert.match(text, /^Arnob Banik\n\+1 555 0100\narnob@example.com\nWindsor, Ontario, Canada/m);
  assert.match(text, /August 9, 2026/);
  assert.match(text, /Dear Hiring Manager,/);
  assert.doesNotMatch(text, /Re: Software Engineer/);
  assert.doesNotMatch(text, /Hiring Manager\nExample/);
  assert.match(text, /Sincerely,\nArnob Banik$/);
});

test('cover letter collapses extra model paragraphs into three focused body paragraphs', () => {
  const p = pack(['TypeScript']);
  p.coverLetter = [
    'Dear Hiring Manager,',
    'I am applying for the Software Engineer role at Example.',
    'My TypeScript work aligns with the role.',
    'I also built PostgreSQL-backed APIs.',
    'I would welcome an opportunity to discuss the position. Thank you for your consideration.',
    'Sincerely,',
    'Arnob Banik',
  ].join('\n\n');
  const paragraphs = coverLetterBodyParagraphs(p);
  assert.equal(paragraphs.length, 3);
  assert.match(paragraphs[1], /TypeScript/);
  assert.match(paragraphs[1], /PostgreSQL/);
});

test('resume and Indeed-style cover-letter PDFs remain single-page documents', () => {
  const p = pack(['TypeScript', 'React', 'PostgreSQL', 'Python']);
  const resume = resumePdf(profile, job, p).toString('utf8');
  const cover = coverLetterPdf(profile, job, p).toString('utf8');
  assert.equal((resume.match(/\/Type \/Page\b/g) ?? []).length, 1);
  assert.equal((cover.match(/\/Type \/Page\b/g) ?? []).length, 1);
  assert.match(resume, /PROFESSIONAL SUMMARY/);
  assert.match(resume, /CERTIFICATIONS/);
  assert.match(cover, /Times-Roman/);
  assert.match(cover, /Dear Hiring Manager/);
  assert.doesNotMatch(cover, /Re: Software Engineer/);
  assert.match(cover, /Sincerely/);
});
