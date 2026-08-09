import test from 'node:test';
import assert from 'node:assert/strict';
import { isRetryableSupabaseStatus } from './supabase-rest';

test('retries transient Supabase statuses', () => {
  for (const status of [408, 425, 429, 500, 502, 503, 504]) {
    assert.equal(isRetryableSupabaseStatus(status), true, `${status} should retry`);
  }
});

test('does not retry ordinary client errors', () => {
  for (const status of [400, 401, 403, 404, 409, 422]) {
    assert.equal(isRetryableSupabaseStatus(status), false, `${status} should not retry`);
  }
});
