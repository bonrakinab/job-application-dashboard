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

function stripHtml(value = '') {
  return value.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
}
function normalizeText(value = '') { return stripHtml(value).toLowerCase().replace(/[^a-z0-9+#.\-/ ]/g, ' ').replace(/\s+/g, ' ').trim(); }
function clamp(value: number, min = 0, max = 100) { return Math.max(min, Math.min(max, Math.round(value))); }
function daysSince(value?: string) { if (!value) return 0; const time = new Date(value).getTime(); return Number.isNaN(time) ? 0 : (Date.now() - time) / 86_400_000; }
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

function locationMatches(job: Job, profile: CandidateProfile) {
  const location = normalizeText(job.location ?? '');
  const preferred = (profile.preferredLocations ?? []).map(normalizeText).filter(Boolean);
  const globallyRemote = !location || location === 'remote' || location === 'anywhere' || location === 'worldwide' || location.includes('remote worldwide') || location.includes('remote anywhere');
  if (job.remote && globallyRemote) return true;
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
  return { job_id: job.id, overall, skills, experience, education, domain, location, recommendation, blockers, strengths: matchedSkills.slice(0, 6), gaps, must_have: [], preferred: [], matched_skills: matchedSkills, missing_skills: [], explanation: blockers.length ? blockers.join(' ') : softSeniorityGap ? 'Scheduled supplemental score uses role family, skill evidence, location and education, with a soft cap for a seniority mismatch.' : 'Scheduled supplemental score based on role family, skill evidence, location, education and experience.', model: 'deterministic-supplemental-v2', analyzed_at: new Date().toISOString() };
}

async function fetchJobicy(): Promise<Job[]> {
  const response = await fetch('https://jobicy.com/api/v2/remote-jobs?count=100&geo=canada', { headers: { Accept: 'application/json', 'User-Agent': 'JobAgent/1.0 personal-job-search' }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Jobicy ${response.status}`);
  const payload = await response.json() as any;
  return Promise.all((payload.jobs ?? []).filter((item: any) => item.id != null && item.jobTitle && item.companyName && item.url).map(async (item: any) => ({
    id: await stableJobId('jobicy', 'remote-canada', String(item.id)), external_id: String(item.id), source: 'jobicy', source_key: 'remote-canada', url: item.url, apply_url: item.url, title: item.jobTitle, company: item.companyName, location: item.jobGeo || 'Remote', description: stripHtml(item.jobDescription || item.jobExcerpt || ''), posted_at: item.pubDate, salary_min: item.salaryMin ?? undefined, salary_max: item.salaryMax ?? undefined, currency: item.salaryCurrency ?? undefined, salary_text: item.salaryMin || item.salaryMax ? `${item.salaryCurrency ?? ''} ${item.salaryMin ?? ''}${item.salaryMax ? `–${item.salaryMax}` : ''} ${item.salaryPeriod ?? ''}`.trim() : undefined, employment_type: Array.isArray(item.jobType) ? item.jobType.join(', ') : item.jobType, remote: true, workplace_type: 'Remote', department: Array.isArray(item.jobIndustry) ? item.jobIndustry.join(', ') : item.jobIndustry, raw: { level: item.jobLevel, sourceAttribution: 'Jobicy' },
  })));
}

async function fetchRemotive(): Promise<Job[]> {
  const response = await fetch('https://remotive.com/api/remote-jobs', { headers: { Accept: 'application/json', 'User-Agent': 'JobAgent/1.0 personal-job-search' }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Remotive ${response.status}`);
  const payload = await response.json() as any;
  return Promise.all((payload.jobs ?? []).filter((item: any) => item.id != null && item.title && item.company_name && item.url).map(async (item: any) => ({
    id: await stableJobId('remotive', 'public-api', String(item.id)), external_id: String(item.id), source: 'remotive', source_key: 'public-api', url: item.url, apply_url: item.url, title: item.title, company: item.company_name, location: item.candidate_required_location || 'Remote', description: stripHtml(item.description || ''), posted_at: item.publication_date, salary_text: item.salary || undefined, employment_type: item.job_type, remote: true, workplace_type: 'Remote', department: item.category, raw: { sourceAttribution: 'Remotive' },
  })));
}

function jobRow(job: Job, now: string) {
  return {
    id: job.id,
    external_id: job.external_id,
    source: job.source,
    source_key: job.source_key,
    url: job.url,
    apply_url: job.apply_url ?? null,
    title: job.title,
    company: job.company,
    location: job.location ?? null,
    description: job.description,
    posted_at: job.posted_at ?? null,
    last_seen_at: now,
    salary_min: job.salary_min ?? null,
    salary_max: job.salary_max ?? null,
    currency: job.currency ?? null,
    salary_text: job.salary_text ?? null,
    employment_type: job.employment_type ?? null,
    remote: job.remote ?? null,
    workplace_type: job.workplace_type ?? null,
    department: job.department ?? null,
    raw: job.raw ?? null,
  };
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
async function upsert(table: string, rows: unknown[], conflict: string) { if (rows.length) await db(`${table}?on_conflict=${encodeURIComponent(conflict)}`, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) }); }
async function insertIgnore(table: string, rows: unknown[], conflict: string) { if (rows.length) await db(`${table}?on_conflict=${encodeURIComponent(conflict)}`, { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(rows) }); }

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  try {
    const profileRows = await db('candidate_profiles?id=eq.default&select=profile&limit=1');
    const profile = profileRows?.[0]?.profile as CandidateProfile | undefined;
    if (!profile) throw new Error('Candidate profile is not configured.');

    const errors: string[] = [];
    const allJobs: Job[] = [];
    const settled = await Promise.allSettled([fetchJobicy(), fetchRemotive()]);
    const sourceNames = ['Jobicy', 'Remotive'];
    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') allJobs.push(...result.value);
      else errors.push(`${sourceNames[index]}: ${String((result.reason as any)?.message ?? result.reason)}`);
    });

    const deduped = [...new Map(allJobs.map((job) => [job.id, job])).values()];
    const relevant = deduped.filter((job) => titleMatchesTarget(job.title, profile.targetTitles ?? []) && locationMatches(job, profile) && (!job.posted_at || daysSince(job.posted_at) <= MAX_AGE_DAYS));
    const now = new Date().toISOString();
    await upsert('jobs', relevant.map((job) => jobRow(job, now)), 'id');
    const matches = relevant.map((job) => deterministicScore(job, profile));
    await upsert('job_matches', matches, 'job_id');
    await insertIgnore('applications', relevant.map((job) => ({ job_id: job.id, status: 'discovered', updated_at: now })), 'job_id');
    await db('activity_log', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify([{ event: 'supplemental.discovery.completed', payload: { fetched: deduped.length, relevant: relevant.length, sources: sourceNames.length, errors }, created_at: now }]) });

    return Response.json({ ok: true, fetched: deduped.length, relevant: relevant.length, sources: sourceNames.length, errors, scored: matches.length });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
});
