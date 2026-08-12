import type { Job } from '@/lib/types';
import { stableJobId, stripHtml } from '@/lib/utils';

const FEED_URL = 'https://weworkremotely.com/remote-jobs.rss';

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .trim();
}

function readTag(xml: string, tag: string) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = xml.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
  return match ? decodeXml(match[1]) : '';
}

function splitTitle(value: string) {
  const separator = value.indexOf(':');
  if (separator <= 0) return { company: '', title: value.trim() };
  return {
    company: value.slice(0, separator).trim(),
    title: value.slice(separator + 1).trim(),
  };
}

export function parseWeWorkRemotelyRss(xml: string): Job[] {
  const items = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((match) => match[1]);

  return items.flatMap((item) => {
    const combinedTitle = readTag(item, 'title');
    const split = splitTitle(combinedTitle);
    const company = readTag(item, 'company') || split.company;
    const title = split.title;
    const link = readTag(item, 'link');
    const guid = readTag(item, 'guid') || link;
    if (!company || !title || !link || !guid) return [];

    const region = readTag(item, 'region') || 'Remote';
    const category = readTag(item, 'category');
    const skills = readTag(item, 'skills');
    const description = stripHtml(readTag(item, 'description'));
    const postedAt = readTag(item, 'pubDate') || undefined;

    return [{
      id: stableJobId('weworkremotely', 'public-rss', guid),
      externalId: guid,
      source: 'weworkremotely',
      sourceKey: 'public-rss',
      url: link,
      applyUrl: link,
      title,
      company,
      location: region,
      description,
      postedAt,
      remote: true,
      workplaceType: 'Remote',
      department: category || undefined,
      raw: {
        sourceAttribution: 'We Work Remotely',
        category: category || undefined,
        skills: skills || undefined,
      },
    } satisfies Job];
  });
}

export async function fetchWeWorkRemotelyJobs(): Promise<Job[]> {
  const response = await fetch(FEED_URL, {
    headers: {
      Accept: 'application/rss+xml, application/xml, text/xml',
      'User-Agent': 'JobAgent/1.0 personal-job-search',
    },
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`We Work Remotely: ${response.status}`);
  return parseWeWorkRemotelyRss(await response.text());
}
