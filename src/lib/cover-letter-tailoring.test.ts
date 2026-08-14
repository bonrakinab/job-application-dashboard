import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApplicationPack, CandidateProfile, Job } from './types';
import {
  buildProfessionalFallbackCoverLetter,
  cleanCompanyName,
  coverLetterQualityIssues,
  hasUsableJobDescription,
} from './cover-letter-tailoring';

const profile: CandidateProfile = {
  name: 'Arnob Banik',
  targetTitles: ['Business Systems Consultant'],
  preferredLocations: ['Canada'],
  skills: ['Oracle Fusion ERP Cloud', 'Python', 'SQL', 'TypeScript'],
  degrees: [{ institution: 'University of Windsor', degree: 'MSc Computer Science', field: 'AI', end: 'Aug 2026 (Expected)' }],
  experience: [{
    organization: 'Banglalink',
    title: 'Enterprise Solutions & Services Specialist Engineer',
    bullets: ['Consolidated approximately 15,000 Oracle ERP tax conditions into 460 maintainable rules, improving time-to-market and reducing calculation issues.'],
  }],
  projects: [{
    name: 'Flowdesk - Full-Stack Family CRM',
    description: 'Production family CRM.',
    bullets: ['Designed and shipped a production household CRM with authenticated API routes and multi-user data isolation.'],
    skills: ['TypeScript', 'SQL'],
  }],
};

const pack: ApplicationPack = {
  summary: '',
  resumeHeadline: '',
  resumeSummary: '',
  skills: profile.skills,
  experience: profile.experience!.map((item) => ({ organization: item.organization, title: item.title, bullets: item.bullets })),
  projects: [{ name: profile.projects![0].name, bullets: profile.projects![0].bullets! }],
  coverLetter: '',
  outreachMessage: '',
  interviewThemes: [],
  claimsAudit: [],
};

const sparseJob: Job = {
  id: '1', externalId: '1', source: 'test', sourceKey: 'test', url: 'https://example.com',
  title: 'Business Systems Consultant', company: 'CIBC', description: '2615651',
};

test('detects sparse or corrupted job descriptions', () => {
  assert.equal(hasUsableJobDescription(sparseJob), false);
});

test('rejects the old brittle cover-letter template seen in production', () => {
  const bad = `Dear Hiring Manager,\n\nI am applying for the Business Systems Consultant position at CIBC. What stands out to me in the posting is its emphasis on 2615651.\n\nMy project work has been selected specifically for the technical priorities described in this posting, with unrelated projects omitted from the application.\n\nI would welcome the opportunity to bring this combination of relevant project work, technical skills, and professional experience to CIBC. Thank you for your consideration.\n\nSincerely,\nArnob Banik`;
  const issues = coverLetterQualityIssues(bad, sparseJob);
  assert.ok(issues.includes('internal-or-template-language'));
  assert.ok(issues.includes('exposes-sparse-jd-token'));
});

test('professional fallback never exposes a requisition-only description', () => {
  const letter = buildProfessionalFallbackCoverLetter(pack, profile, sparseJob);
  assert.equal(letter.includes('2615651'), false);
  assert.equal(/what stands out to me/i.test(letter), false);
  assert.equal(/evidence-backed|maps directly|unrelated projects omitted/i.test(letter), false);
  assert.match(letter, /Business Systems Consultant/);
  assert.match(letter, /CIBC/);
  assert.match(letter, /MSc Computer Science \(AI\) candidate/);
});

test('cleans confidential feed suffixes from employer names', () => {
  assert.equal(cleanCompanyName('StackAdapt - Confidential'), 'StackAdapt');
});

test('accepts a structured human-sounding professional letter', () => {
  const good = `Dear Hiring Manager,\n\nI am writing to apply for the Business Systems Consultant position at CIBC. I am an MSc Computer Science (AI) candidate at the University of Windsor, graduating in August 2026. My background combines enterprise systems, software development, and practical experience translating business requirements into maintainable technical solutions.\n\nAt Banglalink, I supported Oracle Fusion ERP Cloud Financials and Procurement workflows while working with operational teams, vendors, and technical stakeholders. I also consolidated approximately 15,000 tax conditions into about 460 maintainable rules, reducing complexity and helping improve the reliability of a business-critical process. That experience taught me to examine requirements carefully, trace issues across systems, and communicate changes in a way that both technical and business users could follow.\n\nAlongside my professional work, I have built software projects that strengthened my hands-on development and data skills. In Flowdesk, I designed and shipped a multi-user CRM with authenticated API routes, structured data isolation, and production deployment concerns in mind. This work required me to move from user requirements to implementation decisions, test behavior across workflows, and maintain a clear data model as the application grew.\n\nI would value the opportunity to bring this mix of enterprise-systems experience, software problem solving, and graduate-level technical work to CIBC. I am particularly interested in roles where technology, process improvement, and stakeholder needs meet, and I would be glad to discuss how my background could support the Business Systems Consultant team. Thank you for your consideration.\n\nSincerely,\nArnob Banik`;
  assert.deepEqual(coverLetterQualityIssues(good, sparseJob), []);
});
