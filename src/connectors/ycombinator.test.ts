import assert from 'node:assert/strict';
import test from 'node:test';
import { extractYcPageProps, normalizeYcListing, ycLocationAcceptsOntario, ycRoleLooksRelevant } from './ycombinator';

test('extracts official YC embedded page data', () => {
  const page = JSON.stringify({ component: 'WaasJobListingsPage', props: { jobPostings: [{ id: 42, title: 'Software Engineer' }] } })
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');
  const props = extractYcPageProps(`<div id="yc" data-page="${page}"></div>`, 'WaasJobListingsPage');
  assert.deepEqual(props.jobPostings, [{ id: 42, title: 'Software Engineer' }]);
});

test('keeps technical YC roles and rejects broad finance or recruiting matches', () => {
  assert.equal(ycRoleLooksRelevant('Software Engineer, Backend (Co-op)'), true);
  assert.equal(ycRoleLooksRelevant('IT Systems Analyst'), true);
  assert.equal(ycRoleLooksRelevant('Senior FP&A Analyst – Finance Business Partner'), false);
  assert.equal(ycRoleLooksRelevant('Head of Talent'), false);
});

test('accepts Ontario and Canada-remote YC locations but rejects US-only remote roles', () => {
  assert.equal(ycLocationAcceptsOntario('Toronto, ON, CA'), true);
  assert.equal(ycLocationAcceptsOntario('CA / Remote (CA)'), true);
  assert.equal(ycLocationAcceptsOntario('Remote (US)'), false);
  assert.equal(ycLocationAcceptsOntario('San Francisco, CA, US / Remote'), false);
  assert.equal(ycLocationAcceptsOntario('US / CA / Remote (US; CA)'), true);
  assert.equal(ycLocationAcceptsOntario('Vancouver, BC, CA'), false);
});

test('normalizes YC metadata and relative posting age', () => {
  const job = normalizeYcListing({
    id: 107231, title: 'Product Engineer (AI / Full-Stack)', url: '/companies/great-question/jobs/example',
    applyUrl: 'https://www.workatastartup.com/application?signup_job_id=107231', location: 'CA / Remote (CA)',
    type: 'Full-time', prettyRole: 'Engineering', roleSpecificType: 'Full stack', salaryRange: '$150K - $180K CAD',
    minExperience: '6+ years', visa: 'US citizen/visa only', companyName: 'Great Question', companyBatchName: 'W21',
    companyOneLiner: 'User research on autopilot.', createdAt: '7 days', description: '<p>Build an agent-first product end to end.</p>',
  }, { slug: 'great-question', batch_name: 'W21', tags: ['SaaS', 'B2B'], ycdc_status: 'Active', team_size: 20 }, new Date('2026-09-08T12:00:00Z'));

  assert.ok(job);
  assert.equal(job.source, 'ycombinator');
  assert.equal(job.postedAt, '2026-09-01T12:00:00.000Z');
  assert.equal(job.salaryMin, 150_000);
  assert.equal(job.salaryMax, 180_000);
  assert.equal(job.currency, 'CAD');
  assert.equal(job.description, 'Build an agent-first product end to end.');
  assert.equal(job.yc?.batch, 'W21');
  assert.deepEqual(job.yc?.industryTags, ['SaaS', 'B2B']);
});
