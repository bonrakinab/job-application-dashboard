import type { Job, YcJobMetadata } from '@/lib/types';
import { stableJobId, stripHtml } from '@/lib/utils';

const YC_ROOT = 'https://www.ycombinator.com';
const LISTING_PATHS = [
  '/jobs/location/canada',
  '/jobs/location/toronto',
  '/jobs/location/kitchener',
  '/jobs/role/software-engineer/remote',
  '/jobs/role/support/remote',
  '/jobs/role/operations/remote',
];

type YcListing = {
  id?: number;
  title?: string;
  url?: string;
  applyUrl?: string;
  location?: string;
  type?: string;
  role?: string;
  roleSpecificType?: string;
  prettyRole?: string;
  salaryRange?: string;
  equityRange?: string;
  minExperience?: string;
  visa?: string;
  companyName?: string;
  companyBatchName?: string;
  companyOneLiner?: string;
  companyUrl?: string;
  createdAt?: string;
  lastActive?: string;
  description?: string;
};

type YcCompany = {
  slug?: string;
  name?: string;
  batch_name?: string;
  one_liner?: string;
  website?: string;
  tags?: string[];
  ycdc_status?: string;
  team_size?: number;
};

function decodeHtmlAttribute(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

export function extractYcPageProps(html: string, component: 'WaasJobListingsPage' | 'WaasShowJobPage') {
  const expression = new RegExp(`<div[^>]+data-page="([^"]*?&quot;component&quot;:&quot;${component}&quot;[^"]*)"`);
  const match = html.match(expression);
  if (!match) throw new Error(`YC page did not include ${component} data.`);
  return JSON.parse(decodeHtmlAttribute(match[1])).props as Record<string, unknown>;
}

export function ycLocationAcceptsOntario(location = '') {
  const value = location.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!value || /\b(us|usa|united states) only\b/.test(value)) return false;
  if (/\b(ontario|toronto|kitchener|waterloo|ottawa|windsor|mississauga|markham|vaughan|hamilton)\b/.test(value)) return true;
  if (/\bcanada\b/.test(value)) return true;
  if (/\bremote\s*\([^)]*\bca\b[^)]*\)/.test(value) || /^(ca)(\s*\/.*)?$/.test(value)) return true;
  if (/\bremote\b/.test(value) && /\b(worldwide|global|anywhere|north america|americas)\b/.test(value)) return true;
  return /^(ca|canada)(\s*\/.*)?$/.test(value);
}

export function ycRoleLooksRelevant(title = '') {
  const value = title.toLowerCase();
  if (/\b(financial|finance|accounting|tax|talent|recruit|marketing|sales|account executive|customer success|product manager)\b/.test(value)
    && !/\b(software|engineer|developer|data|technical|systems|automation|cloud|machine learning|ai)\b/.test(value)) return false;
  return /\b(software|engineer|developer|data|analytics|analyst|artificial intelligence|machine learning|ai|ml|technical|information technology|it|systems|cloud|devops|erp|automation|quality assurance|qa|solutions)\b/.test(value);
}

function relativePostedAt(value?: string, now = new Date()) {
  if (!value) return undefined;
  const exact = Date.parse(value);
  if (Number.isFinite(exact)) return new Date(exact).toISOString();
  const match = value.toLowerCase().match(/(\d+)\s*(minute|hour|day|week|month)/);
  if (!match) return undefined;
  const multiplier: Record<string, number> = { minute: 60_000, hour: 3_600_000, day: 86_400_000, week: 604_800_000, month: 2_592_000_000 };
  return new Date(now.getTime() - Number(match[1]) * multiplier[match[2]]).toISOString();
}

function salaryNumbers(value?: string) {
  if (!value) return {};
  const currency = /\bCAD\b/i.test(value) ? 'CAD' : /\bUSD\b|\$/i.test(value) ? 'USD' : undefined;
  const values = [...value.matchAll(/(?:\$|CAD\s*)?([\d,.]+)\s*([KkMm])?/g)].map((match) => {
    const base = Number(match[1].replace(/,/g, ''));
    return base * (match[2]?.toLowerCase() === 'm' ? 1_000_000 : match[2] ? 1_000 : 1);
  }).filter(Number.isFinite);
  return { salaryMin: values[0], salaryMax: values[1], currency };
}

function metadata(listing: YcListing, company?: YcCompany): YcJobMetadata {
  return {
    batch: company?.batch_name || listing.companyBatchName,
    companySlug: company?.slug,
    companyUrl: company?.website || listing.companyUrl,
    companyOneLiner: company?.one_liner || listing.companyOneLiner,
    companyStatus: company?.ycdc_status,
    industryTags: company?.tags ?? [],
    teamSize: company?.team_size,
    role: listing.prettyRole || listing.role,
    roleSpecificType: listing.roleSpecificType,
    minimumExperience: listing.minExperience,
    visa: listing.visa,
    equityRange: listing.equityRange,
    lastActive: listing.lastActive,
  };
}

export function normalizeYcListing(listing: YcListing, company?: YcCompany, now = new Date()): Job | null {
  if (!listing.id || !listing.title || !listing.url || !listing.companyName || !ycLocationAcceptsOntario(listing.location)) return null;
  const url = new URL(listing.url, YC_ROOT).toString();
  const salary = salaryNumbers(listing.salaryRange);
  const yc = metadata(listing, company);
  return {
    id: stableJobId('ycombinator', 'yc-startup-jobs', String(listing.id)),
    externalId: String(listing.id),
    source: 'ycombinator',
    sourceKey: 'yc-startup-jobs',
    url,
    applyUrl: listing.applyUrl || url,
    title: listing.title,
    company: listing.companyName,
    location: listing.location,
    description: stripHtml(listing.description || `${listing.companyOneLiner ?? ''} ${listing.title}`),
    postedAt: relativePostedAt(listing.createdAt, now),
    salaryMin: salary.salaryMin,
    salaryMax: salary.salaryMax,
    currency: salary.currency,
    salaryText: listing.salaryRange,
    employmentType: listing.type,
    remote: /\bremote\b/i.test(listing.location ?? ''),
    workplaceType: /\bremote\b/i.test(listing.location ?? '') ? 'Remote' : 'On-site',
    department: [listing.prettyRole, listing.roleSpecificType].filter(Boolean).join(' · ') || undefined,
    validityStatus: 'active',
    healthScore: 96,
    verificationSignals: ['Listed on the official Y Combinator startup-jobs page.'],
    verificationMethod: 'yc-official-page',
    yc,
    raw: { sourceAttribution: 'Y Combinator', yc },
  };
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'JobApplicationDashboard/1.0 personal-job-search' },
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Y Combinator ${response.status}: ${url}`);
  return response.text();
}

async function enrichListing(listing: YcListing, now: Date) {
  try {
    const detail = extractYcPageProps(await fetchHtml(new URL(listing.url!, YC_ROOT).toString()), 'WaasShowJobPage');
    const detailedListing = (detail.jobPosting ?? detail.job ?? {}) as YcListing;
    const company = detail.company as YcCompany | undefined;
    return normalizeYcListing({ ...listing, ...detailedListing }, company, now);
  } catch {
    return normalizeYcListing(listing, undefined, now);
  }
}

export async function fetchYcJobs(): Promise<Job[]> {
  const settled = await Promise.allSettled(LISTING_PATHS.map(async (path) => {
    const props = extractYcPageProps(await fetchHtml(`${YC_ROOT}${path}`), 'WaasJobListingsPage');
    return (props.jobPostings ?? []) as YcListing[];
  }));
  const listings = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  if (!listings.length && settled.every((result) => result.status === 'rejected')) throw new Error('All Y Combinator job pages failed.');
  const eligible = [...new Map(listings.filter((item) => item.id && ycLocationAcceptsOntario(item.location) && ycRoleLooksRelevant(item.title)).map((item) => [item.id!, item])).values()];
  const now = new Date();
  const jobs: Job[] = [];
  for (let index = 0; index < eligible.length; index += 5) {
    const batch = await Promise.all(eligible.slice(index, index + 5).map((item) => enrichListing(item, now)));
    jobs.push(...batch.filter((job): job is Job => Boolean(job)));
  }
  return jobs;
}
