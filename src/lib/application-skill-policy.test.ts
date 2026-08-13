import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApplicationPack, CandidateProfile } from './types';
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
    'Approximate Nearest Neighbor (ANN)', 'Image Retrieval',
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

test('persistent MSc/ML skills remain in non-ML application packs', () => {
  const result = withPersistentApplicationSkills(pack(), profile);
  for (const skill of [
    'Python', 'Machine Learning', 'Deep Learning', 'Computer Vision', 'NLP', 'BERT',
    'CLIP', 'HNSW', 'FAISS', 'scikit-learn', 'TensorFlow', 'Multimodal Retrieval',
    'Vector Search', 'Approximate Nearest Neighbor (ANN)', 'Image Retrieval',
  ]) {
    assert.ok(result.skills.includes(skill), `${skill} should remain visible`);
  }
  assert.deepEqual(result.skills.slice(0, 2), ['TypeScript', 'Next.js'], 'JD-relevant skills should stay first');
});

test('persistent skill policy never invents skills absent from the master profile', () => {
  const withoutTensorFlow = { ...profile, skills: profile.skills.filter((skill) => skill !== 'TensorFlow') };
  const result = withPersistentApplicationSkills(pack(), withoutTensorFlow);
  assert.equal(result.skills.includes('TensorFlow'), false);
});

test('inventory management is suppressed from employer-facing application evidence', () => {
  const external = externalApplicationProfile(profile);
  assert.deepEqual(external.projects?.map((project) => project.name), [
    'MSc Thesis - Color-Aware Composed Image Retrieval',
    'Flowdesk - Full-Stack Family CRM',
  ]);
});
