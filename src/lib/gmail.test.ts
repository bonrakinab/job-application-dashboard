import assert from 'node:assert/strict';
import test from 'node:test';
import { gmailConfigStatus } from './gmail';

function env(values: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return { NODE_ENV: 'test', ...values } as NodeJS.ProcessEnv;
}

test('Gmail OAuth does not require a digest recipient', () => {
  const status = gmailConfigStatus(env({
    GOOGLE_CLIENT_ID: 'client-id',
    GOOGLE_CLIENT_SECRET: 'client-secret',
    GOOGLE_REFRESH_TOKEN: 'refresh-token',
  }));

  assert.equal(status.oauth, true);
  assert.equal(status.digest, false);
  assert.equal(status.digestTo, false);
});

test('Gmail digest requires OAuth and a recipient', () => {
  const status = gmailConfigStatus(env({
    GOOGLE_CLIENT_ID: 'client-id',
    GOOGLE_CLIENT_SECRET: 'client-secret',
    GOOGLE_REFRESH_TOKEN: 'refresh-token',
    GMAIL_DIGEST_TO: 'candidate@example.com',
  }));

  assert.equal(status.oauth, true);
  assert.equal(status.digest, true);
});

test('missing refresh token leaves Gmail OAuth unconfigured', () => {
  const status = gmailConfigStatus(env({
    GOOGLE_CLIENT_ID: 'client-id',
    GOOGLE_CLIENT_SECRET: 'client-secret',
    GMAIL_DIGEST_TO: 'candidate@example.com',
  }));

  assert.equal(status.oauth, false);
  assert.equal(status.refreshToken, false);
  assert.equal(status.digest, false);
});
