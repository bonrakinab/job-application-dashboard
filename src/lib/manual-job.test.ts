import test from 'node:test';
import assert from 'node:assert/strict';
import { buildManualJob, ManualJobInputError } from './manual-job';

const description = `We are hiring a Junior Software Developer to build reliable web applications.
The successful candidate will work with TypeScript, React, APIs, SQL databases, automated tests, and cloud deployment practices while collaborating with product and engineering teams.`;

test('builds a stable manual job that can use the existing application-pack pipeline', () => {
  const first = buildManualJob({
    title: 'Junior Software Developer',
    company: 'Example Company',
    location: 'Windsor, Ontario',
    url: 'jobs.example.com/123',
    description,
  }, '2026-09-01T04:00:00.000Z');
  const second = buildManualJob({
    title: 'Junior Software Developer',
    company: 'Example Company',
    description,
  }, '2026-09-01T05:00:00.000Z');

  assert.equal(first.id, second.id);
  assert.equal(first.source, 'manual');
  assert.equal(first.url, 'https://jobs.example.com/123');
  assert.equal(first.validityStatus, 'unknown');
  assert.equal((first.raw as { manualEntry: boolean }).manualEntry, true);
});

test('allows a manual job without an external application link', () => {
  const job = buildManualJob({
    title: 'Data Analyst',
    company: 'Example Company',
    description,
  });

  assert.equal(job.url, '#');
  assert.equal(job.applyUrl, undefined);
});

test('rejects sparse descriptions and unsafe links', () => {
  assert.throws(() => buildManualJob({
    title: 'Developer',
    company: 'Example Company',
    description: 'React developer needed.',
  }), ManualJobInputError);
  assert.throws(() => buildManualJob({
    title: 'Developer',
    company: 'Example Company',
    description,
    url: 'javascript:alert(1)',
  }), ManualJobInputError);
});
