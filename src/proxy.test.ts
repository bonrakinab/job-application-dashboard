import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';

function withAuthEnv<T>(fn: () => T): T {
  const keys = ['DASHBOARD_PASSWORD', 'AUTH_SECRET', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY'] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.DASHBOARD_PASSWORD = 'test-password';
  process.env.AUTH_SECRET = 'test-auth-secret';
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'test-supabase-secret';
  try {
    return fn();
  } finally {
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('private API is rejected without a dashboard session', () => {
  withAuthEnv(() => {
    const response = proxy(new NextRequest('https://example.com/api/profile'));
    assert.equal(response.status, 401);
  });
});

test('private page redirects to login without a dashboard session', () => {
  withAuthEnv(() => {
    const response = proxy(new NextRequest('https://example.com/settings'));
    assert.equal(response.status, 307);
    assert.equal(response.headers.get('location'), 'https://example.com/login');
  });
});

test('health endpoint remains public', () => {
  withAuthEnv(() => {
    const response = proxy(new NextRequest('https://example.com/api/health'));
    assert.equal(response.status, 200);
  });
});
