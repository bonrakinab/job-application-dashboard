import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApplicationPack, CandidateProfile, Job } from './types';
import { withPersistentApplicationSkills } from './application-skill-policy';
import { externalApplicationProfile } from './application-visibility';

const profile: CandidateProfile = {
  name: 'Arnob Banik',
  targetTitles: ['Software Engineer'],
  preferredLocations: ['Canada'],
  skills: [
    'TypeScript', 'Next.js', 'Python', 'Machine Learning', 'Deep Learning',
    'Computer Vision', 'NLP', 'BERT', 'CLIP', 'HNSW', 'FAISS',
    'scikit-learn', 'TensorFlow', 'Multimodal Retrieval', 'Vector Search',
    'Approximate Nearest Neighbor (ANN)', 'Image Retrieval', 'Oracle Fusion ERP Cloud', 'SQL',
  ],
  projects: [
    { name: 'MSc Thesis - Color-Aware Composed Image Retrieval', description: 'Thesis', bullets: ['Built retrieval system.'] },
    { name: 'Inventory Management System', description: 'Inventory', bullets: ['Built inventory CRUD app.'] },
    { name: 'Flowdesk - Full-Stack Family CRM', description: 'CRM', bullets: ['Built production application.'] },
  ],
};

function pack(): ApplicationPack {
  return {
    summary: 'test',
    resumeHeadline: 'Software Engineer',
    resumeSummary: 'test',
    skills: ['TypeScript', 'Next.js'],
    experience: [],
    projects: [],
    coverLetter: 'test',
    outreachMessage: 'test',
    interviewThemes: [],
    claimsAudit: [],
  };
}

function job(title: string, description: string): Job {
  return { externalId: title, source: 'test', sourceKey: title, url: 'https://example.com', title, company: 'Example', description };
}

test('non-ML resumes do not receive unrelated AI/ML filler', () => {
  const result = withPersistentApplicationSkills(
    pack(),
    profile,
    job('Oracle Fusion ERP Technical Analyst', 'Support Oracle Fusion ERP Cloud and SQL-based financial systems.'),
  );
  assert.ok(result.skills.includes('Oracle Fusion ERP Cloud'));
  assert.ok(result.skills.includes('SQL'));
  assert.ok(result.skills.includes('TypeScript'));
  assert.equal(result.skills.includes('CLIP'), false);
  assert.equal(result.skills.includes('HNSW'), false);
  assert.equal(result.skills.includes('FAISS'), false);
});

test('ML roles retain verified ML skills when the JD actually asks for them', () => {
  const result = withPersistentApplicationSkills(
    { ...pack(), skills: ['Python', 'Machine Learning'] },
    profile,
    job('Machine Learning Engineer', 'Build Python machine learning systems using TensorFlow, BERT, vector search and HNSW.'),
  );
  for (const skill of ['Python', 'Machine Learning', 'TensorFlow', 'BERT', 'Vector Search', 'HNSW']) {
    assert.ok(result.skills.includes(skill), `${skill} should be selected from the verified profile`);
  }
});

test('skill policy never invents skills absent from the master profile', () => {
  const withoutTensorFlow = { ...profile, skills: profile.skills.filter((skill) => skill !== 'TensorFlow') };
  const result = withPersistentApplicationSkills(
    { ...pack(), skills: ['TypeScript', 'TensorFlow'] },
    withoutTensorFlow,
    job('ML Engineer', 'TensorFlow is required.'),
  );
  assert.equal(result.skills.includes('TensorFlow'), false);
});

test('inventory management is suppressed from employer-facing application evidence', () => {
  const external = externalApplicationProfile(profile);
  assert.deepEqual(external.projects?.map((project) => project.name), [
    'MSc Thesis - Color-Aware Composed Image Retrieval',
    'Flowdesk - Full-Stack Family CRM',
  ]);
});
