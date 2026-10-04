import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeUploadedResume } from './ats-analyzer';
import type { CandidateProfile, Job, MatchScore } from './types';

const profile: CandidateProfile = {
  name: 'Sample Candidate',
  email: 'candidate@example.com',
  phone: '555-0100',
  location: 'Windsor, Ontario',
  headline: 'Customer Service Representative',
  summary: 'Customer service professional with retail point-of-sale experience.',
  targetTitles: ['Customer Service Representative'],
  preferredLocations: ['Windsor, Ontario'],
  skills: ['Customer Service', 'Point of Sale', 'Inventory'],
  yearsExperience: 2,
  experience: [{
    organization: 'Example Store',
    title: 'Retail Associate',
    start: '01/2024',
    end: 'Present',
    location: 'Windsor, Ontario',
    bullets: ['Helped customers resolve purchase questions and processed point-of-sale transactions.'],
    skills: ['Customer Service', 'Point of Sale'],
  }],
  degrees: [],
  projects: [],
  certifications: [],
  languages: [],
  courses: [],
  awards: [],
  publications: [],
  workAuthorization: [],
  links: {},
};

const job: Job = {
  externalId: 'ats-test',
  source: 'test',
  sourceKey: 'ats-test',
  url: '',
  title: 'Customer Service Representative',
  company: 'Example Employer',
  location: 'Windsor, Ontario',
  description: 'Customer Service Representative required to help customers, process point-of-sale transactions, and manage inventory. Salesforce experience is preferred.',
};

const match: MatchScore = {
  overall: 78,
  skills: 82,
  experience: 76,
  education: 70,
  domain: 84,
  location: 100,
  recommendation: 'reasonable',
  blockers: [],
  strengths: ['Customer service evidence', 'Point-of-sale experience'],
  gaps: ['No Salesforce evidence'],
  mustHave: ['Customer service', 'Point-of-sale transactions', 'Inventory management'],
  preferred: ['Salesforce'],
  matchedSkills: ['Customer Service', 'Point of Sale', 'Inventory'],
  missingSkills: ['Salesforce'],
  explanation: 'Relevant customer service background with one preferred-skill gap.',
  model: 'test-model',
};

test('ATS analyzer returns a separate score and breakdown for every internal checker', () => {
  const result = analyzeUploadedResume({
    job,
    profile,
    match,
    inspection: {
      text: 'Sample Candidate customer service point of sale inventory experience '.repeat(20),
      format: 'DOCX',
      pageCount: 1,
      structuralIssues: ['Tables can change the ATS reading order.'],
      parseabilityScore: 84,
    },
    resumeFileName: 'resume.docx',
    profileExtractionModel: 'test-extractor',
    selectedModel: 'google/gemini-3.8-flash',
  });

  assert.equal(result.checkers.length, 6);
  assert.deepEqual(result.checkers.map((checker) => checker.id), [
    'readiness', 'match', 'requirements', 'keywords', 'format', 'integrity',
  ]);
  assert.equal(result.models.jobAnalysis, 'test-model');
  assert.equal(result.models.selected, 'google/gemini-3.8-flash');
  assert.ok(result.combinedScore >= 0 && result.combinedScore <= 100);
  assert.ok(result.checkers.every((checker) => checker.score >= 0 && checker.score <= 100));
  assert.ok(result.checkers.find((checker) => checker.id === 'format')?.needsWork.some((item) => item.includes('Tables')));
  assert.ok(result.missingKeywords.some((keyword) => keyword.toLowerCase().includes('salesforce')));
  assert.ok(result.requirements.some((requirement) => requirement.requirement === 'Salesforce' && requirement.support === 'gap'));
});
