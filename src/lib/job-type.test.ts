import assert from 'node:assert/strict';
import test from 'node:test';
import { jobMatchesType, jobTypeLabels } from './job-type';

const base = {
  externalId: '1',
  source: 'test',
  sourceKey: 'test',
  url: 'https://example.com',
  title: 'Systems Analyst',
  company: 'Example',
  description: '',
};

test('matches employment types', () => {
  assert.equal(jobMatchesType({ ...base, employmentType: 'Full-time' }, 'full-time'), true);
  assert.equal(jobMatchesType({ ...base, employmentType: 'Part Time' }, 'part-time'), true);
  assert.equal(jobMatchesType({ ...base, employmentType: '12 month contract' }, 'contract'), true);
});

test('matches remote and hybrid workplace types', () => {
  assert.equal(jobMatchesType({ ...base, remote: true }, 'remote'), true);
  assert.equal(jobMatchesType({ ...base, workplaceType: 'Hybrid' }, 'hybrid'), true);
  assert.equal(jobMatchesType({ ...base, location: 'Remote - Canada' }, 'remote'), true);
});

test('matches explicit on-site and structured non-remote jobs', () => {
  assert.equal(jobMatchesType({ ...base, workplaceType: 'On-site' }, 'on-site'), true);
  assert.equal(jobMatchesType({ ...base, workplaceType: 'In office' }, 'on-site'), true);
  assert.equal(jobMatchesType({ ...base, remote: false, location: 'Toronto, ON' }, 'on-site'), true);
  assert.equal(jobMatchesType({ ...base, remote: false, workplaceType: 'Hybrid' }, 'on-site'), false);
  assert.equal(jobMatchesType({ ...base, remote: true }, 'on-site'), false);
});

test('returns multiple useful labels', () => {
  assert.deepEqual(jobTypeLabels({ ...base, employmentType: 'Full-time', workplaceType: 'Hybrid' }), ['Full-time', 'Hybrid']);
  assert.deepEqual(jobTypeLabels({ ...base, employmentType: 'Full-time', workplaceType: 'On-site' }), ['Full-time', 'On-site']);
});
