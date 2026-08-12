type CandidateProfile = {
  targetTitles: string[];
  preferredLocations: string[];
  skills: string[];
  yearsExperience?: number;
  degrees?: unknown[];
  certifications?: string[];
  workAuthorization?: string[];
  excludedKeywords?: string[];
};

type Job = {
  id: string;
  external_id: string;
  source: string;
  source_key: string;
  url: string;
  apply_url?: string;
  title: string;
  company: string;
  location?: string;
  description: string;
  posted_at?: string;
  salary_min?: number;
  salary_max?: number;
  currency?: string;
  salary_text?: string;
  employment_type?: string;
  remote?: boolean;
  workplace_type?: string;
  department?: string;
  raw?: unknown;
};

type Match = {
  job_id: string;
  overall: number;
  skills: number;
  experience: number;
  education: number;
  domain: number;
  location: number;
  recommendation: string;
  blockers: string[];
  strengths: string[];
  gaps: string[];
  must_have: string[];
  preferred: string[];
  matched_skills: string[];
  missing_skills: string[];
  explanation: string;
  model: string;
  analyzed_at: string;
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MAX_AGE_DAYS = 14;
const SENIORITY_BLOCKERS = ['principal', 'staff', 'director', 'manager', 'vp ', 'vice president', 'head of', 'chief '];
const CLEARANCE_PATTERNS = ['active security clearance', 'top secret clearance', 'secret clearance required'];
const COUNTRY_BLOCKERS = ['us citizens only', 'u.s. citizens only', 'must be a us citizen', 'must be a u.s. citizen'];
const STOP_WORDS = new Set(['and', 'the', 'for', 'with', 'role', 'senior', 'junior']);
const DOMAIN_ACRONYMS = new Set(['ai', 'ml']);
const SKILL_EVIDENCE_CURVE = [20, 45, 62, 74, 82, 88, 93, 96, 98, 100];
const REMOTEOK_TAGS = ['dev', 'engineer', 'software', 'python', 'data', 'ai', 'cloud', 'sys admin', 'entry level', 'intern'];
const HIMALAYAS_QUERIES = ['machine learning', 'artificial intelligence', 'data analyst', 'data scientist', 'software engineer', 'business analyst', 'solutions engineer', 'technical consultant', 'oracle', 'erp', 'cloud', 'intern'];
const HIMALAYAS_MAX_PAGES_PER_QUERY = 6;
const WWR_FEEDS = [
  'https://weworkremotely.com/remote-jobs.rss',
  'https://weworkremotely.com/categories/remote-customer-support-jobs.rss',
  'https://weworkremotely.com/categories/remote-product-jobs.rss',
  'https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss',
  'https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss',
  'https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss',
  'https://weworkremotely.com/categories/remote-programming-jobs.rss',
  'https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss',
  'https://weworkremotely.com/categories/remote-management-and-finance-jobs.rss',
  'https://weworkremotely.com/categories/remote-design-jobs.rss',
  'https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss',
  'https://weworkremotely.com/categories/all-other-remote-jobs.rss',
];

function stripHtml(value = '') {
  return value.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
}
function normalizeText(value = '') { return stripHtml(value).toLowerCase().replace(/[^a-z0-9+#.\-/ ]/g, ' ').replace(/\s+/g, ' ').trim(); }
function clamp(value: number, min = 0, max = 100) { return Math.max(min, Math.min(max, Math.round(value))); }
function normalizeDate(value: unknown) {
  if (value == null || value === '') return undefined;
  let timestamp: number;
  if (typeof value === 'number') timestamp = value < 100_000_000_000 ? value * 1000 : value;
  else if (typeof value === 'string' && /^\d{10,13}$/.test(value.trim())) {
    const numeric = Number(value);
    timestamp = numeric < 100_000_000_000 ? numeric * 1000 : numeric;
  } else timestamp = new Date(String(value)).getTime();
  if (!Number.isFinite(timestamp)) return undefined;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
function daysSince(value?: string) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : (Date.now() - time) / 86_400_000;
}
async function stableJobId(source: string, sourceKey: string, externalId: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${source}:${sourceKey}:${externalId}`));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

function titleMatchesTarget(title: string, targets: string[]) {
  const normalizedTitle = normalizeText(title);
  return targets.some((target) => {
    const normalizedTarget = normalizeText(target);
    if (normalizedTitle.includes(normalizedTarget)) return true;
    const words = normalizedTarget.split(' ').filter((word) => (word.length > 2 || DOMAIN_ACRONYMS.has(word)) && !STOP_WORDS.has(word));
    const hits = words.filter((word) => normalizedTitle.includes(word)).length;
    return words.length === 1 ? hits === 1 : hits >= Math.min(2, words.length);
  });
}

function remoteRegionMatches(location: string, preferred: string[]) {
  if (!location) return true;
  if (location === 'remote' || location === 'anywhere' || location === 'worldwide' || location === 'global' || location.includes('anywhere in the world') || location.includes('remote worldwide') || location.includes('remote anywhere') || location.includes('probably worldwide')) return true;
  const preferenceText = preferred.join(' ');
  const wantsCanada = preferenceText.includes('canada');
  if (wantsCanada && (location === 'canada' || location.includes('canada only') || location.includes('north america only') || location === 'north america' || location.includes('americas only'))) return true;
  return false;
}

function locationMatches(job: Job, profile: CandidateProfile) {
  const location = normalizeText(job.location ?? '');
  const preferred = (profile.preferredLocations ?? []).map(normalizeText).filter(Boolean);
  if (job.remote && remoteRegionMatches(location, preferred)) return true;
  if (!location) return Boolean(job.remote);
  return preferred.some((place) => location.includes(place) || place.includes(location));
}

function scoreSkillEvidence(text: string, configuredSkills: string[]) {
  if (!configuredSkills.length) return { score: 50, matched: [] as string[] };
  const matched = configuredSkills.filter((skill) => text.includes(normalizeText(skill)));
  const saturation = SKILL_EVIDENCE_CURVE[Math.min(matched.length, SKILL_EVIDENCE_CURVE.length - 1)];
  const compactCoverage = configuredSkills.length <= 6 ? (matched.length / configuredSkills.length) * 95 : 0;
  return { score: clamp(Math.max(saturation, compactCoverage)), matched };
}
function statedYearsRequirement(text: string) {
  const matches = [...text.matchAll(/(?:at least\s*)?(\d{1,2})\+?\s*(?:or more\s*)?years?\s+(?:of\s+)?(?:professional\s+|industry\s+)?experience/g)];
  return matches.reduce((max, match) => Math.max(max, Number(match[1]) || 0), 0);
}
function hasSoftSeniorityGap(title: string, yearsExperience: number) {
  const normalized = normalizeText(title);
  if (normalized.includes('lead') && yearsExperience < 5) return true;
  return normalized.includes('senior') && yearsExperience < 4;
}
function hardEligibility(job: Job, profile: CandidateProfile) {
  const text = normalizeText(`${job.title} ${job.description}`);
  const blockers: string[] = [];
  const authorization = normalizeText([...(profile.workAuthorization ?? []), ...(profile.certifications ?? [])].join(' '));
  const hasClearance = CLEARANCE_PATTERNS.some((pattern) => authorization.includes(pattern.replace(' required', ''))) || authorization.includes('active clearance');
  const hasUsCitizenship = authorization.includes('us citizen') || authorization.includes('u.s. citizen');
  for (const pattern of CLEARANCE_PATTERNS) if (text.includes(pattern) && !hasClearance) blockers.push('Requires an active security clearance not present in the candidate profile.');
  for (const pattern of COUNTRY_BLOCKERS) if (text.includes(pattern) && !hasUsCitizenship) blockers.push('Explicit U.S. citizenship restriction detected.');
  if (SENIORITY_BLOCKERS.some((term) => normalizeText(job.title).includes(term)) && (profile.yearsExperience ?? 0) < 6) blockers.push('Role seniority appears materially above the configured experience level.');
  const requiredYears = statedYearsRequirement(text);
  const candidateYears = profile.yearsExperience ?? 0;
  if (requiredYears >= candidateYears + 4) blockers.push(`Job explicitly asks for about ${requiredYears}+ years of experience.`);
  for (const excluded of profile.excludedKeywords ?? []) if (text.includes(normalizeText(excluded))) blockers.push(`Excluded requirement detected: ${excluded}.`);
  return [...new Set(blockers)];
}
function deterministicScore(job: Job, profile: CandidateProfile): Match {
  const text = normalizeText(`${job.title} ${job.location ?? ''} ${job.description}`);
  const blockers = hardEligibility(job, profile);
  const skillEvidence = scoreSkillEvidence(text, profile.skills ?? []);
  const matchedSkills = skillEvidence.matched;
  const skills = skillEvidence.score;
  const targetScore = titleMatchesTarget(job.title, profile.targetTitles ?? []) ? 100 : 25;
  const location = locationMatches(job, profile) ? 100 : 20;
  const candidateYears = profile.yearsExperience ?? 0;
  const softSeniorityGap = hasSoftSeniorityGap(job.title, candidateYears);
  const experience = softSeniorityGap ? clamp(50 + Math.min(candidateYears, 4) * 5) : clamp(candidateYears >= 2 ? 65 + targetScore * 0.25 : 50 + targetScore * 0.2);
  const education = profile.degrees?.length ? 90 : 70;
  const domain = clamp(targetScore * 0.65 + skills * 0.35);
  const weighted = clamp(skills * 0.35 + experience * 0.2 + education * 0.1 + domain * 0.2 + location * 0.15);
  const eligibleScore = softSeniorityGap ? Math.min(69, weighted) : weighted;
  const overall = blockers.length ? Math.min(49, eligibleScore) : eligibleScore;
  const recommendation = blockers.length ? 'skip' : overall >= 90 ? 'exceptional' : overall >= 80 ? 'strong' : overall >= 70 ? 'reasonable' : overall >= 60 ? 'stretch' : 'skip';
  const gaps = softSeniorityGap ? ['Title indicates a seniority level above the configured experience level; keep as a stretch unless the description is unusually flexible.'] : [];
  return { job_id: job.id, overall, skills, experience, education, domain, location, recommendation, blockers, strengths: matchedSkills.slice(0, 6), gaps, must_have: [], preferred: [], matched_skills: matchedSkills, missing_skills: [], explanation: blockers.length ? blockers.join(' ') : softSeniorityGap ? 'Scheduled expanded-remote score uses role family, skill evidence, location and education, with a soft cap for a seniority mismatch.' : 'Scheduled expanded-remote score based on role family, skill evidence, location, education and experience.', model: 'deterministic-expanded-remote-v2', analyzed_at: new Date().toISOString() };
}

async function fetchRemoteOkFeed(url: string) {
  const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'JobAgent/1.0 personal-job-search' }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Remote OK ${response.status}`);
  const payload = await response.json() as any[];
  return (Array.isArray(payload) ? payload : []).filter((item) => item.id != null);
}
async function fetchRemoteOk(): Promise<Job[]> {
  const urls = ['https://remoteok.com/api', ...REMOTEOK_TAGS.map((tag) => `https://remoteok.com/api?tag=${encodeURIComponent(tag)}`)];
  const settled = await Promise.allSettled(urls.map(fetchRemoteOkFeed));
  const rows = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  if (!rows.length && settled.every((result) => result.status === 'rejected')) throw new Error('Remote OK requests failed.');
  const deduped = [...new Map(rows.map((item: any) => [String(item.id), item])).values()] as any[];
  return Promise.all(deduped.filter((item) => item.position && item.company && (item.url || item.apply_url)).map(async (item) => ({
    id: await stableJobId('remoteok', 'public-api', String(item.id)), external_id: String(item.id), source: 'remoteok', source_key: 'public-api', url: item.url || item.apply_url, apply_url: item.apply_url || item.url, title: item.position, company: item.company, location: item.location || 'Remote', description: stripHtml(item.description || ''), posted_at: normalizeDate(item.date), salary_min: item.salary_min > 0 ? item.salary_min : undefined, salary_max: item.salary_max > 0 ? item.salary_max : undefined, remote: true, workplace_type: 'Remote', department: Array.isArray(item.tags) ? item.tags.slice(0, 10).join(', ') : undefined, raw: { sourceAttribution: 'Remote OK', slug: item.slug },
  })));
}

function himalayasLocationLabel(restrictions: any) {
  if (!Array.isArray(restrictions) || !restrictions.length) return 'Worldwide';
  const values = restrictions.map((restriction: any) => typeof restriction === 'string' ? restriction : restriction?.name || restriction?.alpha2 || restriction?.slug || '').filter(Boolean);
  return values.length ? values.join(', ') : 'Worldwide';
}
function himalayasCompanyLabel(item: any) {
  const name = String(item.companyName ?? '').trim();
  if (name && name.toLowerCase() !== 'name') return name;
  const slug = String(item.companySlug ?? '').trim();
  return slug ? slug.split('-').filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : 'Company not listed';
}
async function fetchHimalayasPage(query: string, page: number) {
  const params = new URLSearchParams({ q: query, country: 'Canada', sort: 'recent', page: String(page) });
  const response = await fetch(`https://himalayas.app/jobs/api/search?${params.toString()}`, { headers: { Accept: 'application/json', 'User-Agent': 'JobAgent/1.0 personal-job-search' }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Himalayas ${query} page ${page}: ${response.status}`);
  const payload = await response.json() as any;
  return Array.isArray(payload) ? payload : payload.jobs ?? [];
}
async function fetchHimalayasQuery(query: string) {
  const rows: any[] = [];
  for (let page = 1; page <= HIMALAYAS_MAX_PAGES_PER_QUERY; page += 1) {
    try {
      const next = await fetchHimalayasPage(query, page);
      rows.push(...next);
      if (next.length < 20) break;
    } catch (error) {
      if (!rows.length) throw error;
      break;
    }
  }
  return rows;
}
async function fetchHimalayas(): Promise<Job[]> {
  const settled = await Promise.allSettled(HIMALAYAS_QUERIES.map(fetchHimalayasQuery));
  const rows = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  if (!rows.length && settled.every((result) => result.status === 'rejected')) throw new Error('Himalayas requests failed.');
  const deduped = [...new Map(rows.filter((item: any) => item.guid).map((item: any) => [String(item.guid), item])).values()] as any[];
  return Promise.all(deduped.filter((item) => item.guid && item.title && item.applicationLink).map(async (item) => {
    const categories = Array.isArray(item.categories) ? item.categories : Array.isArray(item.category) ? item.category : [];
    return {
      id: await stableJobId('himalayas', 'public-api', String(item.guid)), external_id: String(item.guid), source: 'himalayas', source_key: 'public-api', url: item.applicationLink, apply_url: item.applicationLink, title: item.title, company: himalayasCompanyLabel(item), location: himalayasLocationLabel(item.locationRestrictions), description: stripHtml(item.description || item.excerpt || ''), posted_at: normalizeDate(item.pubDate), salary_min: item.minSalary ?? undefined, salary_max: item.maxSalary ?? undefined, currency: item.currency ?? undefined, salary_text: item.minSalary || item.maxSalary ? `${item.currency ?? ''} ${item.minSalary ?? ''}${item.maxSalary ? `–${item.maxSalary}` : ''} ${item.salaryPeriod ?? ''}`.trim() : undefined, employment_type: item.employmentType, remote: true, workplace_type: 'Remote', department: categories.length ? categories.join(', ') : undefined, raw: { sourceAttribution: 'Himalayas', companySlug: item.companySlug },
    } satisfies Job;
  }));
}

function decodeXml(value: string) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code))).replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16))).replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").trim();
}
function readTag(xml: string, tag: string) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = xml.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
  return match ? decodeXml(match[1]) : '';
}
function splitWwrTitle(value: string) {
  const separator = value.indexOf(':');
  if (separator <= 0) return { company: '', title: value.trim() };
  return { company: value.slice(0, separator).trim(), title: value.slice(separator + 1).trim() };
}
async function parseWwr(xml: string) {
  const items = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((match) => match[1]);
  const jobs: Job[] = [];
  for (const item of items) {
    const split = splitWwrTitle(readTag(item, 'title'));
    const company = readTag(item, 'company') || split.company;
    const title = split.title;
    const link = readTag(item, 'link');
    const guid = readTag(item, 'guid') || link;
    if (!company || !title || !link || !guid) continue;
    const category = readTag(item, 'category');
    jobs.push({
      id: await stableJobId('weworkremotely', 'public-rss', guid), external_id: guid, source: 'weworkremotely', source_key: 'public-rss', url: link, apply_url: link, title, company, location: readTag(item, 'region') || 'Remote', description: stripHtml(readTag(item, 'description')), posted_at: normalizeDate(readTag(item, 'pubDate')), remote: true, workplace_type: 'Remote', department: category || undefined, raw: { sourceAttribution: 'We Work Remotely', category: category || undefined, skills: readTag(item, 'skills') || undefined },
    });
  }
  return jobs;
}
async function fetchWwrFeed(url: string) {
  const response = await fetch(url, { headers: { Accept: 'application/rss+xml, application/xml, text/xml', 'User-Agent': 'JobAgent/1.0 personal-job-search' }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`We Work Remotely ${response.status}`);
  return parseWwr(await response.text());
}
async function fetchWeWorkRemotely(): Promise<Job[]> {
  const settled = await Promise.allSettled(WWR_FEEDS.map(fetchWwrFeed));
  const jobs = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  if (!jobs.length && settled.every((result) => result.status === 'rejected')) throw new Error('We Work Remotely feeds failed.');
  return [...new Map(jobs.map((job) => [job.external_id, job])).values()];
}

function jobRow(job: Job, now: string) {
  return { id: job.id, external_id: job.external_id, source: job.source, source_key: job.source_key, url: job.url, apply_url: job.apply_url ?? null, title: job.title, company: job.company, location: job.location ?? null, description: job.description, posted_at: job.posted_at ?? null, last_seen_at: now, salary_min: job.salary_min ?? null, salary_max: job.salary_max ?? null, currency: job.currency ?? null, salary_text: job.salary_text ?? null, employment_type: job.employment_type ?? null, remote: job.remote ?? null, workplace_type: job.workplace_type ?? null, department: job.department ?? null, raw: job.raw ?? null };
}
async function db(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('apikey', SERVICE_KEY);
  headers.set('Authorization', `Bearer ${SERVICE_KEY}`);
  headers.set('Content-Type', 'application/json');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers });
  if (!response.ok) throw new Error(`DB ${path}: ${response.status} ${await response.text()}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
async function writeBatches(table: string, rows: unknown[], conflict: string, prefer: string) {
  const batchSize = 200;
  for (let index = 0; index < rows.length; index += batchSize) {
    await db(`${table}?on_conflict=${encodeURIComponent(conflict)}`, { method: 'POST', headers: { Prefer: prefer }, body: JSON.stringify(rows.slice(index, index + batchSize)) });
  }
}
async function upsert(table: string, rows: unknown[], conflict: string) { if (rows.length) await writeBatches(table, rows, conflict, 'resolution=merge-duplicates,return=minimal'); }
async function insertIgnore(table: string, rows: unknown[], conflict: string) { if (rows.length) await writeBatches(table, rows, conflict, 'resolution=ignore-duplicates,return=minimal'); }

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  try {
    const profileRows = await db('candidate_profiles?id=eq.default&select=profile&limit=1');
    const profile = profileRows?.[0]?.profile as CandidateProfile | undefined;
    if (!profile) throw new Error('Candidate profile is not configured.');

    const sourceNames = ['Remote OK', 'Himalayas', 'We Work Remotely'];
    const settled = await Promise.allSettled([fetchRemoteOk(), fetchHimalayas(), fetchWeWorkRemotely()]);
    const errors: string[] = [];
    const allJobs: Job[] = [];
    const perSource: Array<{ source: string; jobs: number; status: string }> = [];
    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allJobs.push(...result.value);
        perSource.push({ source: sourceNames[index], jobs: result.value.length, status: 'ok' });
      } else {
        errors.push(`${sourceNames[index]}: ${String((result.reason as any)?.message ?? result.reason)}`);
        perSource.push({ source: sourceNames[index], jobs: 0, status: 'error' });
      }
    });

    const deduped = [...new Map(allJobs.map((job) => [job.id, job])).values()];
    const relevant = deduped.filter((job) => titleMatchesTarget(job.title, profile.targetTitles ?? []) && locationMatches(job, profile) && (!job.posted_at || daysSince(job.posted_at) <= MAX_AGE_DAYS));
    const now = new Date().toISOString();
    await upsert('jobs', relevant.map((job) => jobRow(job, now)), 'id');
    const matches = relevant.map((job) => deterministicScore(job, profile));
    await upsert('job_matches', matches, 'job_id');
    await insertIgnore('applications', relevant.map((job) => ({ job_id: job.id, status: 'discovered', updated_at: now })), 'job_id');
    await db('activity_log', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify([{ event: 'expanded_remote.discovery.completed', payload: { fetched: deduped.length, relevant: relevant.length, sources: sourceNames.length, errors, perSource }, created_at: now }]) });
    return Response.json({ ok: true, fetched: deduped.length, relevant: relevant.length, sources: sourceNames.length, errors, perSource, scored: matches.length });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
});
