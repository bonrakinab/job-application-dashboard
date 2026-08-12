import type { Job, JobValidityStatus, JobValidityVerification } from './types';
import { normalizeText } from './utils';

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

function seenRecently(lastSeenAt?: string) {
  if (!lastSeenAt) return false;
  const time = Date.parse(lastSeenAt);
  return Number.isFinite(time) && Date.now() - time <= 48 * 60 * 60 * 1000;
}

function workdayDetailUrl(job: Job) {
  try {
    const direct = new URL(job.url);
    const raw = (job.raw ?? {}) as Record<string, unknown>;
    const site = String(raw.site ?? '').trim();
    if (!site) return null;
    const prefix = `/en-US/${site}`;
    const externalPath = direct.pathname.startsWith(prefix) ? direct.pathname.slice(prefix.length) : '';
    if (!externalPath) return null;
    return `https://${direct.host}/wday/cxs/${encodeURIComponent(job.sourceKey)}/${encodeURIComponent(site)}/job${externalPath}`;
  } catch {
    return null;
  }
}

function verificationUrl(job: Job) {
  if (job.source === 'greenhouse') {
    return `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(job.sourceKey)}/jobs/${encodeURIComponent(job.externalId)}`;
  }
  if (job.source === 'lever') {
    return `https://api.lever.co/v0/postings/${encodeURIComponent(job.sourceKey)}/${encodeURIComponent(job.externalId)}?mode=json`;
  }
  if (job.source === 'workday') return workdayDetailUrl(job) ?? job.applyUrl ?? job.url;
  return job.applyUrl ?? job.url;
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

function result(
  status: JobValidityStatus,
  healthScore: number,
  signals: string[],
  options: Partial<JobValidityVerification> = {},
): JobValidityVerification {
  return {
    validityStatus: status,
    healthScore,
    lastVerifiedAt: new Date().toISOString(),
    verificationSignals: signals,
    verificationMethod: options.verificationMethod ?? 'http',
    applyUrlStatus: options.applyUrlStatus,
    closureReason: options.closureReason,
  };
}

export function classifyJobVerification(input: {
  job: Pick<Job, 'title' | 'url' | 'lastSeenAt'>;
  status: number;
  finalUrl: string;
  body: string;
  structuredActive?: boolean;
}) {
  const recent = seenRecently(input.job.lastSeenAt);
  const normalizedBody = normalizeText(input.body).slice(0, 400_000);
  const originalUrl = input.job.url;

  if (input.structuredActive) {
    return result('active', 100, ['The job is present in the source ATS/API.', ...(recent ? ['Seen in discovery within the last 48 hours.'] : [])], {
      applyUrlStatus: input.status,
      verificationMethod: 'source-api',
    });
  }

  if (input.status === 404 || input.status === 410) {
    return result('closed', 5, [`Source returned HTTP ${input.status}.`], {
      applyUrlStatus: input.status,
      closureReason: `The source returned HTTP ${input.status}.`,
    });
  }

  const closedPhrase = CLOSED_PATTERNS.find((pattern) => normalizedBody.includes(pattern));
  if (closedPhrase) {
    return result('closed', 5, [`Closure language detected: “${closedPhrase}”.`], {
      applyUrlStatus: input.status,
      closureReason: `Closure language detected: ${closedPhrase}.`,
    });
  }

  if (input.status >= 400) {
    if (recent) {
      return result('likely_active', 72, [`Verification request returned HTTP ${input.status}, but the job was seen in its discovery source within 48 hours.`], {
        applyUrlStatus: input.status,
        verificationMethod: 'feed+http',
      });
    }
    return result('unknown', 45, [`Verification request returned HTTP ${input.status}; this is not treated as proof that the job is closed.`], {
      applyUrlStatus: input.status,
    });
  }

  if (genericRedirectLooksClosed(originalUrl, input.finalUrl)) {
    return result('likely_closed', 30, ['The job-specific URL redirected to a generic careers/jobs page.'], {
      applyUrlStatus: input.status,
      closureReason: 'The job-specific URL redirected to a generic careers/jobs page.',
    });
  }

  const title = normalizeText(input.job.title);
  const titlePresent = title.length >= 5 && normalizedBody.includes(title);
  if (titlePresent) {
    return result('active', recent ? 98 : 92, ['The live page still contains the job title.', ...(recent ? ['Seen in discovery within the last 48 hours.'] : [])], {
      applyUrlStatus: input.status,
    });
  }

  if (input.status >= 200 && input.status < 300) {
    return result(recent ? 'likely_active' : 'likely_active', recent ? 88 : 80, [
      'The job-specific URL returned a successful response.',
      ...(recent ? ['Seen in discovery within the last 48 hours.'] : []),
    ], { applyUrlStatus: input.status });
  }

  return result('unknown', 50, ['Availability could not be confirmed.'], { applyUrlStatus: input.status });
}

export async function verifyJobAvailability(job: Job): Promise<JobValidityVerification> {
  const url = verificationUrl(job);
  if (!url || url === '#') {
    return result('unknown', 40, ['No usable application/source URL is available.'], {
      verificationMethod: 'none',
      closureReason: 'No usable application/source URL is available.',
    });
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        Accept: job.source === 'workday' || job.source === 'greenhouse' || job.source === 'lever' ? 'application/json,text/html;q=0.9,*/*;q=0.8' : 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.8',
        'User-Agent': 'JobApplicationDashboard/1.0 personal-job-search',
      },
      signal: AbortSignal.timeout(12_000),
    });

    const body = await response.text();
    let structuredActive = false;
    if (response.ok && ['workday', 'greenhouse', 'lever'].includes(job.source)) {
      try {
        const parsed = JSON.parse(body) as Record<string, unknown>;
        structuredActive = job.source === 'workday'
          ? Boolean(parsed.jobPostingInfo && typeof parsed.jobPostingInfo === 'object')
          : Boolean(parsed && Object.keys(parsed).length);
      } catch {
        structuredActive = false;
      }
    }

    return classifyJobVerification({
      job,
      status: response.status,
      finalUrl: response.url || url,
      body,
      structuredActive,
    });
  } catch (error) {
    const recent = seenRecently(job.lastSeenAt);
    const message = error instanceof Error ? error.message : String(error);
    return result(recent ? 'likely_active' : 'unknown', recent ? 70 : 45, [
      `Verification request failed (${message.slice(0, 140)}).`,
      ...(recent ? ['The job was seen in its discovery source within 48 hours.'] : []),
    ], { verificationMethod: recent ? 'feed+http' : 'http' });
  }
}

export function isJobClosed(status?: JobValidityStatus) {
  return status === 'closed' || status === 'likely_closed';
}

export function validityLabel(status?: JobValidityStatus) {
  if (status === 'active') return 'Verified active';
  if (status === 'likely_active') return 'Likely active';
  if (status === 'likely_closed') return 'Likely closed';
  if (status === 'closed') return 'Closed';
  return 'Unverified';
}
