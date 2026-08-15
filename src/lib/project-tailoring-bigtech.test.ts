import assert from 'node:assert/strict';
import test from 'node:test';
import type { CandidateProfile, Job, ProjectItem } from './types';
import { isHighSelectivityTargetCompany, projectTailoredApplicationProfile, type ProjectRoleFamily } from './project-tailoring';

function project(name: string, roleFamilies: ProjectRoleFamily[], skills: string[] = []): ProjectItem {
  return {
    name,
    description: `${name} project`,
    bullets: [`Built ${name} with ${skills.join(', ')}.`],
    skills,
    roleFamilies,
  } as ProjectItem & { roleFamilies: ProjectRoleFamily[] };
}

const profile: CandidateProfile = {
  name: 'Arnob Banik',
  targetTitles: [],
  preferredLocations: [],
  skills: ['Python', 'Machine Learning', 'TypeScript', 'Next.js'],
  projects: [
    project('MSc Thesis - Color-Aware Composed Image Retrieval', ['ai-ml'], ['Python', 'CLIP', 'HNSW']),
    project('Phishing URL Detection Using Artificial Intelligence', ['ai-ml', 'cybersecurity'], ['Python', 'BERT', 'Machine Learning']),
    project('Student Dropout Analysis and Prediction', ['ai-ml', 'data-analytics'], ['Python', 'Machine Learning']),
    project('Flowdesk - Full-Stack Family CRM', ['software', 'cloud-devops'], ['Next.js', 'TypeScript']),
    project('Parallel Paths - Two-Player WebRTC Browser Game', ['software'], ['JavaScript', 'WebRTC']),
  ],
};

function job(company: string, title: string, description: string): Job {
  return {
    externalId: `${company}-${title}`,
    source: 'test',
    sourceKey: 'test',
    url: 'https://example.com',
    title,
    company,
    description,
  };
}

test('FAANG/MAANG and major technology employers are recognized for the stronger academic-project mix', () => {
  for (const company of ['Google', 'Meta', 'Amazon', 'Apple', 'Microsoft', 'Netflix', 'NVIDIA', 'OpenAI']) {
    assert.equal(isHighSelectivityTargetCompany(company), true, company);
  }
  assert.equal(isHighSelectivityTargetCompany('Small Local Agency'), false);
});

test('big-tech software roles include at least two AI/ML projects before a software project', () => {
  const tailored = projectTailoredApplicationProfile(profile, job(
    'Google',
    'Software Engineer',
    'Build scalable backend services, APIs, distributed systems, and production software using Python and modern engineering practices.',
  ));
  const names = tailored.projects?.map((item) => item.name) ?? [];
  const selected = tailored.projects ?? [];
  const mlCount = selected.filter((item) => ((item as ProjectItem & { roleFamilies?: ProjectRoleFamily[] }).roleFamilies ?? []).includes('ai-ml')).length;

  assert.equal(names[0], 'MSc Thesis - Color-Aware Composed Image Retrieval');
  assert.ok(mlCount >= 2, `expected at least two ML projects, got ${names.join(', ')}`);
  assert.ok(names.includes('Flowdesk - Full-Stack Family CRM'));
  assert.equal(names.includes('Parallel Paths - Two-Player WebRTC Browser Game'), false);
});

test('large selective employers keep the two-ML-project minimum for non-ML technical roles when evidence is available', () => {
  const tailored = projectTailoredApplicationProfile(profile, job(
    'Walmart Global Tech',
    'Backend Software Engineer',
    'Develop Java and Python APIs, distributed services, data pipelines, and reliable cloud software.',
  ));
  const selected = tailored.projects ?? [];
  const mlCount = selected.filter((item) => ((item as ProjectItem & { roleFamilies?: ProjectRoleFamily[] }).roleFamilies ?? []).includes('ai-ml')).length;
  assert.ok(mlCount >= 2);
  assert.ok(selected.length <= 3);
});
