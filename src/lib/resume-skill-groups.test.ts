import assert from 'node:assert/strict';
import test from 'node:test';
import { organizedResumeSkillGroups } from './resume-skill-groups';
import type { CandidateProfile } from './types';

const profile: CandidateProfile = {
  name: 'Arnob Banik',
  targetTitles: [],
  preferredLocations: [],
  skills: [
    'Python', 'TypeScript', 'JavaScript', 'R',
    'Next.js', 'React', 'Node.js', 'REST APIs', 'Tailwind CSS', 'Angular', 'Zod',
    'Machine Learning', 'Deep Learning', 'BERT', 'CLIP', 'HNSW', 'FAISS', 'Computer Vision', 'NLP',
    'GitHub Actions/CI', 'HTML5 Canvas', 'Responsive Web Design',
  ],
  skillGroups: [
    { label: 'Languages', skills: ['Python', 'TypeScript', 'JavaScript', 'R'] },
    { label: 'Full-Stack & APIs', skills: ['Next.js', 'React', 'Node.js', 'REST APIs', 'Tailwind CSS', 'Angular', 'Zod'] },
    { label: 'Applied AI & ML', skills: ['Machine Learning', 'Deep Learning', 'BERT', 'CLIP', 'HNSW', 'FAISS', 'Computer Vision', 'NLP'] },
    { label: 'Cloud, DevOps & Enterprise', skills: ['GitHub Actions/CI'] },
    { label: 'Additional', skills: ['HTML5 Canvas', 'Responsive Web Design'] },
  ],
};

test('front-end resume skills are reorganized into coherent employer-facing groups', () => {
  const groups = organizedResumeSkillGroups(profile, profile.skills);
  const byLabel = Object.fromEntries(groups.map((group) => [group.label, group.skills]));

  assert.deepEqual(byLabel.Languages, ['Python', 'TypeScript', 'JavaScript', 'R']);
  assert.deepEqual(byLabel['Frontend & Full-Stack'], ['Next.js', 'React', 'Tailwind CSS', 'Angular', 'HTML5 Canvas', 'Responsive Web Design']);
  assert.deepEqual(byLabel['Backend, APIs & Data'], ['Node.js', 'REST APIs', 'Zod']);
  assert.deepEqual(byLabel['AI & ML'], ['Machine Learning', 'Deep Learning', 'BERT', 'CLIP', 'HNSW', 'FAISS', 'Computer Vision', 'NLP']);
  assert.deepEqual(byLabel['Cloud & DevOps'], ['GitHub Actions/CI']);
  assert.ok(!groups.some((group) => group.label === 'Additional' || group.label === 'Role-Aligned'));
});

test('organizer changes presentation only and never invents or drops selected skills', () => {
  const selected = ['Oracle Fusion ERP Cloud', 'Requirements Gathering', 'JIRA', 'ISO 27001 Controls', 'SQL'];
  const flattened = organizedResumeSkillGroups(profile, selected).flatMap((group) => group.skills);
  assert.deepEqual(flattened.sort(), [...selected].sort());
});
