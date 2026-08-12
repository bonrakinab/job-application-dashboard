import assert from 'node:assert/strict';
import test from 'node:test';
import { locationMatchesPreference } from './scoring';
import type { CandidateProfile, Job } from './types';

const profile: CandidateProfile = {
  name: 'Test',
  targetTitles: ['Software Engineer'],
  preferredLocations: ['Windsor', 'Ontario', 'Remote Canada', 'Canada'],
  skills: [],
};

function job(location: string): Job {
  return {
    externalId: location,
    source: 'test',
    sourceKey: 'test',
    url: 'https://example.com',
    title: 'Software Engineer',
    company: 'Example',
    location,
    description: '',
    remote: true,
  };
}

test('accepts WWR global and Canada-compatible regions', () => {
  assert.equal(locationMatchesPreference(job('Anywhere in the World'), profile), true);
  assert.equal(locationMatchesPreference(job('Canada Only'), profile), true);
  assert.equal(locationMatchesPreference(job('North America Only'), profile), true);
  assert.equal(locationMatchesPreference(job('Americas Only'), profile), true);
});

test('does not treat USA-only as Canada-compatible', () => {
  assert.equal(locationMatchesPreference(job('USA Only'), profile), false);
});
