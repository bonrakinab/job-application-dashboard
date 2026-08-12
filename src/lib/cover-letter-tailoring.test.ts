import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApplicationPack, CandidateProfile, Job, MatchScore } from './types';
import { buildJdProjectAlignedCoverLetter } from './cover-letter-tailoring';

const profile: CandidateProfile = {
  name: 'Arnob Banik',
  targetTitles: [],
  preferredLocations: ['Canada'],
  skills: ['Python', 'TypeScript', 'Next.js', 'React', 'PostgreSQL', 'CLIP', 'HNSW', 'Oracle Fusion ERP Cloud'],
  degrees: [{
    institution: 'University of Windsor',
    degree: 'Master of Science in Computer Science',
    field: 'Artificial Intelligence Specialization',
    start: 'Sept 2024',
    end: 'Aug 2026 (Expected)',
  }],
  projects: [
    {
      name: 'MSc Thesis - Color-Aware Composed Image Retrieval',
      description: 'Efficient multimodal retrieval research.',
      skills: ['Python', 'CLIP', 'HNSW', 'Machine Learning', 'Computer Vision'],
      bullets: ['Developed a color-aware composed image retrieval framework using CLIP and HNSW.'],
    },
    {
      name: 'Flowdesk - Full-Stack Family CRM',
      description: 'Production full-stack CRM.',
      skills: ['Next.js', 'React', 'TypeScript', 'PostgreSQL', 'REST APIs'],
      bullets: ['Designed and shipped a production household CRM with authenticated API routes and multi-user data isolation.'],
    },
    {
      name: 'Go-Live of ESS Tax Engine Revamp',
      description: 'Oracle ERP tax-engine revamp.',
      skills: ['Oracle Fusion ERP Cloud', 'Financials', 'Procurement'],
      bullets: ['Consolidated approximately 15,000 tax conditions into maintainable ERP rules.'],
    },
  ],
};

function job(title: string, description: string): Job {
  return {
    externalId: title,
    source: 'test',
    sourceKey: 'test',
    url: 'https://example.com',
    title,
    company: 'Example Technologies',
    location: 'Canada',
    description,
  };
}

function pack(projects: ApplicationPack['projects'], skills: string[]): ApplicationPack {
  return {
    summary: 'test',
    resumeHeadline: 'test',
    resumeSummary: 'test',
    skills,
    experience: [{
      organization: 'Banglalink',
      title: 'Enterprise Solutions and Services Specialist Engineer, IT',
      bullets: ['Supported Oracle Fusion ERP Cloud Financials and Procurement workflows.'],
    }],
    projects,
    coverLetter: 'old generic cover letter',
    outreachMessage: 'test',
    interviewThemes: [],
    claimsAudit: [],
  };
}

test('software cover letter mirrors JD needs and discusses the relevant software project, not the default thesis', () => {
  const softwareJob = job(
    'Software Engineer',
    'Build production web applications with TypeScript, Next.js, React, REST APIs, PostgreSQL, authentication and multi-user systems.',
  );
  const match = {
    mustHave: ['TypeScript and Next.js', 'REST APIs', 'PostgreSQL'],
    preferred: [],
    matchedSkills: ['TypeScript', 'Next.js', 'React', 'PostgreSQL'],
  } as MatchScore;
  const letter = buildJdProjectAlignedCoverLetter(
    pack([
      { name: 'MSc Thesis - Color-Aware Composed Image Retrieval', bullets: ['Developed a color-aware composed image retrieval framework using CLIP and HNSW.'] },
      { name: 'Flowdesk - Full-Stack Family CRM', bullets: ['Designed and shipped a production household CRM with authenticated API routes and multi-user data isolation.'] },
    ], ['TypeScript', 'Next.js', 'React', 'PostgreSQL', 'CLIP', 'HNSW']),
    profile,
    softwareJob,
    match,
  );

  assert.match(letter, /TypeScript and Next\.js/i);
  assert.match(letter, /Flowdesk - Full-Stack Family CRM/);
  assert.doesNotMatch(letter, /Color-Aware Composed Image Retrieval/);
  assert.match(letter, /graduating in Aug 2026/i);
});

test('machine-learning cover letter uses thesis evidence when the JD matches the thesis', () => {
  const mlJob = job(
    'Machine Learning Engineer',
    'Develop Python machine learning systems using CLIP, vector retrieval, HNSW, computer vision and model evaluation.',
  );
  const match = {
    mustHave: ['Python machine learning', 'vector retrieval', 'computer vision'],
    preferred: [],
    matchedSkills: ['Python', 'CLIP', 'HNSW'],
  } as MatchScore;
  const letter = buildJdProjectAlignedCoverLetter(
    pack([
      { name: 'MSc Thesis - Color-Aware Composed Image Retrieval', bullets: ['Developed a color-aware composed image retrieval framework using CLIP and HNSW.'] },
      { name: 'Flowdesk - Full-Stack Family CRM', bullets: ['Designed and shipped a production household CRM with authenticated API routes and multi-user data isolation.'] },
    ], ['Python', 'CLIP', 'HNSW', 'TypeScript']),
    profile,
    mlJob,
    match,
  );

  assert.match(letter, /MSc Thesis - Color-Aware Composed Image Retrieval/);
  assert.match(letter, /CLIP/);
  assert.match(letter, /HNSW/);
  assert.doesNotMatch(letter, /Flowdesk - Full-Stack Family CRM/);
});

test('ERP cover letter chooses ERP project evidence instead of unrelated academic work', () => {
  const erpJob = job(
    'Oracle ERP Analyst',
    'Support Oracle Fusion ERP Cloud Financials and Procurement, business workflows and tax configuration.',
  );
  const match = {
    mustHave: ['Oracle Fusion ERP Cloud', 'Financials and Procurement'],
    preferred: [],
    matchedSkills: ['Oracle Fusion ERP Cloud'],
  } as MatchScore;
  const letter = buildJdProjectAlignedCoverLetter(
    pack([
      { name: 'MSc Thesis - Color-Aware Composed Image Retrieval', bullets: ['Developed a color-aware composed image retrieval framework using CLIP and HNSW.'] },
      { name: 'Go-Live of ESS Tax Engine Revamp', bullets: ['Consolidated approximately 15,000 tax conditions into maintainable ERP rules.'] },
    ], ['Oracle Fusion ERP Cloud', 'Python', 'CLIP']),
    profile,
    erpJob,
    match,
  );

  assert.match(letter, /Oracle Fusion ERP Cloud/);
  assert.match(letter, /Go-Live of ESS Tax Engine Revamp/);
  assert.doesNotMatch(letter, /Color-Aware Composed Image Retrieval/);
});
