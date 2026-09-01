import test from 'node:test';
import assert from 'node:assert/strict';
import { isRetryableSupabaseStatus, supabaseAuthHeaders } from './supabase-rest';

test('uses new Supabase secret keys only as API keys', () => {
  assert.deepEqual(supabaseAuthHeaders('sb_secret_test'), {
    apikey: 'sb_secret_test',
  });
});

test('keeps Bearer authorization for legacy JWT service-role keys', () => {
  assert.deepEqual(supabaseAuthHeaders('header.payload.signature'), {
    apikey: 'header.payload.signature',
    Authorization: 'Bearer header.payload.signature',
  });
});

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
