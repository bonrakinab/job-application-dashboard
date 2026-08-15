import assert from 'node:assert/strict';
import test from 'node:test';
import { FRESH_OPENINGS_RETENTION_DAYS, freshOpenings, isFreshOpening } from './fresh-openings';
import type { JobWithMatch } from './types';

const now = Date.parse('2026-08-15T16:21:00Z');
const day = 24 * 60 * 60 * 1000;

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

test('fresh openings keeps discoveries for exactly 30 rolling days', () => {
  const boundary = job('boundary', new Date(now - FRESH_OPENINGS_RETENTION_DAYS * day).toISOString());
  const tooOld = job('old', new Date(now - FRESH_OPENINGS_RETENTION_DAYS * day - 1).toISOString());
  assert.equal(isFreshOpening(boundary, now), true);
  assert.equal(isFreshOpening(tooOld, now), false);
});

test('fresh openings automatically drops old jobs and sorts newest discovery first', () => {
  const newest = job('newest', new Date(now - day).toISOString(), '2026-08-14T12:00:00Z');
  const older = job('older', new Date(now - 12 * day).toISOString(), '2026-08-01T12:00:00Z');
  const expired = job('expired', new Date(now - 31 * day).toISOString(), '2026-07-01T12:00:00Z');
  assert.deepEqual(freshOpenings([older, expired, newest], now).map((item) => item.id), ['newest', 'older']);
});
