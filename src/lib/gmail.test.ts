import assert from 'node:assert/strict';
import test from 'node:test';
import { gmailConfigStatus, preferredGmailRefreshToken } from './gmail';

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

test('dashboard-stored Gmail token overrides an environment fallback', () => {
  assert.equal(preferredGmailRefreshToken('new-dashboard-token', 'stale-env-token'), 'new-dashboard-token');
  assert.equal(preferredGmailRefreshToken(null, 'env-token'), 'env-token');
  assert.equal(preferredGmailRefreshToken('  ', 'env-token'), 'env-token');
});


test('Gmail reconnect requests message access needed to deduplicate alerts', async () => {
  const { googleAuthorizationUrl } = await import('./google-oauth');
  const previous = { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, auth: process.env.AUTH_SECRET };
  try {
    process.env.GOOGLE_CLIENT_ID = 'test-client';
    process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
    process.env.AUTH_SECRET = 'test-auth';
    const url = new URL(googleAuthorizationUrl(new Request('https://example.com/api/auth/google/start')));
    const scopes = url.searchParams.get('scope')!.split(' ');
    assert.ok(scopes.includes('https://www.googleapis.com/auth/gmail.compose'));
    assert.ok(scopes.includes('https://www.googleapis.com/auth/gmail.readonly'));
    assert.ok(!scopes.includes('https://mail.google.com/'));
    assert.equal(url.searchParams.get('access_type'), 'offline');
    assert.equal(url.searchParams.get('prompt'), 'consent');
  } finally {
    for (const [key, value] of Object.entries({ GOOGLE_CLIENT_ID: previous.clientId, GOOGLE_CLIENT_SECRET: previous.clientSecret, AUTH_SECRET: previous.auth })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});


test('Gmail health rejects compose-only access that cannot read Sent for deduplication', async () => {
  const { validateGoogleAccessToken } = await import('./google-oauth');
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input); calls.push(url);
    return new Response('{}', { status: url.includes('/messages?') ? 403 : 200 });
  };
  try {
    await assert.rejects(validateGoogleAccessToken('test-access'), /messages authorization 403/);
    assert.equal(calls.length, 2);
  } finally { globalThis.fetch = original; }
});
