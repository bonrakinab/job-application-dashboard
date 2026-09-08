type CandidateProfile = {
  targetTitles?: string[];
  preferredLocations?: string[];
  skills?: string[];
  yearsExperience?: number;
  degrees?: unknown[];
  experience?: unknown[];
  projects?: unknown[];
  certifications?: string[];
  workAuthorization?: string[];
  excludedKeywords?: string[];
};

type YcListing = {
  id?: number; title?: string; url?: string; applyUrl?: string; location?: string;
  type?: string; role?: string; roleSpecificType?: string; prettyRole?: string;
  salaryRange?: string; equityRange?: string; minExperience?: string; visa?: string;
  companyName?: string; companyBatchName?: string; companyOneLiner?: string;
  companyUrl?: string; createdAt?: string; lastActive?: string; description?: string;
};

type YcCompany = {
  slug?: string; name?: string; batch_name?: string; one_liner?: string;
  website?: string; tags?: string[]; ycdc_status?: string; team_size?: number;
};

type Job = {
  id: string; external_id: string; source: string; source_key: string; url: string;
  apply_url: string; title: string; company: string; location: string; description: string;
  posted_at?: string; salary_min?: number; salary_max?: number; currency?: string;
  salary_text?: string; employment_type?: string; remote: boolean; workplace_type: string;
  department?: string; validity_status: string; health_score: number;
  verification_signals: string[]; verification_method: string; application_profile_id: string;
  raw: { sourceAttribution: string; yc: Record<string, unknown> };
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const YC_ROOT = 'https://www.ycombinator.com';
const PATHS = [
  '/jobs/location/canada', '/jobs/location/toronto', '/jobs/location/kitchener',
  '/jobs/role/software-engineer/remote', '/jobs/role/support/remote', '/jobs/role/operations/remote',
];
const SENIORITY = ['principal', 'staff', 'director', 'manager', 'vp ', 'vice president', 'head of', 'chief '];
const BUILDING = ['built', 'developed', 'implemented', 'designed', 'deployed', 'launched', 'created'];
const OWNERSHIP = ['led', 'owned', 'end to end', 'end-to-end', 'team lead', 'stakeholder', 'initiative'];
const BREADTH = ['full stack', 'full-stack', 'api', 'automation', 'integration', 'frontend', 'backend', 'cloud', 'data', 'machine learning', 'ai'];
const STARTUP = ['founding', 'first engineer', 'product engineer', 'wear many hats', 'high ownership', 'autonomy', 'fast paced', 'fast-paced', 'zero to one', '0 to 1'];

function normalize(value = '') { return value.toLowerCase().replace(/[^a-z0-9+#.\-/ ]/g, ' ').replace(/\s+/g, ' ').trim(); }
function stripHtml(value = '') { return value.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim(); }
function clamp(value: number) { return Math.max(0, Math.min(100, Math.round(value))); }
function decode(value: string) { return value.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_m, code) => String.fromCodePoint(Number(code))).replace(/&#x([0-9a-f]+);/gi, (_m, code) => String.fromCodePoint(Number.parseInt(code, 16))); }
function pageProps(html: string, component: string) { const match = html.match(new RegExp(`<div[^>]+data-page="([^"]*?&quot;component&quot;:&quot;${component}&quot;[^"]*)"`)); if (!match) throw new Error(`Missing ${component}`); return JSON.parse(decode(match[1])).props; }
function acceptsOntario(location = '') { const value = location.toLowerCase().replace(/\s+/g, ' ').trim(); if (!value || /\b(us|usa|united states) only\b/.test(value)) return false; if (/\b(ontario|toronto|kitchener|waterloo|ottawa|windsor|mississauga|markham|vaughan|hamilton)\b/.test(value)) return true; if (/\bcanada\b/.test(value)) return true; if (/\bremote\s*\([^)]*\bca\b[^)]*\)/.test(value) || /^ca(\s*\/.*)?$/.test(value)) return true; return /\bremote\b/.test(value) && /\b(worldwide|global|anywhere|north america|americas)\b/.test(value); }
function relevantRole(title = '') { const value = title.toLowerCase(); if (/\b(financial|finance|accounting|tax|talent|recruit|marketing|sales|account executive|customer success|product manager)\b/.test(value) && !/\b(software|engineer|developer|data|technical|systems|automation|cloud|machine learning|ai)\b/.test(value)) return false; return /\b(software|engineer|developer|data|analytics|analyst|artificial intelligence|machine learning|ai|ml|technical|information technology|it|systems|cloud|devops|erp|automation|quality assurance|qa|solutions)\b/.test(value); }
function titleMatches(title: string, targets: string[]) { const value = normalize(title); return targets.some((target) => { const words = normalize(target).split(' ').filter((word) => word.length > 2 || ['ai','ml','it','bi'].includes(word)); const hits = words.filter((word) => value.includes(word)).length; return value.includes(normalize(target)) || (words.length === 1 ? hits === 1 : hits >= Math.min(2, words.length)); }); }
function relativeDate(value?: string) { if (!value) return undefined; const exact = Date.parse(value); if (Number.isFinite(exact)) return new Date(exact).toISOString(); const match = value.toLowerCase().match(/(\d+)\s*(minute|hour|day|week|month)/); if (!match) return undefined; const units: Record<string, number> = { minute: 60_000, hour: 3_600_000, day: 86_400_000, week: 604_800_000, month: 2_592_000_000 }; return new Date(Date.now() - Number(match[1]) * units[match[2]]).toISOString(); }
function salaries(value?: string) { const currency = /\bCAD\b/i.test(value ?? '') ? 'CAD' : /\bUSD\b|\$/i.test(value ?? '') ? 'USD' : undefined; const numbers = [...(value ?? '').matchAll(/(?:\$|CAD\s*)?([\d,.]+)\s*([KkMm])?/g)].map((m) => Number(m[1].replace(/,/g, '')) * (m[2]?.toLowerCase() === 'm' ? 1_000_000 : m[2] ? 1_000 : 1)).filter(Number.isFinite); return { min: numbers[0], max: numbers[1], currency }; }
function count(text: string, signals: string[]) { return signals.filter((signal) => text.includes(signal)).length; }

async function stableId(value: string) { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32); }
async function html(url: string) { const response = await fetch(url, { headers: { Accept: 'text/html', 'User-Agent': 'JobApplicationDashboard/1.0 personal-job-search' }, signal: AbortSignal.timeout(15_000) }); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.text(); }
async function db(path: string, init: RequestInit = {}) { const headers = new Headers(init.headers); headers.set('apikey', SERVICE_KEY); headers.set('Authorization', `Bearer ${SERVICE_KEY}`); headers.set('Content-Type', 'application/json'); const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers }); if (!response.ok) throw new Error(`DB ${response.status}: ${(await response.text()).slice(0, 400)}`); const text = await response.text(); return text ? JSON.parse(text) : null; }
async function upsert(table: string, rows: unknown[], conflict: string) { if (rows.length) await db(`${table}?on_conflict=${encodeURIComponent(conflict)}`, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) }); }
async function insertIgnore(table: string, rows: unknown[], conflict: string) { if (rows.length) await db(`${table}?on_conflict=${encodeURIComponent(conflict)}`, { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(rows) }); }

function startupFit(job: Job, profile: CandidateProfile) { const candidate = normalize(JSON.stringify({ skills: profile.skills, experience: profile.experience, projects: profile.projects })); const role = normalize(`${job.title} ${job.description} ${job.department ?? ''}`); const matched = (profile.skills ?? []).filter((skill) => role.includes(normalize(skill))).length; return clamp(15 + Math.min(18, count(candidate, BUILDING) * 4) + Math.min(16, count(candidate, OWNERSHIP) * 4) + Math.min(16, count(candidate, BREADTH) * 2) + Math.min(22, matched * 4) + Math.min(13, count(role, STARTUP) * 3) + Math.min(10, (profile.projects ?? []).length * 2) + (/\b(intern|internship|new grad|junior|entry.level|engineer i)\b/.test(role) ? 5 : 0)); }

function score(job: Job, profile: CandidateProfile) {
  const text = normalize(`${job.title} ${job.location} ${job.description}`);
  const matched = (profile.skills ?? []).filter((skill) => text.includes(normalize(skill)));
  const skill = clamp(20 + Math.min(75, matched.length * 12));
  const title = titleMatches(job.title, profile.targetTitles ?? []) ? 100 : 25;
  const years = profile.yearsExperience ?? 0;
  const blockers: string[] = [];
  if (SENIORITY.some((term) => normalize(job.title).includes(term)) && years < 6) blockers.push('Role seniority appears materially above the configured experience level.');
  const minimumExperience = Number(String(job.raw.yc.minimumExperience ?? '').match(/\d{1,2}/)?.[0] ?? 0);
  if (minimumExperience >= years + 4) blockers.push(`Job explicitly asks for about ${minimumExperience}+ years of experience.`);
  if (/\b(us|u.s.) citizens? only\b|must be (a )?(us|u.s.) citizen/.test(text)) blockers.push('Explicit U.S. citizenship restriction detected.');
  for (const excluded of profile.excludedKeywords ?? []) if (text.includes(normalize(excluded))) blockers.push(`Excluded requirement detected: ${excluded}.`);
  const experience = years >= 2 ? clamp(65 + title * .25) : clamp(50 + title * .2);
  const education = profile.degrees?.length ? 90 : 70;
  const domain = clamp(title * .65 + skill * .35);
  const weighted = clamp(skill * .35 + experience * .2 + education * .1 + domain * .2 + 15);
  const overall = blockers.length ? Math.min(49, weighted) : weighted;
  const recommendation = blockers.length ? 'skip' : overall >= 90 ? 'exceptional' : overall >= 80 ? 'strong' : overall >= 70 ? 'reasonable' : overall >= 60 ? 'stretch' : 'skip';
  return { overall, skills: skill, experience, education, domain, location: 100, startup_fit: startupFit(job, profile), recommendation, blockers, strengths: matched.slice(0, 6), gaps: [], must_have: [], preferred: [], matched_skills: matched, missing_skills: [], explanation: blockers.length ? blockers.join(' ') : 'Deterministic YC startup fit uses role, verified skills, experience, education and explicit Canada/Ontario eligibility.', model: 'deterministic-yc-edge-v1', profile_id: 'default', analyzed_at: new Date().toISOString() };
}

async function normalizeListing(listing: YcListing): Promise<Job | null> {
  if (!listing.id || !listing.title || !listing.url || !listing.companyName || !acceptsOntario(listing.location)) return null;
  let detail = listing;
  let company: YcCompany = {};
  try { const props = pageProps(await html(new URL(listing.url, YC_ROOT).toString()), 'WaasShowJobPage'); detail = { ...listing, ...(props.jobPosting ?? props.job ?? {}) }; company = props.company ?? {}; } catch { /* keep listing data */ }
  if (!acceptsOntario(detail.location) || !relevantRole(detail.title)) return null;
  const salary = salaries(detail.salaryRange);
  const yc = { batch: company.batch_name || detail.companyBatchName, companySlug: company.slug, companyUrl: company.website || detail.companyUrl, companyOneLiner: company.one_liner || detail.companyOneLiner, companyStatus: company.ycdc_status, industryTags: company.tags ?? [], teamSize: company.team_size, role: detail.prettyRole || detail.role, roleSpecificType: detail.roleSpecificType, minimumExperience: detail.minExperience, visa: detail.visa, equityRange: detail.equityRange, lastActive: detail.lastActive };
  const url = new URL(detail.url!, YC_ROOT).toString();
  return { id: await stableId(`ycombinator:yc-startup-jobs:${detail.id}`), external_id: String(detail.id), source: 'ycombinator', source_key: 'yc-startup-jobs', url, apply_url: detail.applyUrl || url, title: detail.title!, company: detail.companyName!, location: detail.location!, description: stripHtml(detail.description || `${detail.companyOneLiner ?? ''} ${detail.title}`), posted_at: relativeDate(detail.createdAt), salary_min: salary.min, salary_max: salary.max, currency: salary.currency, salary_text: detail.salaryRange, employment_type: detail.type, remote: /\bremote\b/i.test(detail.location ?? ''), workplace_type: /\bremote\b/i.test(detail.location ?? '') ? 'Remote' : 'On-site', department: [detail.prettyRole, detail.roleSpecificType].filter(Boolean).join(' · ') || undefined, validity_status: 'active', health_score: 96, verification_signals: ['Listed on the official Y Combinator startup-jobs page.'], verification_method: 'yc-official-page', application_profile_id: 'default', raw: { sourceAttribution: 'Y Combinator', yc } };
}

Deno.serve(async () => {
  try {
    const profileRows = await db('candidate_profiles?id=eq.default&select=profile&limit=1') as Array<{ profile: CandidateProfile }>;
    const profile = profileRows[0]?.profile;
    if (!profile) throw new Error('Default candidate profile is missing.');
    const settled = await Promise.allSettled(PATHS.map(async (path) => pageProps(await html(`${YC_ROOT}${path}`), 'WaasJobListingsPage').jobPostings as YcListing[]));
    const listings = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
    const candidates = [...new Map(listings.filter((item) => item.id && acceptsOntario(item.location) && relevantRole(item.title)).map((item) => [item.id!, item])).values()];
    const jobs: Job[] = [];
    for (let index = 0; index < candidates.length; index += 5) { const batch = await Promise.all(candidates.slice(index, index + 5).map(normalizeListing)); jobs.push(...batch.filter((job): job is Job => Boolean(job))); }
    const relevant = jobs.filter((job) => {
      const posted = job.posted_at ? Date.parse(job.posted_at) : Number.NaN;
      const freshEnough = !Number.isFinite(posted) || Date.now() - posted <= 14 * 86_400_000;
      return freshEnough && titleMatches(job.title, profile.targetTitles ?? []);
    });
    await upsert('jobs', relevant.map((job) => ({
      ...job,
      posted_at: job.posted_at ?? null,
      salary_min: job.salary_min ?? null,
      salary_max: job.salary_max ?? null,
      currency: job.currency ?? null,
      salary_text: job.salary_text ?? null,
      employment_type: job.employment_type ?? null,
      department: job.department ?? null,
      last_seen_at: new Date().toISOString(),
    })), 'id');
    await insertIgnore('applications', relevant.map((job) => ({ job_id: job.id, status: 'discovered', updated_at: new Date().toISOString() })), 'job_id');
    await upsert('job_matches', relevant.map((job) => ({ job_id: job.id, ...score(job, profile) })), 'job_id');
    const companies = [...new Map(relevant.map((job) => [job.company, job])).values()].map((job) => ({ company: job.company, sector: ((job.raw.yc.industryTags as string[]) ?? []).join(' · ') || 'YC startup', careers_url: job.raw.yc.companyUrl || job.url, priority: 2, enabled: true, source: 'yc', source_metadata: job.raw.yc, updated_at: new Date().toISOString() }));
    await upsert('company_watchlist', companies, 'company');
    await db('activity_log', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify([{ event: 'yc.discovery.completed', payload: { fetched: listings.length, canadaEligible: jobs.length, relevant: relevant.length, pages: PATHS.length, errors: settled.filter((item) => item.status === 'rejected').length }, created_at: new Date().toISOString() }]) });
    return Response.json({ ok: true, fetched: listings.length, canadaEligible: jobs.length, relevant: relevant.length, companies: companies.length });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
});
