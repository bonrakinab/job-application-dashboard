import assert from 'node:assert/strict';
import test from 'node:test';
import { rankAnswerBankEntries } from './answer-tailoring';
import type { AnswerBankEntry, Job } from './types';

const entries: AnswerBankEntry[] = [
  { id: '1', question: 'Why are you interested in this company?', answer: 'Company answer', tags: ['culture'] },
  { id: '2', question: 'What are your salary expectations?', answer: 'Salary answer', tags: ['compensation'] },
  { id: '3', question: 'What is your work authorization status?', answer: 'Authorization answer', tags: ['work authorization'] },
  { id: '4', question: 'Describe your experience with Oracle Fusion.', answer: 'Oracle answer', tags: ['oracle fusion'] },
];

const job: Job = {
  externalId: 'job',
  source: 'test',
  sourceKey: 'test',
  url: 'https://example.com/job',
  title: 'Oracle Fusion Analyst',
  company: 'Example Co',
  location: 'Canada',
  description: 'Support Oracle Fusion ERP and enterprise applications.',
};

test('answer bank prioritizes the same application-question intent', () => {
  const ranked = rankAnswerBankEntries(entries, 'Why do you want to work for our company?', job);
  assert.equal(ranked[0]?.id, '1');
});

test('answer bank does not reuse an unrelated response just because its tags match the job', () => {
  const ranked = rankAnswerBankEntries(entries, 'What is your preferred start date?', job);
  assert.deepEqual(ranked, []);
});

test('technical experience questions use matching approved evidence', () => {
  const ranked = rankAnswerBankEntries(entries, 'Tell us about your experience with Oracle Fusion ERP.', job);
  assert.equal(ranked[0]?.id, '4');
});
