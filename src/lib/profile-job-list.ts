import type { ApplicationRecord, CandidateProfileId, JobWithMatch, MatchScore } from './types';
import { demoJobs } from './demo';
import { profileIdForJob } from './part-time-jobs';
import { supabaseConfigured, supabaseRequest } from './supabase-rest';

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

export async function listJobsForProfile(profileId: CandidateProfileId, limit = 100): Promise<JobWithMatch[]> {
  if (!supabaseConfigured) {
    return demoJobs.filter((job) => profileIdForJob(job) === profileId).slice(0, limit);
  }

  const requested = Math.max(1, Math.min(limit, 3000));
  const pageSize = 500;
  const rows: any[] = [];

  for (let offset = 0; offset < requested; offset += pageSize) {
    const size = Math.min(pageSize, requested - offset);
    const path = `jobs?application_profile_id=eq.${encodeURIComponent(profileId)}&select=*,job_matches(*),applications(*)&order=discovered_at.desc&limit=${size}&offset=${offset}`;
    const page = await supabaseRequest<any[]>(path);
    rows.push(...page);
    if (page.length < size) break;
  }

  return [...new Map(rows.map((row) => [row.id, row])).values()].map(rowToJob);
}
