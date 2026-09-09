import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

// Exercise the compiled route with the built-in demo profile and no external
// credentials. Unit tests cannot detect Next.js worker packaging failures.
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1' };
for (const key of Object.keys(env)) {
  if (/^(SUPABASE_|NEXT_PUBLIC_SUPABASE_|OPENAI_|GEMINI_|DASHBOARD_PASSWORD$|AUTH_SECRET$)/.test(key)) delete env[key];
}
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3197'], { env });
let logs = '';
const timeout = setTimeout(() => { child.kill(); }, 60000);
try {
  await new Promise((resolve, reject) => {
    child.stdout.on('data', (data) => {
      logs += data.toString();
      if (logs.includes('Ready')) resolve();
    });
    child.stderr.on('data', (data) => { logs += data.toString(); });
    child.once('error', reject);
    child.once('exit', (code) => reject(new Error(`Server exited (${code}): ${logs}`)));
  });
  const response = await fetch('http://127.0.0.1:3197/api/jobs/demo-1/application-pack', {
    method: 'POST', signal: AbortSignal.timeout(45000),
  });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  assert.equal(result.pack.claimVerification.status, 'pass');
  assert.equal(result.pack.artifactValidation.sectionOrderValid, true);
  assert.equal(result.pack.artifactValidation.pdfParseCoverage, 100);
  assert.equal(result.pack.artifactValidation.docxParseCoverage, 100);
  const trace = JSON.parse(await readFile('.next/server/app/api/jobs/[id]/application-pack/route.js.nft.json', 'utf8'));
  assert.ok(trace.files.some((file) => file.endsWith('pdf-parse/dist/pdf-parse/cjs/pdf.worker.mjs')), 'Deployment trace must include the PDF worker');
  console.log('Production application-pack route: HTTP 200; claim, PDF and DOCX checks passed; PDF worker traced.');
} finally {
  clearTimeout(timeout);
  child.kill();
}
