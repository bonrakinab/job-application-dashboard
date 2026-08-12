import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApplicationPack, CandidateProfile, Job, MatchScore, ProjectItem } from './types';
import { buildJdProjectAlignedCoverLetter } from './cover-letter-tailoring';
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
    project('MSc Thesis - Color-Aware Composed Image Retrieval', ['ai-ml'], ['Python', 'CLIP', 'HNSW', 'Computer Vision', 'Multimodal Retrieval']),
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

test('thesis is always the default project and its skills become resume evidence', () => {
  const tailored = projectTailoredApplicationProfile(profile, job(
    'Full-Stack Software Engineer',
    'Build React and Next.js applications, REST APIs, TypeScript services, and PostgreSQL-backed product features.',
  ));
  assert.equal(tailored.projects?.[0]?.name, 'MSc Thesis - Color-Aware Composed Image Retrieval');
  assert.ok(tailored.skills.includes('CLIP'));
  assert.ok(tailored.skills.includes('HNSW'));
  assert.ok(tailored.skills.includes('Computer Vision'));
  assert.ok(tailored.skills.includes('Multimodal Retrieval'));
});

test('machine-learning roles receive thesis plus only AI/ML project evidence', () => {
  const tailored = projectTailoredApplicationProfile(profile, job(
    'Machine Learning Engineer',
    'Build Python machine-learning systems using embeddings, deep learning, retrieval, and model evaluation.',
  ));
  const names = tailored.projects?.map((item) => item.name) ?? [];
  assert.equal(names[0], 'MSc Thesis - Color-Aware Composed Image Retrieval');
  assert.ok(names.includes('Phishing URL Detection') || names.includes('Student Dropout Analysis'));
  assert.ok(!names.includes('Flowdesk Family CRM'));
  assert.ok(!names.includes('ESS Tax Engine Revamp'));
  assert.ok(names.length <= 3);
});

test('ML titles stay ML-only after the default thesis even when production JDs mention APIs and software practices', () => {
  const tailored = projectTailoredApplicationProfile(profile, job(
    'Machine Learning Platform Engineer',
    'Build production Python services and REST APIs, follow software development practices, deploy machine learning and deep learning models, and maintain model inference pipelines.',
  ));
  const names = tailored.projects?.map((item) => item.name) ?? [];
  assert.ok(names.length > 0);
  assert.ok(names.every((name) => ['MSc Thesis - Color-Aware Composed Image Retrieval', 'Phishing URL Detection', 'Student Dropout Analysis'].includes(name)));
  assert.ok(!names.includes('Flowdesk Family CRM'));
});

test('explicit ERP roles keep thesis by default and otherwise use ERP projects only', () => {
  const tailored = projectTailoredApplicationProfile(profile, job(
    'Oracle Fusion ERP Analyst',
    'Support Oracle Fusion Financials, Procurement, tax configuration, requirements, workflows, and business-process improvements.',
  ));
  assert.deepEqual(tailored.projects?.map((item) => item.name), [
    'MSc Thesis - Color-Aware Composed Image Retrieval',
    'ESS Tax Engine Revamp',
  ]);
});

test('software roles keep thesis and select only software projects for remaining slots', () => {
  const tailored = projectTailoredApplicationProfile(profile, job(
    'Full-Stack Software Engineer',
    'Build React and Next.js applications, REST APIs, TypeScript services, and PostgreSQL-backed product features.',
  ));
  const names = tailored.projects?.map((item) => item.name) ?? [];
  assert.equal(names[0], 'MSc Thesis - Color-Aware Composed Image Retrieval');
  assert.ok(names.includes('Flowdesk Family CRM'));
  assert.ok(names.includes('Inventory Management System'));
  assert.ok(!names.includes('ESS Tax Engine Revamp'));
  assert.ok(!names.includes('FAT File System'));
});

test('cloud roles keep thesis and do not admit unrelated generic projects', () => {
  const tailored = projectTailoredApplicationProfile(profile, job(
    'Cloud Engineer',
    'Build cloud services, APIs and TypeScript automation; support deployments and platform reliability.',
  ));
  assert.deepEqual(tailored.projects?.map((item) => item.name), [
    'MSc Thesis - Color-Aware Composed Image Retrieval',
    'Flowdesk Family CRM',
  ]);
});

test('data analyst roles keep thesis and use data projects for remaining slots', () => {
  const tailored = projectTailoredApplicationProfile(profile, job(
    'Data Analyst',
    'Analyze data with SQL and Python, build reports and visualizations, and support predictive machine learning models with stakeholders.',
  ));
  const names = tailored.projects?.map((item) => item.name) ?? [];
  assert.equal(names[0], 'MSc Thesis - Color-Aware Composed Image Retrieval');
  assert.ok(names.includes('Student Dropout Analysis'));
  assert.ok(names.includes('Inventory Management System'));
  assert.ok(!names.includes('Phishing URL Detection'));
});

test('IT infrastructure roles keep thesis and select systems projects', () => {
  const tailored = projectTailoredApplicationProfile(profile, job(
    'IT Systems Analyst',
    'Support Windows Server, IIS, SQL Server, infrastructure, application support, and production systems.',
  ));
  const names = tailored.projects?.map((item) => item.name) ?? [];
  assert.deepEqual(names, [
    'MSc Thesis - Color-Aware Composed Image Retrieval',
    'EDMS Server Migration',
  ]);
});

test('unknown role families keep only the default thesis instead of unrelated filler', () => {
  const tailored = projectTailoredApplicationProfile(profile, job(
    'Corporate Communications Coordinator',
    'Write internal communications, coordinate events, and manage editorial calendars.',
  ));
  assert.deepEqual(tailored.projects?.map((item) => item.name), ['MSc Thesis - Color-Aware Composed Image Retrieval']);
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

function coverLetterProfile(): CandidateProfile {
  return {
    ...profile,
    name: 'Arnob Banik',
    skills: ['Python', 'TypeScript', 'Next.js', 'React', 'PostgreSQL', 'CLIP', 'HNSW', 'Oracle Fusion ERP Cloud'],
    degrees: [{
      institution: 'University of Windsor',
      degree: 'Master of Science in Computer Science',
      field: 'Artificial Intelligence Specialization',
      start: 'Sept 2024',
      end: 'Aug 2026 (Expected)',
    }],
  };
}

function coverLetterPack(projects: ApplicationPack['projects'], skills: string[]): ApplicationPack {
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

test('software cover letters mirror the JD and discuss the matching software project instead of the default thesis', () => {
  const softwareJob = job(
    'Software Engineer',
    'Build production web applications with TypeScript, Next.js, React, REST APIs, PostgreSQL, authentication and multi-user systems.',
  );
  const match = {
    mustHave: ['TypeScript and Next.js', 'REST APIs', 'PostgreSQL'],
    preferred: [],
    matchedSkills: ['TypeScript', 'Next.js', 'React', 'PostgreSQL'],
  } as unknown as MatchScore;
  const letter = buildJdProjectAlignedCoverLetter(
    coverLetterPack([
      { name: 'MSc Thesis - Color-Aware Composed Image Retrieval', bullets: ['Implemented MSc Thesis - Color-Aware Composed Image Retrieval using Python, CLIP, HNSW.'] },
      { name: 'Flowdesk Family CRM', bullets: ['Implemented Flowdesk Family CRM using Next.js, TypeScript, PostgreSQL.'] },
    ], ['TypeScript', 'Next.js', 'React', 'PostgreSQL', 'CLIP', 'HNSW']),
    coverLetterProfile(),
    softwareJob,
    match,
  );
  assert.match(letter, /TypeScript and Next\.js/i);
  assert.match(letter, /Flowdesk Family CRM/);
  assert.doesNotMatch(letter, /Color-Aware Composed Image Retrieval/);
  assert.match(letter, /graduating in Aug 2026/i);
});

test('machine-learning cover letters use thesis evidence when the JD matches the thesis', () => {
  const mlJob = job(
    'Machine Learning Engineer',
    'Develop Python machine learning systems using CLIP, vector retrieval, HNSW, computer vision and model evaluation.',
  );
  const match = {
    mustHave: ['Python machine learning', 'vector retrieval', 'computer vision'],
    preferred: [],
    matchedSkills: ['Python', 'CLIP', 'HNSW'],
  } as unknown as MatchScore;
  const letter = buildJdProjectAlignedCoverLetter(
    coverLetterPack([
      { name: 'MSc Thesis - Color-Aware Composed Image Retrieval', bullets: ['Implemented MSc Thesis - Color-Aware Composed Image Retrieval using Python, CLIP, HNSW.'] },
      { name: 'Flowdesk Family CRM', bullets: ['Implemented Flowdesk Family CRM using Next.js, TypeScript, PostgreSQL.'] },
    ], ['Python', 'CLIP', 'HNSW', 'TypeScript']),
    coverLetterProfile(),
    mlJob,
    match,
  );
  assert.match(letter, /MSc Thesis - Color-Aware Composed Image Retrieval/);
  assert.match(letter, /CLIP/);
  assert.match(letter, /HNSW/);
  assert.doesNotMatch(letter, /Flowdesk Family CRM/);
});
