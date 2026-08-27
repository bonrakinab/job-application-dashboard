import assert from 'node:assert/strict';
import test from 'node:test';
import { externalApplicationProfile } from './application-visibility';
import { selectApplicationSupplements } from './application-supplements';
import { curateCandidateProfile, resumeEducation } from './profile-curation';
import type { CandidateProfile, Job } from './types';

function importedProfile(): CandidateProfile {
  return {
    name: 'Arnob Banik',
    targetTitles: ['Software Engineer'],
    preferredLocations: ['Ontario'],
    skills: [
      'Python', 'Python (Programming Language)', 'Amazon Web Services (AWS)', 'AWS', 'Communication',
      'RFID Antennas', 'TypeScript', 'Oracle Fusion Applications (OFA)', 'Oracle Fusion ERP Cloud',
    ],
    experience: [
      { organization: 'Banglalink', title: 'Enterprise Solutions and Services Specialist Engineer, IT', start: 'Sept 2023', end: 'June 2024', location: 'Dhaka, Bangladesh', bullets: ['Verified ERP achievement.'], skills: ['Oracle Fusion ERP Cloud'] },
      { organization: 'banglalink', title: 'Enterprise Solutions and Services Specialist Engineer', start: 'Sep 2023', end: 'Jun 2024', location: 'Tigers Den, Dhaka 1212, Bangladesh', bullets: ['A very long LinkedIn duplicate responsibility that should not replace the verified resume evidence.'], skills: [] },
      { organization: 'University of Windsor', title: 'Graduate Assistant', start: 'May 2025', end: 'Aug 2025', location: '401 Sunset Ave, Windsor, ON N9B 3P4', bullets: ['Supported Operating System Fundamentals.'] },
      { organization: 'Student Club', title: 'Head of Finance', bullets: [`Managed finances. ${'Prepared budgets and sponsorship documentation. '.repeat(30)}`] },
    ],
    degrees: [
      { institution: 'University of Windsor', degree: 'Master of Science in Computer Science', field: 'AI Specialization', end: 'Aug 2026 (Expected)' },
      { institution: 'University of Windsor', degree: 'Master of Science - MS', end: 'Aug 2026' },
      { institution: 'Vellore Institute of Technology', degree: 'Bachelor of Technology', field: 'Computer Science' },
      { institution: 'Vellore Institute of Technology', degree: 'Bachelor of Technology - BTech' },
      { institution: 'School', degree: 'O-Levels and A-Levels' },
    ],
    projects: [
      { name: 'Student Dropout Analysis and Prediction', description: 'Machine learning analysis', bullets: ['Verified project bullet.'], skills: ['Python'] },
      { name: 'Student Dropout Analysis and Prediction Using Machine Learning Algorithms', description: 'Raw LinkedIn duplicate', bullets: ['Raw duplicate project bullet.'] },
      { name: 'Smart Parking Application', description: 'Web application using HTML, CSS, SQL and PHP.', bullets: ['Built a smart parking web application.'] },
    ],
    certifications: [
      'AWS Academy Graduate - AWS Academy Cloud Foundations',
      'AWS Academy Graduate - AWS Academy Cloud Foundations · Amazon Web Services (AWS)',
      'Oracle Cloud Infrastructure 2023 Certified Data Science Professional',
    ],
    publications: ['AI Based Cloud Failure Detection and Prevention Algorithm · IEEE'],
    links: { github: 'https://github.com/example', linkedinWebsite: 'https://github.com/example/' },
    profileSources: { linkedin: { importedAt: '2026-08-27T15:27:25Z', sourceFiles: ['Profile.csv'], summary: 'Raw and outdated LinkedIn prose.', added: { skills: 1, experience: 1, education: 1, projects: 1, certifications: 1, languages: 0, courses: 0, awards: 0, publications: 0 } } },
  };
}

test('profile curation merges LinkedIn variants and removes noisy aliases without losing useful evidence', () => {
  const curated = curateCandidateProfile(importedProfile());
  assert.deepEqual(curated.skills, ['Python', 'AWS', 'TypeScript', 'Oracle Fusion ERP Cloud']);
  assert.equal(curated.experience?.length, 3);
  assert.equal(curated.experience?.[0].bullets[0], 'Verified ERP achievement.');
  assert.equal(curated.experience?.[1].location, 'Windsor, Ontario, Canada');
  assert.ok((curated.experience?.[2].bullets[0].length ?? 999) <= 360);
  assert.equal(curated.degrees?.length, 3);
  assert.equal(curated.projects?.length, 2);
  assert.ok(curated.projects?.find((project) => project.name === 'Smart Parking Application')?.skills?.includes('PHP'));
  assert.equal(curated.certifications?.length, 2);
  assert.deepEqual(curated.links, { github: 'https://github.com/example' });
});

test('employer-facing profile excludes raw LinkedIn prose and limits resume education to post-secondary degrees', () => {
  const safe = externalApplicationProfile(importedProfile());
  assert.equal(safe.profileSources, undefined);
  assert.equal(resumeEducation(safe).length, 2);
  assert.ok(resumeEducation(safe).every((degree) => !/o-level/i.test(degree.degree)));
});

test('supplement selection uses only role-relevant credentials and publications', () => {
  const profile = curateCandidateProfile(importedProfile());
  const cloudJob: Job = { externalId: '1', source: 'test', sourceKey: 'test', url: 'https://example.com', title: 'Cloud AI Engineer', company: 'Example', description: 'Build cloud machine learning systems on AWS and investigate failure prevention.' };
  const selected = selectApplicationSupplements(cloudJob, profile);
  assert.ok(selected.certifications.some((item) => /AWS Academy/.test(item)));
  assert.ok(selected.certifications.some((item) => /Data Science Professional/.test(item)));
  assert.equal(selected.publications.length, 1);
});
