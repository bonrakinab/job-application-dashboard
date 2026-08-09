type SourceKind = 'greenhouse' | 'lever' | 'ashby';
type AtsSource = { kind: SourceKind; source_key: string; company: string; enabled?: boolean };
type CandidateProfile = { targetTitles: string[]; preferredLocations: string[]; skills: string[]; yearsExperience?: number; degrees?: unknown[]; certifications?: string[]; workAuthorization?: string[]; excludedKeywords?: string[] };
type Job = { id: string; external_id: string; source: string; source_key: string; url: string; apply_url?: string; title: string; company: string; location?: string; description: string; posted_at?: string; salary_min?: number; salary_max?: number; currency?: string; salary_text?: string; employment_type?: string; remote?: boolean; workplace_type?: string; department?: string; raw?: unknown };
type Match = { job_id: string; overall: number; skills: number; experience: number; education: number; domain: number; location: number; recommendation: string; blockers: string[]; strengths: string[]; gaps: string[]; must_have: string[]; preferred: string[]; matched_skills: string[]; missing_skills: string[]; explanation: string; model: string; analyzed_at: string };

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
  let text = value.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ');
  for (let i = 0; i < 3; i += 1) {
    const previous = text;
    text = text.replace(/&nbsp;/gi, ' ').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&amp;/gi, '&');
    if (text === previous) break;
  }
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
function normalizeText(value = '') { return stripHtml(value).toLowerCase().replace(/[^a-z0-9+#.\-/ ]/g, ' ').replace(/\s+/g, ' ').trim(); }
function clamp(value: number, min = 0, max = 100) { return Math.max(min, Math.min(max, Math.round(value))); }
function daysSince(value?: string) { if (!value) return 0; const t = new Date(value).getTime(); return Number.isNaN(t) ? 0 : (Date.now() - t) / 86_400_000; }
async function stableJobId(source: string, sourceKey: string, externalId: string) { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${source}:${sourceKey}:${externalId}`)); return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32); }

function scoreSkillEvidence(text: string, configuredSkills: string[]) {
  if (!configuredSkills.length) return { score: 50, matched: [] as string[] };
  const matched = configuredSkills.filter((skill) => text.includes(normalizeText(skill)));
  const saturation = SKILL_EVIDENCE_CURVE[Math.min(matched.length, SKILL_EVIDENCE_CURVE.length - 1)];
  const compactProfileCoverage = configuredSkills.length <= 6 ? (matched.length / configuredSkills.length) * 95 : 0;
  return { score: clamp(Math.max(saturation, compactProfileCoverage)), matched };
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
  if (!location) return Boolean(job.remote);
  const preferred = (profile.preferredLocations ?? []).map(normalizeText).filter(Boolean);
  return preferred.some((place) => location.includes(place) || place.includes(location));
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
  return { job_id: job.id, overall, skills, experience, education, domain, location, recommendation, blockers, strengths: matchedSkills.slice(0, 6), gaps, must_have: [], preferred: [], matched_skills: matchedSkills, missing_skills: [], explanation: blockers.length ? blockers.join(' ') : softSeniorityGap ? 'Deterministic scheduled score uses role family, skill evidence, location and education, with a soft cap for a seniority mismatch.' : 'Deterministic scheduled score based on role family, skill evidence, location, education and experience.', model: 'deterministic-edge-v3', analyzed_at: new Date().toISOString() };
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

async function fetchSource(source: AtsSource): Promise<Job[]> {
  if (source.kind === 'lever') {
    const response = await fetch(`https://api.lever.co/v0/postings/${encodeURIComponent(source.source_key)}?mode=json`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`Lever ${source.company}: ${response.status}`);
    const payload = await response.json() as any[];
    return Promise.all(payload.map(async (item) => ({ id: await stableJobId('lever', source.source_key, item.id), external_id: item.id, source: 'lever', source_key: source.source_key, url: item.hostedUrl ?? item.applyUrl ?? `https://jobs.lever.co/${source.source_key}/${item.id}`, apply_url: item.applyUrl ?? item.hostedUrl, title: item.text, company: source.company, location: item.categories?.location, description: item.descriptionPlain ?? stripHtml(item.description ?? ''), posted_at: item.createdAt ? new Date(item.createdAt).toISOString() : undefined, employment_type: item.categories?.commitment, department: item.categories?.team, remote: item.workplaceType?.toLowerCase() === 'remote', workplace_type: item.workplaceType, raw: item })));
  }
  if (source.kind === 'greenhouse') {
    const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(source.source_key)}/jobs?content=true`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`Greenhouse ${source.company}: ${response.status}`);
    const payload = await response.json() as any;
    return Promise.all((payload.jobs ?? []).map(async (item: any) => ({ id: await stableJobId('greenhouse', source.source_key, String(item.id)), external_id: String(item.id), source: 'greenhouse', source_key: source.source_key, url: item.absolute_url, apply_url: item.absolute_url, title: item.title, company: source.company, location: item.location?.name, description: stripHtml(item.content ?? ''), posted_at: item.updated_at, department: item.departments?.map((department: any) => department.name).filter(Boolean).join(', '), raw: item })));
  }
  const response = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(source.source_key)}?includeCompensation=true`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Ashby ${source.company}: ${response.status}`);
  const payload = await response.json() as any;
  return Promise.all((payload.jobs ?? []).filter((job: any) => job.isListed !== false).map(async (item: any) => {
    const externalId = item.jobUrl.split('/').filter(Boolean).at(-1) ?? item.jobUrl;
    const salary = item.compensation?.summaryComponents?.find((component: any) => component.compensationType === 'Salary');
    return { id: await stableJobId('ashby', source.source_key, externalId), external_id: externalId, source: 'ashby', source_key: source.source_key, url: item.jobUrl, apply_url: item.applyUrl ?? item.jobUrl, title: item.title, company: source.company, location: item.location, description: item.descriptionPlain ?? '', posted_at: item.publishedAt, salary_min: salary?.minValue ?? undefined, salary_max: salary?.maxValue ?? undefined, currency: salary?.currencyCode ?? undefined, salary_text: item.compensation?.scrapeableCompensationSalarySummary, employment_type: item.employmentType, department: item.team ?? item.department, remote: item.isRemote, workplace_type: item.workplaceType, raw: item };
  }));
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  try {
    const profileRows = await db('candidate_profiles?id=eq.default&select=profile&limit=1');
    const profile = profileRows?.[0]?.profile as CandidateProfile | undefined;
    if (!profile) throw new Error('Candidate profile is not configured.');
    const sources = await db('job_sources?enabled=eq.true&select=kind,source_key,company,enabled&order=company.asc') as AtsSource[];
    const errors: string[] = [];
    const allJobs: Job[] = [];
    const settled = await Promise.allSettled(sources.map(fetchSource));
    settled.forEach((result, index) => { if (result.status === 'fulfilled') allJobs.push(...result.value); else errors.push(`${sources[index].company}: ${String((result.reason as any)?.message ?? result.reason)}`); });
    const relevant = allJobs.filter((job) => titleMatchesTarget(job.title, profile.targetTitles ?? []) && locationMatches(job, profile) && (!job.posted_at || daysSince(job.posted_at) <= MAX_AGE_DAYS));
    const now = new Date().toISOString();
    for (const job of relevant) await upsert('jobs', [{ ...job, last_seen_at: now }], 'id');
    const matches = relevant.map((job) => deterministicScore(job, profile));
    await upsert('job_matches', matches, 'job_id');
    await insertIgnore('applications', relevant.map((job) => ({ job_id: job.id, status: 'discovered', updated_at: now })), 'job_id');
    await db('activity_log', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify([{ event: 'edge.discovery.completed', payload: { fetched: allJobs.length, relevant: relevant.length, sources: sources.length, errors }, created_at: now }]) });
    return Response.json({ ok: true, fetched: allJobs.length, relevant: relevant.length, sources: sources.length, errors, scored: matches.length });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
});
