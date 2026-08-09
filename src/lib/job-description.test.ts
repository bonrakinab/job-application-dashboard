import assert from 'node:assert/strict';
import test from 'node:test';
import { formatJobDescription, jobDescriptionPlainText } from './job-description';

test('formats ATS HTML into safe readable headings, paragraphs, and bullets', () => {
  const html = '<p>MongoDB is seeking a Software Engineer.</p><h3>Our ideal candidate</h3><ul><li>TypeScript &amp; React</li><li>2+ years of experience</li></ul><script>alert(1)</script>';
  const blocks = formatJobDescription(html);

  assert.deepEqual(blocks, [
    { type: 'paragraph', text: 'MongoDB is seeking a Software Engineer.' },
    { type: 'heading', text: 'Our ideal candidate' },
    { type: 'bullet', text: 'TypeScript & React' },
    { type: 'bullet', text: '2+ years of experience' },
  ]);
  const plain = jobDescriptionPlainText(html);
  assert.match(plain, /Our ideal candidate/);
  assert.match(plain, /• TypeScript & React/);
  assert.doesNotMatch(plain, /script|alert/);
});

test('handles entity-encoded HTML without exposing tags', () => {
  const blocks = formatJobDescription('&lt;h3&gt;Responsibilities&lt;/h3&gt;&lt;li&gt;Build APIs&lt;/li&gt;');
  assert.deepEqual(blocks, [
    { type: 'heading', text: 'Responsibilities' },
    { type: 'bullet', text: 'Build APIs' },
  ]);
});
