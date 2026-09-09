import test from 'node:test';
import assert from 'node:assert/strict';
import { readApiResponse } from './api-response';

test('empty and non-JSON failures preserve status without exposing HTML', async () => {
  await assert.rejects(readApiResponse(new Response('', { status: 500 }), 'Generation'), /empty response.*HTTP 500/);
  await assert.rejects(readApiResponse(new Response('<html>private proxy details</html>', { status: 504 }), 'Generation'), /server timed out.*HTTP 504/);
  await assert.rejects(readApiResponse(new Response('', { status: 401 }), 'Generation'), /Sign in again.*HTTP 401/);
});

test('malformed success is rejected and server validation errors survive', async () => {
  for (const body of ['', '{"pack":', 'null', '[]']) {
    await assert.rejects(readApiResponse(new Response(body), 'Generation'), /HTTP 200/);
  }
  await assert.rejects(readApiResponse(Response.json({ error: 'Upload your résumé first.' }, { status: 409 }), 'Generation'), /^Error: Upload your résumé first\.$/);
  assert.deepEqual(await readApiResponse(Response.json({ pack: { ready: true } }), 'Generation'), { pack: { ready: true } });
});
