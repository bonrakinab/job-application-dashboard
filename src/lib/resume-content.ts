import type { ApplicationPack, CandidateProfile } from './types';
import { normalizeText } from './utils';

const MONTHS: Record<string, string> = {
  jan: '01', january: '01',
  feb: '02', february: '02',
  mar: '03', march: '03',
  apr: '04', april: '04',
  may: '05',
  jun: '06', june: '06',
  jul: '07', july: '07',
  aug: '08', august: '08',
  sep: '09', sept: '09', september: '09',
  oct: '10', october: '10',
  nov: '11', november: '11',
  dec: '12', december: '12',
};

const DISPLAY_MONTHS: Record<string, string> = {
  '01': 'Jan', '02': 'Feb', '03': 'March', '04': 'April', '05': 'May', '06': 'June',
  '07': 'July', '08': 'Aug', '09': 'Sept', '10': 'Oct', '11': 'Nov', '12': 'Dec',
};

export function formatAtsDate(value?: string) {
  const raw = value?.trim();
  if (!raw) return '';
  if (/^(present|current|now)$/i.test(raw)) return 'Present';

  const qualifier = /\b(expected|anticipated)\b/i.test(raw)
    ? ` (${raw.match(/\b(expected|anticipated)\b/i)?.[1]})`
    : '';
  const cleaned = raw.replace(/[()]/g, ' ').replace(/\b(expected|anticipated)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  const numeric = cleaned.match(/^(0?[1-9]|1[0-2])[\/.\-](19|20)\d{2}$/);
  if (numeric) return `${numeric[1].padStart(2, '0')}/${cleaned.slice(-4)}${qualifier}`;
  const iso = cleaned.match(/^((?:19|20)\d{2})-(0[1-9]|1[0-2])$/);
  if (iso) return `${iso[2]}/${iso[1]}${qualifier}`;
  const named = cleaned.match(/^([A-Za-z]+)\.?\s+((?:19|20)\d{2})$/);
  if (named) {
    const month = MONTHS[named[1].toLowerCase()];
    if (month) return `${month}/${named[2]}${qualifier}`;
  }
  const year = cleaned.match(/^(19|20)\d{2}$/);
  if (year) return `${cleaned}${qualifier}`;
  return raw;
}

export function formatAtsDateRange(start?: string, end?: string) {
  return [formatAtsDate(start), formatAtsDate(end)].filter(Boolean).join(' - ');
}

/** Human-readable month/year dates used by the uploaded LaTeX reference. */
export function formatResumeDate(value?: string) {
  const raw = value?.trim();
  if (!raw) return '';
  if (/^(present|current|now)$/i.test(raw)) return 'Present';
  const qualifier = /\b(expected|anticipated)\b/i.test(raw)
    ? ` (${raw.match(/\b(expected|anticipated)\b/i)?.[1]})`
    : '';
  const cleaned = raw.replace(/[()]/g, ' ').replace(/\b(expected|anticipated)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  const ats = formatAtsDate(cleaned).replace(/\s+\((?:Expected|Anticipated)\)$/i, '');
  const numeric = ats.match(/^(0[1-9]|1[0-2])\/((?:19|20)\d{2})$/);
  if (numeric) return `${DISPLAY_MONTHS[numeric[1]]} ${numeric[2]}${qualifier}`;
  if (/^(?:19|20)\d{2}$/.test(ats)) return `${ats}${qualifier}`;
  return `${cleaned}${qualifier}`.trim();
}

export function formatResumeDateRange(start?: string, end?: string) {
  return [formatResumeDate(start), formatResumeDate(end)].filter(Boolean).join(' - ');
}

/**
 * The canonical reference does not print a separate technology suffix on
 * project headings. Project-specific tools should appear naturally in the
 * tailored bullet or in Skills, not as an extra visual metadata line.
 */
export function selectedProjectSkills(_profile: CandidateProfile, _pack: ApplicationPack, _projectName: string) {
  return [] as string[];
}

export function resumeContactLines(profile: CandidateProfile) {
  const primary = [profile.phone, profile.email, profile.location].filter(Boolean) as string[];
  const links = Object.entries(profile.links ?? {})
    .filter(([, value]) => value?.trim())
    .map(([label, value]) => `${label}: ${value.replace(/^https?:\/\/(?:www\.)?/i, '').replace(/\/$/, '')}`);
  return { primary, links };
}

/** Compact labels shown on the single contact row in the reference resume. */
export function resumeTemplateContactItems(profile: CandidateProfile) {
  const primary = [profile.phone, profile.email, profile.location].filter(Boolean) as string[];
  const links = Object.entries(profile.links ?? {})
    .filter(([, value]) => value?.trim())
    .map(([rawLabel]) => {
      const label = normalizeText(rawLabel);
      if (label.includes('linkedin')) return profile.name || 'LinkedIn';
      if (label.includes('github')) return 'GitHub';
      if (label.includes('portfolio') || label.includes('website')) return 'Portfolio';
      return rawLabel.replace(/(^|\s)\S/g, (character) => character.toUpperCase());
    });
  return [...primary, ...links];
}

/** The exact text exposed to an ATS by both generated resume formats. */
export function visibleResumeText(profile: CandidateProfile, pack: ApplicationPack) {
  return [
    profile.name,
    pack.resumeHeadline,
    ...resumeTemplateContactItems(profile),
    'PROFESSIONAL SUMMARY',
    pack.resumeSummary,
    'EXPERIENCE',
    ...pack.experience.flatMap((item) => {
      const source = (profile.experience ?? []).find((candidate) => normalizeText(candidate.organization) === normalizeText(item.organization)
        && normalizeText(candidate.title) === normalizeText(item.title));
      return [
        item.organization,
        item.title,
        source?.location ?? '',
        formatResumeDateRange(source?.start, source?.end),
        ...item.bullets,
      ];
    }),
    'SKILLS',
    ...pack.skills,
    ...(pack.projects.length ? [
      'PROJECTS',
      ...pack.projects.flatMap((project) => [project.name, ...project.bullets]),
    ] : []),
    'EDUCATION',
    ...(profile.degrees ?? []).flatMap((degree) => [
      degree.institution,
      [degree.degree, degree.field].filter(Boolean).join(' - ') + (degree.gpa ? `; GPA: ${degree.gpa}` : ''),
      degree.location ?? '',
      formatResumeDateRange(degree.start, degree.end),
    ]),
    ...((pack.certifications ?? []).length ? ['CERTIFICATIONS', ...(pack.certifications ?? [])] : []),
    ...((pack.publications ?? []).length ? ['PUBLICATIONS', ...(pack.publications ?? [])] : []),
  ].filter(Boolean).join('\n');
}

export function renderedDates(profile: CandidateProfile, pack: ApplicationPack) {
  const selectedRoles = new Set(pack.experience.map((item) => `${normalizeText(item.organization)}|${normalizeText(item.title)}`));
  return [
    ...(profile.experience ?? [])
      .filter((item) => selectedRoles.has(`${normalizeText(item.organization)}|${normalizeText(item.title)}`))
      .flatMap((item) => [formatResumeDate(item.start), formatResumeDate(item.end)]),
    ...(profile.degrees ?? []).flatMap((item) => [formatResumeDate(item.start), formatResumeDate(item.end)]),
  ].filter(Boolean);
}

export function isStandardAtsDate(value: string) {
  return /^(?:(?:0[1-9]|1[0-2])\/(?:19|20)\d{2}|(?:19|20)\d{2}|(?:Jan|Feb|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug|Sept?|Oct|Nov|Dec)\s+(?:19|20)\d{2}|Present)(?: \((?:Expected|Anticipated)\))?$/i.test(value);
}
