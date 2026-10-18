import type { ApplicationRecord, JobWithMatch, MatchScore } from './types';
import { supabaseAuthHeaders, supabaseConfigured, supabaseRequest } from './supabase-rest';

const baseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/$/, '');
const apiKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

function rowToJob(row: any): JobWithMatch {
  const matchRow = Array.isArray(row.job_matches) ? row.job_matches[0] : row.job_matches;
  const appRow = Array.isArray(row.applications) ? row.applications[0] : row.applications;
  const match: MatchScore | undefined = matchRow ? {
    jobId: row.id,
    overall: matchRow.overall,
    skills: matchRow.skills,
    experience: matchRow.experience,
    education: matchRow.education,
    domain: matchRow.domain,
    location: matchRow.location,
    recommendation: matchRow.recommendation,
    blockers: matchRow.blockers ?? [],
    strengths: matchRow.strengths ?? [],
    gaps: matchRow.gaps ?? [],
    mustHave: matchRow.must_have ?? [],
    preferred: matchRow.preferred ?? [],
    matchedSkills: matchRow.matched_skills ?? [],
    missingSkills: matchRow.missing_skills ?? [],
    explanation: matchRow.explanation ?? '',
    analyzedAt: matchRow.analyzed_at,
    model: matchRow.model,
    profileId: matchRow.profile_id ?? undefined,
    startupFit: matchRow.startup_fit == null ? undefined : Number(matchRow.startup_fit),
  } : undefined;

  const application: ApplicationRecord | undefined = appRow ? {
    id: String(appRow.id),
    jobId: row.id,
    status: appRow.status,
    appliedAt: appRow.applied_at,
    responseAt: appRow.response_at,
    notes: appRow.notes,
    createdAt: appRow.created_at,
    updatedAt: appRow.updated_at,
  } : undefined;

  const raw = row.raw;
  const yc = raw && typeof raw === 'object' && raw.yc && typeof raw.yc === 'object' ? raw.yc : undefined;

  return {
    id: row.id,
    externalId: row.external_id,
    source: row.source,
    sourceKey: row.source_key,
    url: row.url,
    applyUrl: row.apply_url,
    title: row.title,
    company: row.company,
    location: row.location,
    description: row.description,
    postedAt: row.posted_at,
    discoveredAt: row.discovered_at,
    lastSeenAt: row.last_seen_at,
    salaryMin: row.salary_min == null ? undefined : Number(row.salary_min),
    salaryMax: row.salary_max == null ? undefined : Number(row.salary_max),
    currency: row.currency,
    salaryText: row.salary_text,
    employmentType: row.employment_type,
    remote: row.remote,
    workplaceType: row.workplace_type,
    department: row.department,
    validityStatus: row.validity_status ?? 'unknown',
    healthScore: row.health_score == null ? 50 : Number(row.health_score),
    lastVerifiedAt: row.last_verified_at,
    applyUrlStatus: row.apply_url_status == null ? undefined : Number(row.apply_url_status),
    verificationSignals: row.verification_signals ?? [],
    closureReason: row.closure_reason,
    verificationMethod: row.verification_method,
    applicationProfileId: row.application_profile_id ?? undefined,
    yc,
    raw,
    match,
    application,
  };
}

export async function listCompleteCareerJobs(limit = 100000): Promise<JobWithMatch[]> {
  if (!supabaseConfigured) return [];
  const requested = Math.max(1, Math.min(limit, 100000));
  const pageSize = 1000;
  const rows: any[] = [];

  for (let offset = 0; offset < requested; offset += pageSize) {
    const size = Math.min(pageSize, requested - offset);
    const path = `jobs?select=*,job_matches(*),applications(*)&order=discovered_at.desc&limit=${size}&offset=${offset}`;
    const page = await supabaseRequest<any[]>(path);
    rows.push(...page);
    if (page.length < size) break;
  }

  return [...new Map(rows.map((row) => [row.id, row])).values()].map(rowToJob);
}

function safeSearchTerm(value: string) {
  return value.trim().replace(/[(),]/g, ' ').replace(/\s+/g, ' ').slice(0, 120);
}

export async function listFortune500CatalogPage({
  page = 1,
  pageSize = 100,
  company,
  query,
}: {
  page?: number;
  pageSize?: number;
  company?: string;
  query?: string;
} = {}) {
  if (!supabaseConfigured || !baseUrl || !apiKey) {
    return { jobs: [] as JobWithMatch[], total: 0, page: 1, pageSize: 100, pageCount: 1 };
  }

  const normalizedPage = Math.max(1, Math.floor(page));
  const normalizedSize = Math.max(25, Math.min(250, Math.floor(pageSize)));
  const offset = (normalizedPage - 1) * normalizedSize;
  const params = new URLSearchParams({
    select: '*',
    order: 'catalog_sort_at.desc.nullslast,company.asc,title.asc',
    limit: String(normalizedSize),
    offset: String(offset),
  });

  if (company && company !== 'all') params.set('company', `eq.${company}`);
  const term = safeSearchTerm(query ?? '');
  if (term) params.set('or', `(title.ilike.*${term}*,location.ilike.*${term}*,company.ilike.*${term}*)`);

  const response = await fetch(`${baseUrl}/rest/v1/fortune500_catalog_current?${params.toString()}`, {
    headers: {
      ...supabaseAuthHeaders(apiKey),
      Prefer: 'count=exact',
    },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Fortune catalog ${response.status}: ${(await response.text()).slice(0, 500)}`);

  const rows = await response.json() as any[];
  const contentRange = response.headers.get('content-range') ?? '';
  const totalText = contentRange.split('/')[1];
  const total = totalText && totalText !== '*' ? Number(totalText) || 0 : rows.length;
  const pageCount = Math.max(1, Math.ceil(total / normalizedSize));
  const safePage = Math.min(normalizedPage, pageCount);

  return {
    jobs: rows.map(rowToJob),
    total,
    page: safePage,
    pageSize: normalizedSize,
    pageCount,
  };
}

export async function listFortune500CatalogCompanyCounts() {
  if (!supabaseConfigured) return new Map<string, number>();
  const rows = await supabaseRequest<Array<{ company: string; current_openings: number | string }>>(
    'fortune500_catalog_company_counts?select=company,current_openings&order=company.asc&limit=1000',
  );
  return new Map(rows.map((row) => [row.company, Number(row.current_openings) || 0]));
}

export type FortuneSourceCoverage = {
  totalSources: number;
  completedSources: number;
  errorSources: number;
  pendingSources: number;
  lastCheckedAt?: string;
};

export async function listFortune500SourceCoverage() {
  if (!supabaseConfigured) return new Map<string, FortuneSourceCoverage>();
  const rows = await supabaseRequest<Array<{
    company: string;
    last_checked_at?: string | null;
    last_status?: string | null;
  }>>('fortune_job_sources?enabled=eq.true&select=company,last_checked_at,last_status&order=company.asc&limit=5000');

  const result = new Map<string, FortuneSourceCoverage>();
  for (const row of rows) {
    const current = result.get(row.company) ?? {
      totalSources: 0,
      completedSources: 0,
      errorSources: 0,
      pendingSources: 0,
    };
    current.totalSources += 1;
    if (row.last_status === 'ok') current.completedSources += 1;
    else if (row.last_status === 'error') current.errorSources += 1;
    else current.pendingSources += 1;
    if (row.last_checked_at && (!current.lastCheckedAt || row.last_checked_at > current.lastCheckedAt)) {
      current.lastCheckedAt = row.last_checked_at;
    }
    result.set(row.company, current);
  }
  return result;
}
