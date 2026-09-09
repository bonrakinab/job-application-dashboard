import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import mammoth from 'mammoth';
import { resumeDocx } from './application-docx';
import { resumePdf } from './application-pdf';
import { validateExtractedResumeText, validateResumeDocxArtifact, validateResumePdfArtifact } from './resume-artifact-validation';
import { formatAtsDate, formatAtsDateRange, visibleResumeText } from './resume-content';
import { containsTerm, groundedRewriteIssue } from './resume-evidence-guards';
import type { ApplicationPack, CandidateProfile, Job } from './types';

const profile: CandidateProfile = {
  name: 'Arnob Banik',
  email: 'arnob@example.com',
  phone: '+1 555 0100',
  location: 'Windsor, Ontario, Canada',
  links: { LinkedIn: 'https://linkedin.com/in/example', GitHub: 'https://github.com/example' },
  targetTitles: [],
  preferredLocations: [],
  skills: ['TypeScript', 'React', 'PostgreSQL'],
  skillGroups: [{ label: 'Technical', skills: ['TypeScript', 'React', 'PostgreSQL'] }],
  experience: [{
    organization: 'Example Co',
    title: 'Software Development Intern',
    start: 'September 2023',
    end: 'June 2024',
    location: 'Remote',
    bullets: ['Built TypeScript application components backed by PostgreSQL.'],
    skills: ['TypeScript', 'PostgreSQL'],
  }],
  projects: [{
    name: 'Application Dashboard',
    description: 'Full-stack dashboard.',
    bullets: ['Built a React dashboard for application tracking.'],
    skills: ['React', 'TypeScript'],
  }],
  degrees: [{
    institution: 'University of Windsor',
    degree: 'Master of Science in Computer Science',
    start: 'September 2024',
    end: 'August 2026 (Expected)',
    coursework: ['Software Engineering'],
  }],
};

const job: Job = {
  externalId: 'docx-test', source: 'test', sourceKey: 'test', url: 'https://example.com/job',
  title: 'Software Engineer', company: 'Example', description: 'TypeScript, React, and PostgreSQL.',
};

const pack: ApplicationPack = {
  summary: 'Pack',
  resumeHeadline: 'Software Engineer | TypeScript | React',
  resumeSummary: 'Software engineering candidate with verified TypeScript, React, and PostgreSQL experience.',
  skills: ['TypeScript', 'React', 'PostgreSQL'],
  experience: [{ organization: 'Example Co', title: 'Software Development Intern', bullets: ['Built TypeScript application components backed by PostgreSQL.'], bulletEvidence: [['EXP:0:0']] }],
  projects: [{ name: 'Application Dashboard', bullets: ['Built a React dashboard for application tracking.'], bulletEvidence: [['PROJ:0:0']] }],
  education: [],
  certifications: ['Google IT Support'],
  coverLetter: '', outreachMessage: '', interviewThemes: [], claimsAudit: [],
};

test('dates are normalized without inventing missing month information', () => {
  assert.equal(formatAtsDate('September 2023'), '09/2023');
  assert.equal(formatAtsDate('Aug 2026 (Expected)'), '08/2026 (Expected)');
  assert.equal(formatAtsDate('Present'), 'Present');
  assert.equal(formatAtsDateRange('Dec 2022', 'March 2023'), '12/2022 - 03/2023');
  assert.equal(formatAtsDate('2021'), '2021');
});

test('generated DOCX is single-column, table-free, and round-trips through a resume parser', async () => {
  const docx = await resumeDocx(profile, job, pack);
  const validation = await validateResumeDocxArtifact(docx, profile, pack);
  assert.equal(validation.safe, true, JSON.stringify(validation));
  assert.ok(validation.parseCoverage >= 92);

  const zip = await JSZip.loadAsync(docx);
  const documentXml = await zip.file('word/document.xml')!.async('string');
  assert.doesNotMatch(documentXml, /<w:tbl\b/);
  assert.doesNotMatch(documentXml, /<w:txbxContent\b/);
  assert.ok(!Object.keys(zip.files).some((name) => /^word\/(?:header|footer)/i.test(name)));
  const parsed = (await mammoth.extractRawText({ buffer: docx })).value;
  assert.match(parsed, /Software Engineer \| TypeScript \| React/);
  assert.match(parsed, /Sept 2023 - June 2024/);
  assert.match(parsed, /Aug 2026 \(Expected\)/);
  assert.ok(parsed.indexOf('PROFESSIONAL SUMMARY') < parsed.indexOf('EXPERIENCE'));
  assert.ok(parsed.indexOf('EXPERIENCE') < parsed.indexOf('SKILLS'));
});

test('generated PDF round-trips through a resume parser with the same visible content', async () => {
  const pdf = resumePdf(profile, job, pack);
  const validation = await validateResumePdfArtifact(pdf, profile, pack);
  assert.equal(validation.safe, true, JSON.stringify(validation));
  assert.ok(validation.parseCoverage >= 92);
});

test('section names in ordinary prose do not create headings; missing content and reordered headings fail', () => {
  const candidatePack = { ...pack, resumeSummary: 'Technical skills and projects complement my experience in software engineering.' };
  const text = visibleResumeText(profile, candidatePack);
  assert.equal(validateExtractedResumeText(text, profile, candidatePack).safe, true);
  for (const omitted of [candidatePack.resumeSummary, profile.phone!, 'Sept 2023 - June 2024', 'EXPERIENCE']) {
    assert.equal(validateExtractedResumeText(text.replace(omitted, ''), profile, candidatePack).safe, false, omitted);
  }
  assert.equal(validateExtractedResumeText(text.replace('EXPERIENCE', 'TEMP').replace('SKILLS', 'EXPERIENCE').replace('TEMP', 'SKILLS'), profile, candidatePack).safe, false);
});

test('technology terms match complete tokens, including punctuation', () => {
  assert.equal(containsTerm('JavaScript developer', 'Java'), false);
  assert.equal(containsTerm('C++ and C#', 'C'), false);
  assert.equal(containsTerm('C++, C#, .NET and SQL.', 'C++'), true);
  assert.equal(containsTerm('C++, C#, .NET and SQL.', '.NET'), true);
  assert.equal(containsTerm('C++, C#, .NET and SQL.', 'SQL'), true);
  assert.equal(containsTerm('maintained reports', 'AI'), false);
});

test('rewrites cannot invent lowercase tools, remove qualifications, or repurpose metrics', () => {
  assert.ok(groundedRewriteIssue('Built Python automation using kubernetes for finance reporting.', 'Built Python automation for finance reporting.'));
  assert.ok(groundedRewriteIssue('Developed production dashboards for finance.', 'Helped develop prototype dashboards for finance.'));
  assert.ok(groundedRewriteIssue('Reduced costs by 20% using Python.', 'Reduced latency by 20% using Python.'));
  assert.equal(groundedRewriteIssue('Developed Python reporting automation for finance.', 'Built Python automation for finance reporting.'), null);
});
