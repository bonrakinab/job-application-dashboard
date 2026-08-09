import assert from 'node:assert/strict';
import test from 'node:test';
import { htmlToReadableText, stripHtml } from './utils';

test('stripHtml removes literal tags', () => {
  assert.equal(stripHtml('<p>Hello <b>world</b></p>'), 'Hello world');
});

test('stripHtml removes entity-encoded tags that previously leaked into the UI', () => {
  const encoded = '&lt;p&gt;Build docs&lt;/p&gt;&lt;h3&gt;Ideal candidate&lt;/h3&gt;&lt;ul&gt;&lt;li&gt;TypeScript&lt;/li&gt;&lt;/ul&gt;';
  assert.equal(stripHtml(encoded), 'Build docs Ideal candidate TypeScript');
  assert.equal(stripHtml(encoded).includes('<'), false);
});

test('stripHtml handles double-encoded entities', () => {
  assert.equal(stripHtml('&amp;lt;p&amp;gt;Hello&amp;lt;/p&amp;gt;'), 'Hello');
});

test('htmlToReadableText keeps paragraphs, headings and bullets', () => {
  const html = '<p>Deliver docs used by millions.</p><h3>Our ideal candidate</h3><ul><li>TypeScript</li><li>Next.js</li></ul>';
  const text = htmlToReadableText(html);
  assert.match(text, /Deliver docs used by millions\./);
  assert.match(text, /Our ideal candidate/);
  assert.match(text, /• TypeScript/);
  assert.match(text, /• Next\.js/);
  assert.equal(text.includes('<'), false);
});

test('htmlToReadableText cleans entity-encoded MongoDB-style descriptions', () => {
  const encoded = '&lt;p&gt;The Documentation Platform Engineering Team delivers 60M page views a year.&lt;/p&gt;&lt;h3&gt;Our ideal candidate&lt;/h3&gt;&lt;ul&gt;&lt;li&gt;Hands-on experience with Git, TypeScript, React, Next.js&lt;/li&gt;&lt;li&gt;2+ years of professional experience&lt;/li&gt;&lt;/ul&gt;';
  const text = htmlToReadableText(encoded);
  assert.match(text, /Documentation Platform Engineering Team/);
  assert.match(text, /Our ideal candidate/);
  assert.match(text, /• Hands-on experience with Git, TypeScript, React, Next\.js/);
  assert.match(text, /• 2\+ years of professional experience/);
  assert.equal(/<\/?[a-z][^>]*>/i.test(text), false);
});
