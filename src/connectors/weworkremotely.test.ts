import assert from 'node:assert/strict';
import test from 'node:test';
import { parseWeWorkRemotelyRss } from './weworkremotely';

test('parses We Work Remotely RSS jobs and keeps applications on WWR', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <rss><channel><item>
      <title><![CDATA[Example &amp; Co: AI Engineer]]></title>
      <link>https://weworkremotely.com/remote-jobs/example-ai-engineer</link>
      <guid isPermaLink="true">https://weworkremotely.com/remote-jobs/example-ai-engineer</guid>
      <pubDate>Tue, 11 Aug 2026 12:00:00 +0000</pubDate>
      <region><![CDATA[Canada Only]]></region>
      <category><![CDATA[Programming]]></category>
      <skills><![CDATA[Python, AI]]></skills>
      <description><![CDATA[<p>Build production AI systems.</p>]]></description>
    </item></channel></rss>`;

  const jobs = parseWeWorkRemotelyRss(xml);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].company, 'Example & Co');
  assert.equal(jobs[0].title, 'AI Engineer');
  assert.equal(jobs[0].location, 'Canada Only');
  assert.equal(jobs[0].description, 'Build production AI systems.');
  assert.equal(jobs[0].department, 'Programming');
  assert.equal(jobs[0].url, 'https://weworkremotely.com/remote-jobs/example-ai-engineer');
  assert.equal(jobs[0].applyUrl, jobs[0].url);
  assert.equal(jobs[0].source, 'weworkremotely');
});
