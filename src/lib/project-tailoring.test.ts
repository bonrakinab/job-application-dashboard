import assert from 'node:assert/strict';
import test from 'node:test';
import type { CandidateProfile, Job, ProjectItem } from './types';
import { inferProjectRoleFamilies, projectTailoredApplicationProfile, type ProjectRoleFamily } from './project-tailoring';

function project(name: string, roleFamilies: ProjectRoleFamily[], skills: string[] = []): ProjectItem {
  return {
    name,
    description: `${name} project`,
    bullets: [`Implemented ${name} using ${skills.join(', ') || 'relevant technologies'}.`],
    skills,
    roleFamilies,
  } as ProjectItem & { roleFamilies: ProjectRoleFamily[] };
}

const profile: CandidateProfile = {
  name: 'Arnob',
  targetTitles: [],
  preferredLocations: ['Canada'],
  skills: [],
  projects: [
    project('Color-Aware Composed Image Retrieval', ['ai-ml'], ['Python', 'CLIP', 'HNSW']),
    project('Phishing URL Detection', ['ai-ml', 'cybersecurity'], ['Python', 'BERT', 'Machine Learning']),
    project('Student Dropout Analysis', ['ai-ml', 'data-analytics'], ['Python', 'Pandas', 'Scikit-learn']),
    project('Flowdesk Family CRM', ['software', 'cloud-devops', 'business-analysis'], ['Next.js', 'TypeScript', 'PostgreSQL']),
    project('Inventory Management System', ['software', 'data-analytics'], ['PHP', 'JavaScript', 'MySQL']),
    project('ESS Tax Engine Revamp', ['erp-enterprise', 'business-analysis'], ['Oracle Fusion', 'Tax Rules']),
    project('EDMS Server Migration', ['it-systems'], ['SQL Server', 'IIS', 'Windows Server']),
    project('FAT File System', ['systems-algorithms'], ['C']),
  ],
};

function job(title: string, description: string): Job {
  return {
    externalId: title,
    source: 'test',
    sourceKey: 'test',
    url: 'https://example.com',
    title,
    company: 'Example',
    location: 'Canada',
    description,
  };
}

test('machine-learning roles receive only AI/ML project evidence', () => {
  const tailored = projectTailoredApplicationProfile(profile, job(
    'Machine Learning Engineer',
    'Build Python machine-learning systems using embeddings, deep learning, retrieval, and model evaluation.',
  ));
  const names = tailored.projects?.map((item) => item.name) ?? [];
  assert.ok(names.includes('Color-Aware Composed Image Retrieval'));
  assert.ok(names.includes('Phishing URL Detection') || names.includes('Student Dropout Analysis'));
  assert.ok(!names.includes('Flowdesk Family CRM'));
  assert.ok(!names.includes('ESS Tax Engine Revamp'));
  assert.ok(names.length <= 3);
});

test('ML titles stay ML-only even when production JDs mention APIs and software practices', () => {
  const tailored = projectTailoredApplicationProfile(profile, job(
    'Machine Learning Platform Engineer',
    'Build production Python services and REST APIs, follow software development practices, deploy machine learning and deep learning models, and maintain model inference pipelines.',
  ));
  const names = tailored.projects?.map((item) => item.name) ?? [];
  assert.ok(names.length > 0);
  assert.ok(names.every((name) => ['Color-Aware Composed Image Retrieval', 'Phishing URL Detection', 'Student Dropout Analysis'].includes(name)));
  assert.ok(!names.includes('Flowdesk Family CRM'));
});

test('ERP and business-systems roles prefer enterprise projects and exclude ML projects', () => {
  const tailored = projectTailoredApplicationProfile(profile, job(
    'Oracle Fusion ERP Analyst',
    'Support Oracle Fusion Financials, Procurement, tax configuration, requirements, and business-process improvements.',
  ));
  const names = tailored.projects?.map((item) => item.name) ?? [];
  assert.ok(names.includes('ESS Tax Engine Revamp'));
  assert.ok(!names.includes('Color-Aware Composed Image Retrieval'));
  assert.ok(!names.includes('Phishing URL Detection'));
});

test('software roles select software projects rather than unrelated academic ML work', () => {
  const tailored = projectTailoredApplicationProfile(profile, job(
    'Full-Stack Software Engineer',
    'Build React and Next.js applications, REST APIs, TypeScript services, and PostgreSQL-backed product features.',
  ));
  const names = tailored.projects?.map((item) => item.name) ?? [];
  assert.ok(names.includes('Flowdesk Family CRM'));
  assert.ok(names.includes('Inventory Management System'));
  assert.ok(!names.includes('ESS Tax Engine Revamp'));
  assert.ok(!names.includes('FAT File System'));
});

test('IT infrastructure roles select systems projects', () => {
  const tailored = projectTailoredApplicationProfile(profile, job(
    'IT Systems Analyst',
    'Support Windows Server, IIS, SQL Server, infrastructure, application support, and production systems.',
  ));
  const names = tailored.projects?.map((item) => item.name) ?? [];
  assert.deepEqual(names, ['EDMS Server Migration']);
});

test('unknown role families do not pad the resume with unrelated projects', () => {
  const tailored = projectTailoredApplicationProfile(profile, job(
    'Corporate Communications Coordinator',
    'Write internal communications, coordinate events, and manage editorial calendars.',
  ));
  assert.deepEqual(tailored.projects, []);
});

test('untagged projects are not admitted through accidental keyword overlap', () => {
  const withLegacyProject: CandidateProfile = {
    ...profile,
    projects: [
      ...(profile.projects ?? []),
      {
        name: 'Legacy Generic Project',
        description: 'Python API software machine learning analytics cloud project',
        bullets: ['Used Python APIs for machine learning software analytics in the cloud.'],
        skills: ['Python', 'Machine Learning'],
      },
    ],
  };
  const tailored = projectTailoredApplicationProfile(withLegacyProject, job(
    'Machine Learning Engineer',
    'Build Python APIs for production machine learning systems.',
  ));
  assert.ok(!(tailored.projects ?? []).some((item) => item.name === 'Legacy Generic Project'));
});

test('mixed business-systems titles infer both enterprise and analysis families', () => {
  const families = inferProjectRoleFamilies(job(
    'Business Systems Analyst',
    'Gather requirements and support ERP integrations across finance systems.',
  ));
  assert.ok(families.includes('erp-enterprise'));
  assert.ok(families.includes('business-analysis'));
});
