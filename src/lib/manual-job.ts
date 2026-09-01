import type { Job } from './types';
import { normalizeText, stableJobId } from './utils';

export interface ManualJobInput {
  title?: unknown;
  company?: unknown;
  description?: unknown;
  location?: unknown;
  url?: unknown;
}

export class ManualJobInputError extends Error {}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function requiredText(value: unknown, label: string, maxLength: number) {
  const cleaned = text(value);
  if (!cleaned) throw new ManualJobInputError(`${label} is required.`);
  if (cleaned.length > maxLength) throw new ManualJobInputError(`${label} is too long.`);
  return cleaned;
}

function optionalText(value: unknown, label: string, maxLength: number) {
  const cleaned = text(value);
  if (cleaned.length > maxLength) throw new ManualJobInputError(`${label} is too long.`);
  return cleaned || undefined;
}

function cleanDescription(value: unknown) {
  const description = requiredText(value, 'Job description', 60_000)
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (normalizeText(description).length < 100) {
    throw new ManualJobInputError('Paste at least 100 characters from the job description so its requirements can be analyzed.');
  }
  return description;
}

function cleanUrl(value: unknown) {
  const raw = optionalText(value, 'Job link', 2_048);
  if (!raw) return undefined;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Unsupported protocol');
    return url.toString();
  } catch {
    throw new ManualJobInputError('Enter a valid http or https job link.');
  }
}

export function buildManualJob(input: ManualJobInput, now = new Date().toISOString()): Job {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ManualJobInputError('Invalid job details.');
  }

  const title = requiredText(input.title, 'Job title', 200);
  const company = requiredText(input.company, 'Company', 200);
  const description = cleanDescription(input.description);
  const location = optionalText(input.location, 'Location', 200);
  const url = cleanUrl(input.url);
  const externalId = stableJobId('manual-description', company, `${title}:${normalizeText(description)}`);
  const id = stableJobId('manual', 'dashboard', externalId);

  return {
    id,
    externalId,
    source: 'manual',
    sourceKey: 'dashboard',
    url: url ?? '#',
    applyUrl: url,
    title,
    company,
    location,
    description,
    discoveredAt: now,
    lastSeenAt: now,
    validityStatus: 'unknown',
    healthScore: url ? 50 : 40,
    verificationSignals: ['Job description entered manually in the dashboard.'],
    verificationMethod: 'manual-entry',
    raw: { manualEntry: true, enteredAt: now },
  };
}
