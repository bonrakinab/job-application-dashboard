type ValidityStatus = 'active' | 'likely_active' | 'unknown' | 'likely_closed' | 'closed';

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

type JobRow = {
  id: string;
  external_id: string;
  source: string;
  source_key: string;
  url: string;
  apply_url: string | null;
  title: string;
  company: string;
  location: string | null;
  description: string;
  remote: boolean | null;
  last_seen_at: string | null;
  validity_status: ValidityStatus | null;
  last_verified_at: string | null;
  raw: Record<string, unknown> | null;
};

type Verification = {
  validity_status: ValidityStatus;
  health_score: number;
  last_verified_at: string;
  apply_url_status: number | null;
  verification_signals: string[];
  closure_reason: string | null;
  verification_method: string;
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VERIFY_LIMIT = 140;
const ENTERPRISE_MATCH_LIMIT = 400;
const STOP_WORDS = new Set(['and', 'the', 'for', 'with', 'role', 'senior', 'junior']);
const DOMAIN_ACRONYMS = new Set(['ai', 'ml', 'bi', 'it']);
const SENIORITY_BLOCKERS = ['principal', 'staff', 'director', 'manager', 'vp ', 'vice president', 'head of', 'chief '];
const CLEARANCE_PATTERNS = ['active security clearance', 'top secret clearance', 'secret clearance required'];
const COUNTRY_BLOCKERS = ['us citizens only', 'u.s. citizens only', 'must be a us citizen', 'must be a u.s. citizen'];
const SKILL_EVIDENCE_CURVE = [20, 45, 62, 74, 82, 88, 93, 96, 98, 100];
const CLOSED_PATTERNS = [
  'job is no longer available',
  'job posting is no longer available',
  'position is no longer available',
  'position has been filled',
  'requisition has been filled',
  'applications are closed',
  'application is closed',
  'no longer accepting applications',
  'this job has expired',
  'job has expired',
  'posting has expired',
  'vacancy has been filled',
];
const GENERIC_JOB_PATHS = new Set(['/', '/jobs', '/careers', '/career', '/search', '/en-us', '/en-us/jobs']);

function stripHtml(value = '') {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(value = '') {
  return stripHtml(value).toLowerCase().replace(/[^a-z0-9+#.\-/ ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function seenRecently(lastSeenAt?: string | null) {
  if (!lastSeenAt) return false;
  const time = Date.parse(lastSeenAt);
  return Number.isFinite(time) && Date.now() - time <= 48 * 60 * 60 * 1000;
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

async function upsert(table: string, rows: unknown[], conflict: string) {
  if (!rows.length) return;
  await db(`${table}?on_conflict=${encodeURIComponent(conflict)}`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
}

async function patchJob(jobId: string, verification: Verification) {
  await db(`jobs?id=eq.${encodeURIComponent(jobId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(verification),
  });
}

function workdayDetailUrl(job: JobRow) {
  try {
    const direct = new URL(job.url);
    const site = String(job.raw?.site ?? '').trim();
    if (!site) return null;
    const prefix = `/en-US/${site}`;
    const externalPath = direct.pathname.startsWith(prefix) ? direct.pathname.slice(prefix.length) : '';
    if (!externalPath) return null;
    return `https://${direct.host}/wday/cxs/${encodeURIComponent(job.source_key)}/${encodeURIComponent(site)}/job${externalPath}`;
  } catch {
    return null;
  }
}

function verificationUrl(job: JobRow) {
  if (job.source === 'greenhouse') {
    return `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(job.source_key)}/jobs/${encodeURIComponent(job.external_id)}`;
  }
  if (job.source === 'lever') {
    return `https://api.lever.co/v0/postings/${encodeURIComponent(job.source_key)}/${encodeURIComponent(job.external_id)}?mode=json`;
  }
  if (job.source === 'workday') return workdayDetailUrl(job) ?? job.apply_url ?? job.url;
  return job.apply_url ?? job.url;
}

function genericRedirectLooksClosed(original: string, finalUrl: string) {
  try {
    const before = new URL(original);
    const after = new URL(finalUrl);
    if (before.host !== after.host) return false;
    const finalPath = after.pathname.toLowerCase().replace(/\/$/, '') || '/';
    const originalPath = before.pathname.toLowerCase().replace(/\/$/, '') || '/';
    return originalPath.length > finalPath.length + 8 && GENERIC_JOB_PATHS.has(finalPath);
  } catch {
    return false;
  }
}

function verification(
  status: ValidityStatus,
  health: number,
  signals: string[],
  options: Partial<Verification> = {},
): Verification {
  return {
    validity_status: status,
    health_score: health,
    last_verified_at: new Date().toISOString(),
    apply_url_status: options.apply_url_status ?? null,
    verification_signals: signals,
    closure_reason: options.closure_reason ?? null,
    verification_method: options.verification_method ?? 'http',
  };
}

async function verifyJob(job: JobRow): Promise<Verification> {
  const url = verificationUrl(job);
  const recent = seenRecently(job.last_seen_at);
  if (!url || url === '#') {
    return verification('unknown', 40, ['No usable application/source URL is available.'], {
      closure_reason: 'No usable application/source URL is available.',
      verification_method: 'none',
    });
  }

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        Accept: ['workday', 'greenhouse', 'lever'].includes(job.source)
          ? 'application/json,text/html;q=0.9,*/*;q=0.8'
          : 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.8',
        'User-Agent': 'JobApplicationDashboard/1.0 personal-job-search',
      },
      signal: AbortSignal.timeout(10_000),
    });
    const body = await response.text();
    const normalized = normalizeText(body).slice(0, 400_000);

    if (response.status === 404 || response.status === 410) {
      return verification('closed', 5, [`Source returned HTTP ${response.status}.`], {
        apply_url_status: response.status,
        closure_reason: `The source returned HTTP ${response.status}.`,
      });
    }

    const closedPhrase = CLOSED_PATTERNS.find((pattern) => normalized.includes(pattern));
    if (closedPhrase) {
      return verification('closed', 5, [`Closure language detected: ${closedPhrase}.`], {
        apply_url_status: response.status,
        closure_reason: `Closure language detected: ${closedPhrase}.`,
      });
    }

    if (response.ok && ['workday', 'greenhouse', 'lever'].includes(job.source)) {
      try {
        const parsed = JSON.parse(body) as Record<string, unknown>;
        const structuredActive = job.source === 'workday'
          ? Boolean(parsed.jobPostingInfo && typeof parsed.jobPostingInfo === 'object')
          : Boolean(Object.keys(parsed).length);
        if (structuredActive) {
          return verification('active', 100, ['The job is present in the source ATS/API.', ...(recent ? ['Seen in discovery within the last 48 hours.'] : [])], {
            apply_url_status: response.status,
            verification_method: 'source-api',
          });
        }
      } catch {
        // Continue with page-level evidence.
      }
    }

    if (response.status >= 400) {
      return recent
        ? verification('likely_active', 72, [`Verification returned HTTP ${response.status}, but the listing was seen in discovery within 48 hours.`], { apply_url_status: response.status, verification_method: 'feed+http' })
        : verification('unknown', 45, [`Verification returned HTTP ${response.status}; this is not proof of closure.`], { apply_url_status: response.status });
    }

    if (genericRedirectLooksClosed(job.url, response.url || url)) {
      return verification('likely_closed', 30, ['The job-specific URL redirected to a generic careers/jobs page.'], {
        apply_url_status: response.status,
        closure_reason: 'The job-specific URL redirected to a generic careers/jobs page.',
      });
    }

    if (normalizeText(job.title).length >= 5 && normalized.includes(normalizeText(job.title))) {
      return verification('active', recent ? 98 : 92, ['The live page still contains the job title.', ...(recent ? ['Seen in discovery within the last 48 hours.'] : [])], { apply_url_status: response.status });
    }

    if (response.ok) {
      return verification('likely_active', recent ? 88 : 80, ['The job-specific URL returned a successful response.', ...(recent ? ['Seen in discovery within the last 48 hours.'] : [])], { apply_url_status: response.status });
    }

    return verification('unknown', 50, ['Availability could not be confirmed.'], { apply_url_status: response.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return recent
      ? verification('likely_active', 70, [`Verification request failed (${message.slice(0, 140)}).`, 'The job was seen in discovery within 48 hours.'], { verification_method: 'feed+http' })
      : verification('unknown', 45, [`Verification request failed (${message.slice(0, 140)}).`]);
  }
}

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
    if (!normalizedTarget) return false;
    if (normalizedTitle.includes(normalizedTarget)) return true;
    const words = normalizedTarget.split(' ').filter((word) => (word.length > 2 || DOMAIN_ACRONYMS.has(word)) && !STOP_WORDS.has(word));
    const hits = words.filter((word) => normalizedTitle.includes(word)).length;
    return words.length === 1 ? hits === 1 : hits >= Math.min(2, words.length);
  });
}

function locationMatches(job: JobRow, profile: CandidateProfile) {
  const location = normalizeText(job.location ?? '');
  const preferred = (profile.preferredLocations ?? []).map(normalizeText).filter(Boolean);
  if (job.remote && (!location || ['remote', 'worldwide', 'anywhere', 'global'].includes(location))) return true;
  if (!location) return Boolean(job.remote);
  if (/\b(canada|ontario|toronto|windsor|waterloo|ottawa|montreal|vancouver|calgary|alberta|british columbia|quebec)\b/.test(location)) return true;
  return preferred.some((place) => location.includes(place) || place.includes(location));
}

function statedYearsRequirement(text: string) {
  const matches = [...text.matchAll(/(?:at least\s*)?(\d{1,2})\+?\s*(?:or more\s*)?years?\s+(?:of\s+)?(?:professional\s+|industry\s+)?experience/g)];
  return matches.reduce((max, match) => Math.max(max, Number(match[1]) || 0), 0);
}

function hardEligibility(job: JobRow, profile: CandidateProfile) {
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

function deterministicMatch(job: JobRow, profile: CandidateProfile) {
  const text = normalizeText(`${job.title} ${job.location ?? ''} ${job.description}`);
  const blockers = hardEligibility(job, profile);
  const skillEvidence = scoreSkillEvidence(text, profile.skills ?? []);
  const targetScore = titleMatchesTarget(job.title, profile.targetTitles ?? []) ? 100 : 25;
  const location = locationMatches(job, profile) ? 100 : 20;
  const candidateYears = profile.yearsExperience ?? 0;
  const normalizedTitle = normalizeText(job.title);
  const softSeniorityGap = (normalizedTitle.includes('lead') && candidateYears < 5) || (normalizedTitle.includes('senior') && candidateYears < 4);
  const experience = softSeniorityGap ? clamp(50 + Math.min(candidateYears, 4) * 5) : clamp(candidateYears >= 2 ? 65 + targetScore * 0.25 : 50 + targetScore * 0.2);
  const education = profile.degrees?.length ? 90 : 70;
  const domain = clamp(targetScore * 0.65 + skillEvidence.score * 0.35);
  const weighted = clamp(skillEvidence.score * 0.35 + experience * 0.2 + education * 0.1 + domain * 0.2 + location * 0.15);
  const eligibleScore = softSeniorityGap ? Math.min(69, weighted) : weighted;
  const overall = blockers.length ? Math.min(49, eligibleScore) : eligibleScore;
  const recommendation = blockers.length ? 'skip' : overall >= 90 ? 'exceptional' : overall >= 80 ? 'strong' : overall >= 70 ? 'reasonable' : overall >= 60 ? 'stretch' : 'skip';
  const gaps = softSeniorityGap ? ['Title indicates a seniority level above the configured experience level; keep as a stretch unless the description is unusually flexible.'] : [];
  return {
    job_id: job.id,
    overall,
    skills: skillEvidence.score,
    experience,
    education,
    domain,
    location,
    recommendation,
    blockers,
    strengths: skillEvidence.matched.slice(0, 6),
    gaps,
    must_have: [],
    preferred: [],
    matched_skills: skillEvidence.matched,
    missing_skills: [],
    explanation: blockers.length ? blockers.join(' ') : softSeniorityGap ? 'Deterministic enterprise score uses role family, skill evidence, location and education, with a soft cap for a seniority mismatch.' : 'Deterministic enterprise score based on role family, skill evidence, location, education and experience.',
    model: 'deterministic-validity-monitor-v1',
    analyzed_at: new Date().toISOString(),
  };
}

async function runInBatches<T>(items: T[], size: number, worker: (item: T) => Promise<void>) {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map(worker));
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const startedAt = new Date().toISOString();
  try {
    const profileRows = await db('candidate_profiles?id=eq.default&select=profile&limit=1');
    const profile = profileRows?.[0]?.profile as CandidateProfile | undefined;
    if (!profile) throw new Error('Candidate profile is not configured.');

    const jobs = await db(`jobs?select=id,external_id,source,source_key,url,apply_url,title,company,location,description,remote,last_seen_at,validity_status,last_verified_at,raw&order=last_verified_at.asc.nullsfirst&limit=${VERIFY_LIMIT}`) as JobRow[];
    const counts: Record<ValidityStatus, number> = { active: 0, likely_active: 0, unknown: 0, likely_closed: 0, closed: 0 };
    const errors: string[] = [];

    await runInBatches(jobs, 8, async (job) => {
      try {
        const checked = await verifyJob(job);
        await patchJob(job.id, checked);
        counts[checked.validity_status] += 1;
      } catch (error) {
        errors.push(`${job.company}/${job.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    const enterpriseJobs = await db(`jobs?source=in.(workday,amazonjobs)&select=id,external_id,source,source_key,url,apply_url,title,company,location,description,remote,last_seen_at,validity_status,last_verified_at,raw&order=discovered_at.desc&limit=${ENTERPRISE_MATCH_LIMIT}`) as JobRow[];
    const enterpriseIds = enterpriseJobs.map((job) => job.id);
    let existingMatchIds = new Set<string>();
    if (enterpriseIds.length) {
      const matchRows = await db(`job_matches?select=job_id&job_id=in.(${enterpriseIds.join(',')})`) as Array<{ job_id: string }>;
      existingMatchIds = new Set(matchRows.map((row) => row.job_id));
    }
    const missingMatches = enterpriseJobs.filter((job) => !existingMatchIds.has(job.id));
    const matchRows = missingMatches.map((job) => deterministicMatch(job, profile));
    await upsert('job_matches', matchRows, 'job_id');

    const now = new Date().toISOString();
    await db('activity_log', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify([{
        event: 'job_validity.monitor.completed',
        payload: {
          startedAt,
          verified: jobs.length,
          counts,
          errors: errors.slice(0, 25),
          enterpriseJobsCheckedForMatch: enterpriseJobs.length,
          enterpriseMatchesBackfilled: matchRows.length,
        },
        created_at: now,
      }]),
    });

    return Response.json({
      ok: true,
      verified: jobs.length,
      counts,
      errors,
      enterpriseJobsCheckedForMatch: enterpriseJobs.length,
      enterpriseMatchesBackfilled: matchRows.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      await db('activity_log', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify([{ event: 'job_validity.monitor.failed', payload: { error: message }, created_at: new Date().toISOString() }]),
      });
    } catch { /* best effort */ }
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
