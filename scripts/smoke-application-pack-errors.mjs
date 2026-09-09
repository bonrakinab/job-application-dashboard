import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';

// An isolated fake database rejects the initial job lookup. No real credentials
// or external requests: prove early errors cross the production JSON boundary.
const database = createServer((_, response) => {
  response.writeHead(401, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ message: 'Test database unavailable' }));
});
await new Promise(resolve => database.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1' };
for (const key of Object.keys(env)) {
  if (/^(SUPABASE_|NEXT_PUBLIC_SUPABASE_|OPENAI_|GEMINI_|DASHBOARD_PASSWORD$|AUTH_SECRET$)/.test(key)) delete env[key];
}
Object.assign(env, {
  SUPABASE_URL: `http://127.0.0.1:${database.address().port}`,
  SUPABASE_SECRET_KEY: 'test-only-key', DASHBOARD_PASSWORD: 'test-only-password', AUTH_SECRET: 'test-only-secret',
});
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3198'], { env });
let logs = '';
const timeout = setTimeout(() => child.kill(), 60000);
try {
  await new Promise((resolve, reject) => {
    child.stdout.on('data', data => { logs += data; if (logs.includes('Ready')) resolve(); });
    child.stderr.on('data', data => { logs += data; });
    child.once('error', reject);
    child.once('exit', code => reject(new Error(`Server exited (${code}): ${logs}`)));
  });
  const cookie = createHmac('sha256', env.AUTH_SECRET).update(`job-agent:${env.DASHBOARD_PASSWORD}`).digest('hex');
  const response = await fetch('http://127.0.0.1:3198/api/jobs/test-job/application-pack', {
    method: 'POST', headers: { Cookie: `job_agent_session=${cookie}` }, signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, 500);
  assert.match(response.headers.get('content-type'), /application\/json/);
  const result = await response.json();
  assert.equal(result.code, 'APPLICATION_PACK_FAILED');
  assert.match(result.error, /Test database unavailable/);
  console.log('Production early-failure route: structured HTTP 500; original error preserved.');
} finally {
  clearTimeout(timeout);
  child.kill();
  database.close();
}
