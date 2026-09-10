import assert from 'node:assert/strict';
import test from 'node:test';
import type { CandidateProfile } from './types';
import { externalApplicationProfile, isEmployerQualityProjectBullet, isExternalApplicationProject } from './application-visibility';

type Project = NonNullable<CandidateProfile['projects']>[number];

function profile(): CandidateProfile {
  return {
    name: 'Arnob Banik', targetTitles: ['Software Engineer'], preferredLocations: ['Canada'], skills: ['TypeScript', 'Next.js', 'React'],
    projects: [
      { name: 'Job Application Intelligence Dashboard', description: 'Internal job intelligence system.', bullets: ['Built job discovery and application preparation workflows.'], skills: ['TypeScript', 'Next.js'] },
      { name: 'Flowdesk - Full-Stack Family CRM', description: 'Family CRM.', bullets: ['Built production household workflows.'], skills: ['TypeScript', 'Next.js', 'React'] },
      { name: 'Private Prototype', description: 'Another internal-only project.', bullets: ['Private evidence.'], skills: ['TypeScript'], externalApplicationEligible: false } as Project & { externalApplicationEligible: boolean },
    ],
  };
}

test('legacy job dashboard name is always excluded from employer-facing profiles', () => {
  const source = profile();
  const filtered = externalApplicationProfile(source);
  assert.deepEqual(filtered.projects?.map((project) => project.name), ['Flowdesk - Full-Stack Family CRM']);
  assert.equal(source.projects?.length, 3, 'master profile must remain unchanged');
});

test('explicit externalApplicationEligible=false excludes any private project', () => {
  const source = profile();
  const privateProject = source.projects?.find((project) => project.name === 'Private Prototype');
  const flowdesk = source.projects?.find((project) => project.name.startsWith('Flowdesk'));
  assert.equal(privateProject ? isExternalApplicationProject(privateProject) : true, false);
  assert.equal(flowdesk ? isExternalApplicationProject(flowdesk) : false, true);
});

test('employer-facing profile drops imported project-card dumps but retains concise evidence', () => {
  const source = profile();
  source.projects!.push({
    name: 'ERP Tax Revamp',
    description: 'Enterprise ERP tax-engine revamp focused on maintainability.',
    bullets: [
      'Major challenges on Initial Configuration: Complex rules. Benefits of New Setup: Tax Conditions reduced to 450 from 15K.',
      'Revamped the ERP tax engine by consolidating approximately 15,000 tax conditions to about 450 and resolving PO/invoice tax-calculation issues.',
    ],
    skills: ['Oracle Fusion ERP'],
  });
  const filtered = externalApplicationProfile(source);
  const project = filtered.projects?.find((item) => item.name === 'ERP Tax Revamp');
  assert.deepEqual(project?.bullets, ['Revamped the ERP tax engine by consolidating approximately 15,000 tax conditions to about 450 and resolving PO/invoice tax-calculation issues.']);
  assert.equal(isEmployerQualityProjectBullet('Objective: Build a model. Technologies Used: Python. Dataset: Example.'), false);
});
