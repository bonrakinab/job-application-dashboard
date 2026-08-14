import assert from 'node:assert/strict';
import test from 'node:test';
import { applicationLabel, hasApplied, matchesApplicationFilter } from './application-state';

test('clearly distinguishes applied from pre-application stages', () => {
  assert.equal(hasApplied(undefined), false);
  assert.equal(hasApplied({ status: 'reviewing' }), false);
  assert.equal(hasApplied({ status: 'approved' }), false);
  assert.equal(hasApplied({ status: 'applied' }), true);
  assert.equal(hasApplied({ status: 'interview' }), true);
  assert.equal(hasApplied({ status: 'offer' }), true);
});

test('application labels make applied state explicit', () => {
  assert.equal(applicationLabel(undefined), 'Not applied');
  assert.equal(applicationLabel({ status: 'approved' }), 'Not applied · Ready');
  assert.equal(applicationLabel({ status: 'applied' }), '✓ Applied');
  assert.equal(applicationLabel({ status: 'interview' }), '✓ Applied · Interview');
});

test('application filter separates applied and not-applied jobs', () => {
  assert.equal(matchesApplicationFilter({ status: 'applied' }, 'applied'), true);
  assert.equal(matchesApplicationFilter({ status: 'reviewing' }, 'applied'), false);
  assert.equal(matchesApplicationFilter(undefined, 'not-applied'), true);
});
