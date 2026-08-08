import type { ApplicationPack, ApplicationRecord, ApplicationStatus, CandidateProfile, CompanyIntelligence, DashboardStats, Job, JobWithMatch, MatchScore } from './types';
import { demoJobs, demoProfile } from './demo';
import { jsonEnv } from './utils';
import { insertIgnoreRows, patchRows, supabaseConfigured, supabaseRequest, upsertRows } from './supabase-rest';

function jobToRow(job: Job) {
  return {
    id: job.id,
    external_id: job.externalId,
    source: job.source,
    source_key: job.sourceKey,
    url: job.url,
    apply_url: job.applyUrl,
    title: job.title,
    company: job.company,
    location: job.location,
    description: job.description,
    posted_at: job.postedAt,
    last_seen_at: new Date().toISOString(),
    salary_min: job.salaryMin,
    salary_max: job.salaryMax,
    currency: job.currency,
    salary_text: job.salaryText,
    employment_type: job.employmentType,
    remote: job.remote,
    workplace_type: job.workplaceType,
    department: job.department,
    raw: job.raw,
  };
}

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
  } : undefined;
  const application: ApplicationRecord | undefined = appRow ? {
    id: String(appRow.id), jobId: row.id, status: appRow.status, appliedAt: appRow.applied_at, responseAt: appRow.response_at, notes: appRow.notes, createdAt: appRow.created_at, updatedAt: appRow.updated_at,
  } : undefined;
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
    salaryMin: row.salary_min == null ? undefined : Number(row.salary_min),
    salaryMax: row.salary_max == null ? undefined : Number(row.salary_max),
    currency: row.currency,
    salaryText: row.salary_text,
    employmentType: row.employment_type,
    remote: row.remote,
    workplaceType: row.workplace_type,
    department: row.department,
    match,
    application,
  };
}

export function isLiveMode() { return supabaseConfigured; }

export async function getCandidateProfile(): Promise<CandidateProfile> {
  if (!supabaseConfigured) return jsonEnv<CandidateProfile>('CANDIDATE_PROFILE_JSON') ?? demoProfile;
  const rows = await supabaseRequest<Array<{ profile: CandidateProfile }>>('candidate_profiles?id=eq.default&select=profile&limit=1');
  return rows[0]?.profile ?? jsonEnv<CandidateProfile>('CANDIDATE_PROFILE_JSON') ?? demoProfile;
}

export async function saveCandidateProfile(profile: CandidateProfile) {
  if (!supabaseConfigured) throw new Error('Supabase is required to persist the candidate profile.');
  await upsertRows('candidate_profiles', [{ id: 'default', profile, updated_at: new Date().toISOString() }], 'id');
}

export async function saveDiscoveredJobs(jobs: Job[]) {
  if (!supabaseConfigured || !jobs.length) return jobs;
  await upsertRows('jobs', jobs.map(jobToRow), 'id');
  await insertIgnoreRows('applications', jobs.map((j) => ({ job_id: j.id, status: 'discovered', updated_at: new Date().toISOString() })), 'job_id');
  return jobs;
}

export async function saveMatch(jobId: string, match: MatchScore) {
  if (!supabaseConfigured) return;
  await upsertRows('job_matches', [{
    job_id: jobId,
    overall: match.overall,
    skills: match.skills,
    experience: match.experience,
    education: match.education,
    domain: match.domain,
    location: match.location,
    recommendation: match.recommendation,
    blockers: match.blockers,
    strengths: match.strengths,
    gaps: match.gaps,
    must_have: match.mustHave,
    preferred: match.preferred,
    matched_skills: match.matchedSkills,
    missing_skills: match.missingSkills,
    explanation: match.explanation,
    model: match.model,
    analyzed_at: new Date().toISOString(),
  }], 'job_id');
}

export async function listJobs(limit = 100): Promise<JobWithMatch[]> {
  if (!supabaseConfigured) return demoJobs;
  const path = `jobs?select=*,job_matches(*),applications(*)&order=discovered_at.desc&limit=${Math.min(limit, 500)}`;
  const rows = await supabaseRequest<any[]>(path);
  return rows.map(rowToJob);
}

export async function getJob(id: string): Promise<JobWithMatch | null> {
  if (!supabaseConfigured) return demoJobs.find((j) => j.id === id) ?? null;
  const rows = await supabaseRequest<any[]>(`jobs?id=eq.${encodeURIComponent(id)}&select=*,job_matches(*),applications(*)&limit=1`);
  return rows[0] ? rowToJob(rows[0]) : null;
}

export async function listUnanalyzedJobs(limit = 40): Promise<JobWithMatch[]> {
  const jobs = await listJobs(300);
  return jobs.filter((job) => !job.match).slice(0, limit);
}

export async function updateApplicationStatus(jobId: string, status: ApplicationStatus, notes?: string) {
  if (!supabaseConfigured) return;
  const now = new Date().toISOString();
  const values: Record<string, unknown> = { status, updated_at: now };
  if (notes !== undefined) values.notes = notes;
  if (status === 'applied') values.applied_at = now;
  if (['interview','rejected','offer'].includes(status)) values.response_at = now;
  await patchRows(`applications?job_id=eq.${encodeURIComponent(jobId)}`, values);
}

export async function saveApplicationPack(jobId: string, pack: ApplicationPack, model?: string) {
  if (!supabaseConfigured) return;
  await upsertRows('documents', [
    { job_id: jobId, kind: 'application_pack', content_json: pack, content_text: pack.coverLetter, model, created_at: new Date().toISOString() },
  ], 'job_id,kind');
}

export async function getApplicationPack(jobId: string): Promise<ApplicationPack | null> {
  if (!supabaseConfigured) return null;
  const rows = await supabaseRequest<Array<{ content_json: ApplicationPack }>>(`documents?job_id=eq.${encodeURIComponent(jobId)}&kind=eq.application_pack&select=content_json&limit=1`);
  return rows[0]?.content_json ?? null;
}

export async function getDashboardStats(jobs?: JobWithMatch[]): Promise<DashboardStats> {
  const list = jobs ?? await listJobs();
  return {
    discovered: list.length,
    recommended: list.filter((j) => j.match && ['exceptional','strong'].includes(j.match.recommendation)).length,
    applied: list.filter((j) => ['applied','interview','rejected','offer'].includes(j.application?.status ?? '')).length,
    interviews: list.filter((j) => j.application?.status === 'interview').length,
    offers: list.filter((j) => j.application?.status === 'offer').length,
  };
}

export async function logActivity(event: string, jobId?: string, payload?: unknown) {
  if (!supabaseConfigured) return;
  await upsertRows('activity_log', [{ event, job_id: jobId, payload }]);
}

export async function saveCompanyIntelligence(company: string, intelligence: CompanyIntelligence) {
  if (!supabaseConfigured) return;
  await upsertRows('companies', [{ name: company, intelligence, updated_at: new Date().toISOString() }], 'name');
}

export async function getCompanyIntelligence(company: string): Promise<CompanyIntelligence | null> {
  if (!supabaseConfigured) return null;
  const rows = await supabaseRequest<Array<{ intelligence: CompanyIntelligence | null }>>(`companies?name=eq.${encodeURIComponent(company)}&select=intelligence&limit=1`);
  return rows[0]?.intelligence ?? null;
}

export async function saveJobSource(kind: 'greenhouse' | 'lever' | 'ashby', sourceKey: string, company: string) {
  if (!supabaseConfigured) throw new Error('Supabase is required to persist job sources.');
  await upsertRows('job_sources', [{ kind, source_key: sourceKey.trim(), company: company.trim(), enabled: true }], 'kind,source_key');
}

export async function disableJobSource(kind: 'greenhouse' | 'lever' | 'ashby', sourceKey: string, company: string) {
  if (!supabaseConfigured) throw new Error('Supabase is required to persist job sources.');
  await upsertRows('job_sources', [{ kind, source_key: sourceKey.trim(), company: company.trim() || sourceKey.trim(), enabled: false }], 'kind,source_key');
}
