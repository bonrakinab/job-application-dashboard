import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyJobVerification, isJobClosed } from './job-validity';

const job = {
  title: 'Machine Learning Engineer',
  url: 'https://example.com/jobs/123-machine-learning-engineer',
  lastSeenAt: new Date().toISOString(),
};

test('structured ATS presence is treated as verified active', () => {
  const result = classifyJobVerification({
    job,
    status: 200,
    finalUrl: job.url,
    body: '{"jobPostingInfo":{"title":"Machine Learning Engineer"}}',
    structuredActive: true,
  });
  assert.equal(result.validityStatus, 'active');
  assert.equal(result.healthScore, 100);
});

test('404 and explicit closure language are hard closed signals', () => {
  const missing = classifyJobVerification({ job, status: 404, finalUrl: job.url, body: '' });
  assert.equal(missing.validityStatus, 'closed');
  assert.equal(isJobClosed(missing.validityStatus), true);

  const filled = classifyJobVerification({
    job,
    status: 200,
    finalUrl: job.url,
    body: 'Thank you for your interest. This position has been filled.',
  });
  assert.equal(filled.validityStatus, 'closed');
});

test('temporary source errors are not misclassified as closed', () => {
  const result = classifyJobVerification({
    job,
    status: 429,
    finalUrl: job.url,
    body: 'Too many requests',
  });
  assert.equal(result.validityStatus, 'likely_active');
  assert.equal(isJobClosed(result.validityStatus), false);
});

test('redirect from a job URL to generic careers is likely closed', () => {
  const result = classifyJobVerification({
    job,
    status: 200,
    finalUrl: 'https://example.com/careers',
    body: 'Explore careers at Example',
  });
  assert.equal(result.validityStatus, 'likely_closed');
});

test('live page containing the exact title is active', () => {
  const result = classifyJobVerification({
    job,
    status: 200,
    finalUrl: job.url,
    body: '<h1>Machine Learning Engineer</h1><button>Apply now</button>',
  });
  assert.equal(result.validityStatus, 'active');
  assert.ok(result.healthScore >= 90);
});
