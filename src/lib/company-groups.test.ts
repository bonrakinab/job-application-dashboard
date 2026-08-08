import assert from 'node:assert/strict';
import test from 'node:test';
import { companyGroupIds } from './company-groups';

test('Amazon belongs to overlapping prestige groups', () => {
  const groups = companyGroupIds('Amazon');
  assert.ok(groups.includes('mang'));
  assert.ok(groups.includes('faang-maang'));
  assert.ok(groups.includes('magnificent-seven'));
  assert.ok(groups.includes('fortune-5-2026'));
});

test('Microsoft is big tech and enterprise cloud but not FAANG', () => {
  const groups = companyGroupIds('Microsoft');
  assert.ok(groups.includes('magnificent-seven'));
  assert.ok(groups.includes('enterprise-cloud'));
  assert.equal(groups.includes('faang-maang'), false);
});

test('Deloitte is Big Four and consulting', () => {
  const groups = companyGroupIds('Deloitte');
  assert.ok(groups.includes('big-four'));
  assert.ok(groups.includes('consulting-advisory'));
});

test('Capgemini is classified as a global IT service company', () => {
  assert.ok(companyGroupIds('Capgemini').includes('global-it-services'));
});

test('Google represents Alphabet in the 2026 Fortune 5 group', () => {
  assert.ok(companyGroupIds('Google').includes('fortune-5-2026'));
});
