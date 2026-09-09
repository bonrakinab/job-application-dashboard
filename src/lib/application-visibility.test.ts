import assert from 'node:assert/strict';
import test from 'node:test';
import type { CandidateProfile } from './types';
import { externalApplicationProfile, isExternalApplicationProject } from './application-visibility';

type Project = NonNullable<CandidateProfile['projects']>[number];

function profile(): CandidateProfile {
  return {
    name: 'Arnob Banik',
    targetTitles: ['Software Engineer'],
    preferredLocations: ['Canada'],
    skills: ['TypeScript', 'Next.js', 'React'],
    projects: [
      {
        name: 'Job Application Intelligence Dashboard',
        description: 'Internal job intelligence system.',
        bullets: ['Built job discovery and application preparation workflows.'],
        skills: ['TypeScript', 'Next.js'],
      },
      {
        name: 'Flowdesk - Full-Stack Family CRM',
        description: 'Family CRM.',
        bullets: ['Built production household workflows.'],
        skills: ['TypeScript', 'Next.js', 'React'],
      },
      {
        name: 'Private Prototype',
        description: 'Another internal-only project.',
        bullets: ['Private evidence.'],
        skills: ['TypeScript'],
        externalApplicationEligible: false,
      } as Project & { externalApplicationEligible: boolean },
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

test('genuine additional employment stays available for job-specific ranking while volunteer roles stay excluded', () => {
  const source: CandidateProfile = {
    ...profile(),
    experience: [
      { organization: 'Banglalink', title: 'Enterprise Solutions and Services Specialist Engineer, IT', bullets: ['Supported Oracle Fusion enterprise systems and financial workflows.'] },
      { organization: 'Banglalink', title: 'Information Technology Intern', bullets: ['Supported ERP documentation and enterprise system configuration.'] },
      { organization: 'GAOTek Inc.', title: 'Software Development Intern - Team Leader', bullets: ['Built Angular components and reviewed software defects with the team.'] },
      { organization: 'University of Windsor', title: 'Graduate Assistant', bullets: ['Supported students with technical coursework and laboratory activities.'] },
      { organization: 'Aobhan', title: 'Volunteer', bullets: ['Volunteered in community activities and event coordination.'] },
    ],
  };
  const filtered = externalApplicationProfile(source);
  assert.ok(filtered.experience?.some((item) => item.title === 'Graduate Assistant'));
  assert.ok(!filtered.experience?.some((item) => item.title === 'Volunteer'));
});
