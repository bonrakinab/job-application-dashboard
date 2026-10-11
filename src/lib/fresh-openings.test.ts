import assert from 'node:assert/strict';
import test from 'node:test';
import { FRESH_OPENINGS_WINDOW_HOURS, freshOpenings, isFreshOpening, sourcePostingFreshness } from './fresh-openings';
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

test('recent openings are included by discovery time even when the source date is old or unverified', () => {
  const boundaryTime = new Date(now - FRESH_OPENINGS_WINDOW_HOURS * hour).toISOString();
  const boundary = job('boundary', boundaryTime, boundaryTime);
  const oldPosting = job('old-posting', new Date(now - hour).toISOString(), new Date(now - 25 * hour).toISOString());
  const oldDiscovery = job('old-discovery', new Date(now - 25 * hour).toISOString(), new Date(now - hour).toISOString());
  const unknownPosting = job('unknown-posting', new Date(now - hour).toISOString());

  assert.equal(isFreshOpening(boundary, now), true);
  assert.equal(isFreshOpening(oldPosting, now), true);
  assert.equal(isFreshOpening(oldDiscovery, now), false);
  assert.equal(isFreshOpening(unknownPosting, now), true);
  assert.equal(sourcePostingFreshness(boundary, now), 'verified-fresh');
  assert.equal(sourcePostingFreshness(oldPosting, now), 'older');
  assert.equal(sourcePostingFreshness(unknownPosting, now), 'unverified');
});

test('recent openings prioritize verified fresh posts, then retain older and unverified discoveries', () => {
  const newestPosted = job('newest-posted', new Date(now - hour).toISOString(), new Date(now - hour).toISOString());
  const newestDiscovered = job('newest-discovered', new Date(now - 10 * 60_000).toISOString(), new Date(now - 2 * hour).toISOString());
  const oldPosting = job('old-posting', new Date(now - 5 * 60_000).toISOString(), new Date(now - 25 * hour).toISOString());
  const unknownPosting = job('unknown-posting', new Date(now - 2 * 60_000).toISOString());
  const staleDiscovery = job('stale-discovery', new Date(now - 25 * hour).toISOString(), new Date(now - hour).toISOString());

  assert.deepEqual(
    freshOpenings([unknownPosting, oldPosting, newestDiscovered, staleDiscovery, newestPosted], now).map((item) => item.id),
    ['newest-posted', 'newest-discovered', 'unknown-posting', 'old-posting'],
  );
});
