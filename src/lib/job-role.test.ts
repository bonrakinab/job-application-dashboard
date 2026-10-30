import assert from 'node:assert/strict';
import test from 'node:test';
import { jobMatchesRole, matchingJobRoles } from './job-role';

const base = {
  title: 'Software Engineer',
  description: '',
  department: '',
};

test('matches core technical role families', () => {
  assert.equal(jobMatchesRole({ ...base, title: 'Software Engineer II' }, 'software-engineering'), true);
  assert.equal(jobMatchesRole({ ...base, title: 'Machine Learning Engineer' }, 'ai-ml'), true);
  assert.equal(jobMatchesRole({ ...base, title: 'Data Analyst' }, 'data-analytics'), true);
  assert.equal(jobMatchesRole({ ...base, title: 'IT Support Specialist' }, 'it-support'), true);
  assert.equal(jobMatchesRole({ ...base, title: 'DevOps Engineer' }, 'cloud-devops'), true);
  assert.equal(jobMatchesRole({ ...base, title: 'Oracle Fusion ERP Analyst' }, 'erp-enterprise'), true);
  assert.equal(jobMatchesRole({ ...base, title: 'Security Analyst' }, 'cybersecurity'), true);
  assert.equal(jobMatchesRole({ ...base, title: 'QA Automation Engineer' }, 'qa-testing'), true);
});

test('analyst filter intentionally overlaps specialized families', () => {
  const job = { ...base, title: 'Data Analyst' };
  assert.equal(jobMatchesRole(job, 'analyst'), true);
  assert.equal(jobMatchesRole(job, 'data-analytics'), true);
  assert.deepEqual(matchingJobRoles(job), ['Analyst', 'Data & Analytics']);
});

test('matches clerical and transcription roles', () => {
  assert.equal(jobMatchesRole({ ...base, title: 'Unit Clerk II' }, 'clerical-transcription'), true);
  assert.equal(jobMatchesRole({ ...base, title: 'Medical Transcriptionist' }, 'clerical-transcription'), true);
  assert.equal(jobMatchesRole({ ...base, title: 'Data Entry Clerk - Finance' }, 'clerical-transcription'), true);
});

test('other only matches uncategorized roles', () => {
  assert.equal(jobMatchesRole({ ...base, title: 'Operations Coordinator' }, 'other'), true);
  assert.equal(jobMatchesRole({ ...base, title: 'Business Analyst' }, 'other'), false);
});
