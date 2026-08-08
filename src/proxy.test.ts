import assert from 'node:assert/strict';
import test from 'node:test';
import { unstable_doesProxyMatch } from 'next/experimental/testing/server';
import { config } from './proxy';

test('proxy matcher protects private API routes', () => {
  assert.equal(unstable_doesProxyMatch({ config, nextConfig: {}, url: '/api/profile' }), true);
  assert.equal(unstable_doesProxyMatch({ config, nextConfig: {}, url: '/settings' }), true);
  assert.equal(unstable_doesProxyMatch({ config, nextConfig: {}, url: '/_next/static/chunk.js' }), false);
});
