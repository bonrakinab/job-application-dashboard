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
    'Oracle Fusion ERP Cloud', 'JIRA', 'Confluence', 'Oracle Cloud Infrastructure',
    'Next.js', 'React', 'Node.js', 'REST APIs', 'Tailwind CSS', 'Angular', 'Zod', 'HTML5 Canvas', 'Responsive Web Design',
    'PostgreSQL', 'Supabase', 'Machine Learning', 'Deep Learning', 'BERT', 'CLIP', 'HNSW', 'FAISS', 'Computer Vision', 'NLP',
    'Requirements Gathering', 'Process Mapping', 'Documentation', 'ISO 27001', 'Access Management', 'Risk Assessment',
  ],
  skillGroups: [
    { label: 'Languages', skills: ['Python', 'TypeScript', 'JavaScript', 'SQL', 'R', 'MATLAB'] },
    { label: 'Enterprise & ERP', skills: ['Oracle Fusion ERP Cloud'] },
    { label: 'Project Management', skills: ['JIRA', 'Confluence'] },
    { label: 'Cloud', skills: ['Oracle Cloud Infrastructure'] },
    { label: 'Development Tools & API Platforms', skills: ['Next.js', 'React', 'Node.js', 'REST APIs', 'Tailwind CSS', 'Angular', 'Zod', 'HTML5 Canvas', 'Responsive Web Design'] },
    { label: 'Data & AI', skills: ['PostgreSQL', 'Supabase', 'Machine Learning', 'Deep Learning', 'BERT', 'CLIP', 'HNSW', 'FAISS', 'Computer Vision', 'NLP'] },
    { label: 'Business Analysis', skills: ['Requirements Gathering', 'Process Mapping', 'Documentation'] },
    { label: 'Cybersecurity', skills: ['ISO 27001', 'Access Management', 'Risk Assessment'] },
  ],
};

test('resume skills use the canonical reference taxonomy and ordering', () => {
  const groups = organizedResumeSkillGroups(profile, profile.skills);
  const byLabel = Object.fromEntries(groups.map((group) => [group.label, group.skills]));

  assert.deepEqual(groups.map((group) => group.label), [
    'Languages',
    'Enterprise & ERP',
    'Project Management',
    'Cloud',
    'Development Tools & API Platforms',
    'Data & AI',
    'Business Analysis',
    'Cybersecurity',
  ]);
  assert.deepEqual(byLabel.Languages, ['Python', 'TypeScript', 'JavaScript', 'SQL', 'R', 'MATLAB']);
  assert.deepEqual(byLabel['Enterprise & ERP'], ['Oracle Fusion ERP Cloud']);
  assert.deepEqual(byLabel['Project Management'], ['JIRA', 'Confluence']);
  assert.deepEqual(byLabel.Cloud, ['Oracle Cloud Infrastructure']);
  assert.deepEqual(byLabel['Development Tools & API Platforms'], ['Next.js', 'React', 'Node.js', 'REST APIs', 'Tailwind CSS', 'Angular', 'Zod', 'HTML5 Canvas', 'Responsive Web Design']);
  assert.deepEqual(byLabel['Data & AI'], ['PostgreSQL', 'Supabase', 'Machine Learning', 'Deep Learning', 'BERT', 'CLIP', 'HNSW', 'FAISS', 'Computer Vision', 'NLP']);
  assert.deepEqual(byLabel['Business Analysis'], ['Requirements Gathering', 'Process Mapping', 'Documentation']);
  assert.deepEqual(byLabel.Cybersecurity, ['ISO 27001', 'Access Management', 'Risk Assessment']);
  assert.ok(!groups.some((group) => /Additional|Role-Aligned|Full-Stack|Applied AI|Cloud, DevOps/i.test(group.label)));
});

test('organizer changes presentation only and never invents or drops selected skills', () => {
  const selected = ['Oracle Fusion ERP Cloud', 'Requirements Gathering', 'JIRA', 'ISO 27001', 'SQL', 'Next.js'];
  const flattened = organizedResumeSkillGroups(profile, selected).flatMap((group) => group.skills);
  assert.deepEqual(flattened.sort(), [...selected].sort());
});
