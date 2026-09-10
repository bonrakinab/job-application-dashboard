import assert from 'node:assert/strict';
import test from 'node:test';
import { organizedResumeSkillGroups } from './resume-skill-groups';
import type { CandidateProfile } from './types';

const profile: CandidateProfile = {
  name: 'Arnob Banik',
  targetTitles: [],
  preferredLocations: [],
  skills: [
    'Python', 'TypeScript', 'JavaScript', 'SQL', 'R', 'MATLAB',
    'Next.js', 'React', 'Node.js', 'REST APIs', 'Tailwind CSS', 'Angular', 'Zod', 'HTML5 Canvas', 'Responsive Web Design',
    'PostgreSQL', 'Supabase', 'Neon', 'Prisma ORM',
    'Machine Learning', 'Deep Learning', 'BERT', 'CLIP', 'HNSW', 'FAISS', 'Computer Vision', 'NLP',
    'GitHub Actions/CI', 'Oracle Fusion ERP Cloud', 'JIRA', 'ISO 27001',
  ],
  skillGroups: [
    { label: 'Languages', skills: ['Python', 'TypeScript', 'JavaScript', 'SQL', 'R', 'MATLAB'] },
    { label: 'Full-Stack & APIs', skills: ['Next.js', 'React', 'Node.js', 'REST APIs', 'Tailwind CSS', 'Angular', 'Zod', 'HTML5 Canvas', 'Responsive Web Design'] },
    { label: 'Data & Backend', skills: ['PostgreSQL', 'Supabase', 'Neon', 'Prisma ORM'] },
    { label: 'Applied AI & ML', skills: ['Machine Learning', 'Deep Learning', 'BERT', 'CLIP', 'HNSW', 'FAISS', 'Computer Vision', 'NLP'] },
    { label: 'Cloud, DevOps & Enterprise', skills: ['GitHub Actions/CI', 'Oracle Fusion ERP Cloud', 'JIRA', 'ISO 27001'] },
  ],
};

test('resume skills use the same five-group taxonomy as the canonical LaTeX template', () => {
  const groups = organizedResumeSkillGroups(profile, profile.skills);
  const byLabel = Object.fromEntries(groups.map((group) => [group.label, group.skills]));

  assert.deepEqual(groups.map((group) => group.label), [
    'Languages',
    'Full-Stack & APIs',
    'Data & Backend',
    'Applied AI & ML',
    'Cloud, DevOps & Enterprise',
  ]);
  assert.deepEqual(byLabel.Languages, ['Python', 'TypeScript', 'JavaScript', 'SQL', 'R', 'MATLAB']);
  assert.deepEqual(byLabel['Full-Stack & APIs'], ['Next.js', 'React', 'Node.js', 'REST APIs', 'Tailwind CSS', 'Angular', 'Zod', 'HTML5 Canvas', 'Responsive Web Design']);
  assert.deepEqual(byLabel['Data & Backend'], ['PostgreSQL', 'Supabase', 'Neon', 'Prisma ORM']);
  assert.deepEqual(byLabel['Applied AI & ML'], ['Machine Learning', 'Deep Learning', 'BERT', 'CLIP', 'HNSW', 'FAISS', 'Computer Vision', 'NLP']);
  assert.deepEqual(byLabel['Cloud, DevOps & Enterprise'], ['GitHub Actions/CI', 'Oracle Fusion ERP Cloud', 'JIRA', 'ISO 27001']);
  assert.ok(!groups.some((group) => /Additional|Role-Aligned|Tools & Platforms|Business Analysis/i.test(group.label)));
});

test('organizer changes presentation only and never invents or drops selected skills', () => {
  const selected = ['Oracle Fusion ERP Cloud', 'Requirements Gathering', 'JIRA', 'ISO 27001 Controls', 'SQL'];
  const flattened = organizedResumeSkillGroups(profile, selected).flatMap((group) => group.skills);
  assert.deepEqual(flattened.sort(), [...selected].sort());
});
