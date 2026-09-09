import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, mkdir, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// A full checkout conceals missing serverless dependencies. Copy ONLY traced
// package files outside the repository so Node cannot resolve local extras.
const tracePath = path.resolve('.next/server/app/api/jobs/[id]/application-pack/route.js.nft.json');
const trace = JSON.parse(await readFile(tracePath, 'utf8'));
const staging = await mkdtemp(path.join(tmpdir(), 'pdf-deployment-'));
try {
  assert.ok(trace.files.some(file => /@napi-rs\/canvas\/index\.js$/.test(file)), 'Canvas JS must be traced');
  assert.ok(trace.files.some(file => /@napi-rs\/canvas-[^/]+\/.*\.node$/.test(file)), 'Canvas native binding must be traced');
  for (const file of trace.files) {
    const source = path.resolve(path.dirname(tracePath), file);
    const relative = path.relative(process.cwd(), source);
    if (!relative.startsWith('node_modules/')) continue;
    const target = path.join(staging, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(source, target);
  }
  const stream = 'BT /F1 12 Tf 50 750 Td (Deployment parser check) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  await writeFile(path.join(staging, 'probe.mjs'), `
    import assert from 'node:assert/strict';
    import { PDFParse } from 'pdf-parse';
    const parser = new PDFParse({ data: new Uint8Array(Buffer.from(${JSON.stringify(pdf)})) });
    try {
      const result = await parser.getText();
      assert.equal(result.total, 1);
      assert.match(result.text, /Deployment parser check/);
      console.log('Isolated deployment PDF parser: import, native canvas, worker and text extraction passed.');
    } finally { await parser.destroy(); }
  `);
  const result = spawnSync(process.execPath, [path.join(staging, 'probe.mjs')], {
    cwd: staging, encoding: 'utf8', timeout: 30000, env: { ...process.env, NODE_PATH: '' },
  });
  assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stderr}\n${result.stdout}`);
  console.log(result.stdout.trim());
} finally {
  await rm(staging, { recursive: true, force: true });
}
