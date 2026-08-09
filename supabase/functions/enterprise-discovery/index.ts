type CandidateProfile = {
  targetTitles: string[];
  preferredLocations: string[];
};

type EnterpriseSource = {
  id: number;
  kind: 'workday' | 'amazon';
  source_key: string;
  company: string;
  config: Record<string, unknown>;
  enabled: boolean;
};

type Job = {
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
  posted_at: string | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  salary_text: string | null;
  employment_type: string | null;
  remote: boolean | null;
  workplace_type: string | null;
  department: string | null;
  raw: unknown;
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PAGE_SIZE = 50;
const MAX_RELEVANT_PER_SOURCE = 120;
const STOP_WORDS = new Set(['and', 'the', 'for', 'with', 'role', 'senior', 'junior', 'associate']);
const DOMAIN_ACRONYMS = new Set(['ai', 'ml', 'it', 'bi']);
const TECHNICAL_TITLE_HINTS = [
  'software', 'developer', 'development', 'machine learning', 'artificial intelligence', ' ai ', ' ml ',
  'data ', 'analytics', 'business intelligence', 'technology', 'technical', 'cloud', 'devops', 'platform',
  'systems', 'system ', 'application', 'cyber', 'security', 'automation', 'oracle', 'erp', 'solutions',
  'solution ', 'intern', 'student', 'co-op', 'coop', 'new grad', 'graduate', 'computer science', 'digital',
];
const CLEARLY_UNRELATED_TITLE_HINTS = [
  'nurse', 'physician', 'pharmacist', 'driver', 'warehouse', 'cook', 'chef', 'retail associate', 'branch manager',
  'financial advisor', 'mortgage specialist', 'sales representative', 'account executive', 'marketing manager',
  'claims examiner', 'underwriter', 'recruiter', 'human resources', 'legal counsel', 'lawyer',
];

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function stableJobId(source: string, sourceKey: string, externalId: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${source}:${sourceKey}:${externalId}`));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

function titleMatchesTarget(title: string, targets: string[]) {
  const normalizedTitle = normalizeText(title);
  return targets.some((target) => {
    const normalizedTarget = normalizeText(target);
    if (!normalizedTarget) return false;
    if (normalizedTitle.includes(normalizedTarget)) return true;
    const words = normalizedTarget
      .split(' ')
      .filter((word) => (word.length > 2 || DOMAIN_ACRONYMS.has(word)) && !STOP_WORDS.has(word));
    const hits = words.filter((word) => normalizedTitle.includes(word)).length;
    return words.length === 1 ? hits === 1 : hits >= Math.min(2, words.length);
  });
}

function broadTitleRelevant(title: string, profile: CandidateProfile) {
  const normalized = ` ${normalizeText(title)} `;
  if (CLEARLY_UNRELATED_TITLE_HINTS.some((term) => normalized.includes(term))) return false;
  return titleMatchesTarget(title, profile.targetTitles ?? [])
    || TECHNICAL_TITLE_HINTS.some((term) => normalized.includes(term));
}

function locationMatches(locationValue: string | null | undefined, profile: CandidateProfile) {
  const location = normalizeText(locationValue ?? '');
  if (!location) return false;
  const preferred = (profile.preferredLocations ?? []).map(normalizeText).filter(Boolean);
  if (location === 'remote' || location === 'anywhere' || location === 'worldwide') return true;
  if (/\b(canada|ontario|toronto|windsor|waterloo|ottawa|montreal|vancouver|calgary|alberta|british columbia|quebec)\b/.test(location)) return true;
  return preferred.some((place) => location.includes(place) || place.includes(location));
}

function parsePostedOn(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const trimmed = value.trim();
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime()) && /\d{4}/.test(trimmed)) return parsed.toISOString();
  const lower = trimmed.toLowerCase();
  if (lower.includes('today')) return new Date().toISOString();
  const match = lower.match(/posted\s+(\d+)\+?\s+days?\s+ago/);
  if (match) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - Number(match[1]));
    return date.toISOString();
  }
  return null;
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

async function upsert(table: string, rows: unknown[], conflict?: string) {
  if (!rows.length) return;
  const suffix = conflict ? `?on_conflict=${encodeURIComponent(conflict)}` : '';
  await db(`${table}${suffix}`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
}

async function insertIgnore(table: string, rows: unknown[], conflict: string) {
  if (!rows.length) return;
  await db(`${table}?on_conflict=${encodeURIComponent(conflict)}`, {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
}

async function batch<T>(items: T[], size: number, operation: (chunk: T[]) => Promise<void>) {
  for (let index = 0; index < items.length; index += size) await operation(items.slice(index, index + size));
}

async function updateSourceStatus(source: EnterpriseSource, status: 'ok' | 'error', jobCount: number, error?: string) {
  await db(`enterprise_job_sources?id=eq.${source.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      last_checked_at: new Date().toISOString(),
      last_status: status,
      last_error: error ? error.slice(0, 1200) : null,
      last_job_count: jobCount,
      updated_at: new Date().toISOString(),
    }),
  });
}

function workdayConfig(source: EnterpriseSource) {
  const host = String(source.config.host ?? '').trim();
  const tenant = String(source.config.tenant ?? '').trim();
  const site = String(source.config.site ?? '').trim();
  const maxPages = Math.max(1, Math.min(8, Number(source.config.maxPages ?? 5) || 5));
  if (!host || !tenant || !site) throw new Error('Workday source is missing host, tenant or site configuration.');
  return { host, tenant, site, maxPages };
}

type WorkdayListItem = {
  title?: string;
  externalPath?: string;
  locationsText?: string;
  postedOn?: string;
  bulletFields?: string[];
};

async function fetchWorkday(source: EnterpriseSource, profile: CandidateProfile): Promise<Job[]> {
  const { host, tenant, site, maxPages } = workdayConfig(source);
  const base = `https://${host}/wday/cxs/${tenant}/${site}`;
  const candidates: WorkdayListItem[] = [];

  for (let page = 0; page < maxPages; page += 1) {
    const offset = page * PAGE_SIZE;
    const response = await fetch(`${base}/jobs`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'JobAgent/1.0 personal-job-search',
      },
      body: JSON.stringify({ appliedFacets: {}, limit: PAGE_SIZE, offset, searchText: '' }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Workday ${source.company}/${site}: ${response.status}`);
    const payload = await response.json() as { jobPostings?: WorkdayListItem[]; total?: number };
    const postings = payload.jobPostings ?? [];
    candidates.push(...postings);
    if (postings.length < PAGE_SIZE || offset + postings.length >= Number(payload.total ?? Number.MAX_SAFE_INTEGER)) break;
    await sleep(120);
  }

  const broad = [...new Map(candidates
    .filter((item) => item.title && item.externalPath)
    .filter((item) => broadTitleRelevant(item.title!, profile))
    .filter((item) => locationMatches(item.locationsText, profile))
    .map((item) => [item.externalPath!, item])).values()]
    .slice(0, MAX_RELEVANT_PER_SOURCE);

  const jobs: Job[] = [];
  for (let index = 0; index < broad.length; index += 8) {
    const group = broad.slice(index, index + 8);
    const settled = await Promise.allSettled(group.map(async (item) => {
      const detailResponse = await fetch(`${base}${item.externalPath}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'JobAgent/1.0 personal-job-search' },
        signal: AbortSignal.timeout(12_000),
      });
      let info: any = {};
      if (detailResponse.ok) {
        const detail = await detailResponse.json() as any;
        info = detail.jobPostingInfo ?? detail ?? {};
      }
      const externalPath = item.externalPath!;
      const pathId = externalPath.split('_').pop() || externalPath.split('/').filter(Boolean).pop() || externalPath;
      const externalId = String(info.jobReqId ?? info.jobRequisitionId ?? pathId);
      const id = await stableJobId('workday', tenant.toLowerCase(), externalId);
      const directUrl = `https://${host}/en-US/${site}${externalPath}`;
      const location = String(info.location ?? item.locationsText ?? '').trim() || null;
      const description = stripHtml(String(info.jobDescription ?? (item.bulletFields ?? []).join(' ') ?? '')) || `${item.title} at ${source.company}`;
      return {
        id,
        external_id: externalId,
        source: 'workday',
        source_key: tenant.toLowerCase(),
        url: directUrl,
        apply_url: directUrl,
        title: String(info.title ?? item.title),
        company: source.company,
        location,
        description,
        posted_at: parsePostedOn(info.postedOn ?? item.postedOn),
        salary_min: null,
        salary_max: null,
        currency: null,
        salary_text: typeof info.compensationText === 'string' ? stripHtml(info.compensationText) : null,
        employment_type: typeof info.timeType === 'string' ? info.timeType : null,
        remote: /remote|virtual|telecommut/i.test(`${location ?? ''} ${info.remoteType ?? ''}`),
        workplace_type: typeof info.remoteType === 'string' ? info.remoteType : null,
        department: typeof info.jobCategory === 'string' ? info.jobCategory : null,
        raw: { sourceAttribution: `${source.company} careers (Workday)`, site, enterpriseSourceKey: source.source_key },
      } satisfies Job;
    }));
    for (const result of settled) if (result.status === 'fulfilled') jobs.push(result.value);
    await sleep(100);
  }

  return jobs;
}

async function fetchAmazon(source: EnterpriseSource, profile: CandidateProfile): Promise<Job[]> {
  const country = String(source.config.country ?? 'CAN').trim() || 'CAN';
  const maxPages = Math.max(1, Math.min(8, Number(source.config.maxPages ?? 5) || 5));
  const jobs: Job[] = [];

  for (let page = 0; page < maxPages; page += 1) {
    const offset = page * 100;
    const params = new URLSearchParams({ offset: String(offset), result_limit: '100', sort: 'recent' });
    params.append('normalized_country_code[]', country);
    const response = await fetch(`https://www.amazon.jobs/en/search.json?${params.toString()}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'JobAgent/1.0 personal-job-search' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Amazon Jobs: ${response.status}`);
    const payload = await response.json() as any;
    const postings = Array.isArray(payload.jobs) ? payload.jobs : [];
    for (const item of postings) {
      const title = String(item.title ?? '').trim();
      if (!title || !broadTitleRelevant(title, profile)) continue;
      const externalId = String(item.id ?? item.job_id ?? item.job_path ?? '').trim();
      if (!externalId) continue;
      const id = await stableJobId('amazonjobs', 'amazon', externalId);
      const path = String(item.job_path ?? '');
      const directUrl = path.startsWith('http') ? path : `https://www.amazon.jobs${path}`;
      const location = String(item.location ?? item.normalized_location ?? '').trim() || 'Canada';
      const description = stripHtml([
        item.description,
        item.basic_qualifications,
        item.preferred_qualifications,
      ].filter(Boolean).join(' ')) || `${title} at Amazon`;
      jobs.push({
        id,
        external_id: externalId,
        source: 'amazonjobs',
        source_key: 'amazon',
        url: directUrl,
        apply_url: directUrl,
        title,
        company: 'Amazon',
        location,
        description,
        posted_at: parsePostedOn(item.posted_date ?? item.postedDate),
        salary_min: null,
        salary_max: null,
        currency: null,
        salary_text: null,
        employment_type: item.schedule_type ? String(item.schedule_type) : null,
        remote: /remote|virtual/i.test(location),
        workplace_type: /remote|virtual/i.test(location) ? 'Remote' : null,
        department: item.job_category ? String(item.job_category) : item.business_category ? String(item.business_category) : null,
        raw: { sourceAttribution: 'Amazon Jobs', enterpriseSourceKey: source.source_key },
      });
    }
    const total = Number(payload.hits ?? 0);
    if (!postings.length || offset + postings.length >= total) break;
    await sleep(150);
  }

  return [...new Map(jobs.map((job) => [job.id, job])).values()].slice(0, MAX_RELEVANT_PER_SOURCE);
}

function jobRow(job: Job, now: string) {
  return {
    id: job.id,
    external_id: job.external_id,
    source: job.source,
    source_key: job.source_key,
    url: job.url,
    apply_url: job.apply_url,
    title: job.title,
    company: job.company,
    location: job.location,
    description: job.description,
    posted_at: job.posted_at,
    last_seen_at: now,
    salary_min: job.salary_min,
    salary_max: job.salary_max,
    currency: job.currency,
    salary_text: job.salary_text,
    employment_type: job.employment_type,
    remote: job.remote,
    workplace_type: job.workplace_type,
    department: job.department,
    raw: job.raw,
  };
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const profileRows = await db('candidate_profiles?id=eq.default&select=profile&limit=1');
    const profile = profileRows?.[0]?.profile as CandidateProfile | undefined;
    if (!profile) throw new Error('Candidate profile is not configured.');

    const sources = await db('enterprise_job_sources?enabled=eq.true&select=id,kind,source_key,company,config,enabled&order=id.asc') as EnterpriseSource[];
    const allJobs: Job[] = [];
    const errors: string[] = [];
    const perSource: Array<{ company: string; source: string; status: string; jobs: number }> = [];

    for (const source of sources) {
      try {
        const jobs = source.kind === 'workday'
          ? await fetchWorkday(source, profile)
          : await fetchAmazon(source, profile);
        allJobs.push(...jobs);
        await updateSourceStatus(source, 'ok', jobs.length);
        perSource.push({ company: source.company, source: source.source_key, status: 'ok', jobs: jobs.length });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${source.company}/${source.source_key}: ${message}`);
        await updateSourceStatus(source, 'error', 0, message);
        perSource.push({ company: source.company, source: source.source_key, status: 'error', jobs: 0 });
      }
      await sleep(100);
    }

    const deduped = [...new Map(allJobs.map((job) => [job.id, job])).values()];
    const now = new Date().toISOString();
    await batch(deduped.map((job) => jobRow(job, now)), 80, (rows) => upsert('jobs', rows, 'id'));
    await batch(deduped.map((job) => ({ job_id: job.id, status: 'discovered', updated_at: now })), 100, (rows) => insertIgnore('applications', rows, 'job_id'));
    await upsert('activity_log', [{
      event: 'enterprise.discovery.completed',
      payload: { sources: sources.length, relevant: deduped.length, errors, perSource },
      created_at: now,
    }]);

    return new Response(JSON.stringify({
      ok: true,
      sources: sources.length,
      relevant: deduped.length,
      errors,
      perSource,
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      await upsert('activity_log', [{ event: 'enterprise.discovery.failed', payload: { error: message }, created_at: new Date().toISOString() }]);
    } catch { /* best-effort audit */ }
    return new Response(JSON.stringify({ ok: false, error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
