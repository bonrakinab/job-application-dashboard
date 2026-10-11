import assert from 'node:assert/strict';
import test from 'node:test';
import { googleOAuthCallbackUrl } from './google-oauth';

test('Google OAuth uses the configured canonical callback URL', () => {
  const previous = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  process.env.GOOGLE_OAUTH_REDIRECT_URI = 'https://jobagent-banik.vercel.app/api/auth/google/callback';
  try {
    assert.equal(
      googleOAuthCallbackUrl(new Request('https://preview.example.com/api/auth/google/start')),
      'https://jobagent-banik.vercel.app/api/auth/google/callback',
    );
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_OAUTH_REDIRECT_URI;
    else process.env.GOOGLE_OAUTH_REDIRECT_URI = previous;
  }
});

test('Google OAuth falls back to the request origin when no canonical callback is configured', () => {
  const previous = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  delete process.env.GOOGLE_OAUTH_REDIRECT_URI;
  try {
    assert.equal(
      googleOAuthCallbackUrl(new Request('https://example.vercel.app/api/auth/google/start')),
      'https://example.vercel.app/api/auth/google/callback',
    );
  } finally {
    if (previous !== undefined) process.env.GOOGLE_OAUTH_REDIRECT_URI = previous;
  }
});
