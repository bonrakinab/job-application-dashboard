import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeHimalayasItem } from './himalayas';

test('normalizes Himalayas epoch seconds and string location restrictions', () => {
  const job = normalizeHimalayasItem({
    guid: 'https://himalayas.app/jobs/example-1',
    title: 'Machine Learning Engineer',
    companyName: 'Example AI',
    companySlug: 'example-ai',
    applicationLink: 'https://himalayas.app/jobs/example-1',
    locationRestrictions: ['Canada'],
    categories: ['Machine Learning', 'Engineering'],
    pubDate: 1786478558,
    description: '<p>Build ML systems.</p>',
  });

  assert.ok(job);
  assert.equal(job.location, 'Canada');
  assert.equal(job.company, 'Example AI');
  assert.equal(job.department, 'Machine Learning, Engineering');
  assert.equal(job.description, 'Build ML systems.');
  assert.equal(job.postedAt, '2026-08-11T20:02:38.000Z');
});

test('supports object location restrictions and falls back from placeholder company names', () => {
  const job = normalizeHimalayasItem({
    guid: 'https://himalayas.app/jobs/example-2',
    title: 'Data Analyst',
    companyName: 'name',
    companySlug: 'north-star-data',
    applicationLink: 'https://himalayas.app/jobs/example-2',
    locationRestrictions: [{ alpha2: 'CA', name: 'Canada', slug: 'canada' }],
    pubDate: '2026-08-11T10:00:00Z',
  });

  assert.ok(job);
  assert.equal(job.company, 'North Star Data');
  assert.equal(job.location, 'Canada');
  assert.equal(job.postedAt, '2026-08-11T10:00:00.000Z');
});
