import assert from 'node:assert/strict';
import test from 'node:test';
import { FRESH_OPENINGS_WINDOW_HOURS, freshOpenings, isFreshOpening } from './fresh-openings';
import type { JobWithMatch } from './types';

const now = Date.parse('2026-08-15T16:21:00Z');
const hour = 60 * 60 * 1000;

function job(id: string, discoveredAt: string, postedAt?: string): JobWithMatch {
  return {
    id,
    externalId: id,
    source: 'test',
    sourceKey: 'test',
    url: `https://example.com/${id}`,
    title: `Role ${id}`,
    company: 'Example',
    description: 'Example job description.',
    discoveredAt,
    postedAt,
  };
}

test('fresh openings requires both discovery and source posting times within 24 hours', () => {
  const boundaryTime = new Date(now - FRESH_OPENINGS_WINDOW_HOURS * hour).toISOString();
  const boundary = job('boundary', boundaryTime, boundaryTime);
  const oldPosting = job('old-posting', new Date(now - hour).toISOString(), new Date(now - 25 * hour).toISOString());
  const oldDiscovery = job('old-discovery', new Date(now - 25 * hour).toISOString(), new Date(now - hour).toISOString());
  const unknownPosting = job('unknown-posting', new Date(now - hour).toISOString());

  assert.equal(isFreshOpening(boundary, now), true);
  assert.equal(isFreshOpening(oldPosting, now), false);
  assert.equal(isFreshOpening(oldDiscovery, now), false);
  assert.equal(isFreshOpening(unknownPosting, now), false);
});

test('fresh openings drops stale jobs and sorts by source posting time', () => {
  const newestPosted = job('newest-posted', new Date(now - hour).toISOString(), new Date(now - hour).toISOString());
  const newestDiscovered = job('newest-discovered', new Date(now - 10 * 60_000).toISOString(), new Date(now - 2 * hour).toISOString());
  const stale = job('stale', new Date(now - hour).toISOString(), new Date(now - 25 * hour).toISOString());

  assert.deepEqual(freshOpenings([newestDiscovered, stale, newestPosted], now).map((item) => item.id), ['newest-posted', 'newest-discovered']);
});
