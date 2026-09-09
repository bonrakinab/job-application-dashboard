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

export function selectedProjectSkills(profile: CandidateProfile, pack: ApplicationPack, projectName: string) {
  const project = (profile.projects ?? []).find((item) => normalizeText(item.name) === normalizeText(projectName));
  const selected = new Set(pack.skills.map(normalizeText));
  return (project?.skills ?? []).filter((skill) => selected.has(normalizeText(skill))).slice(0, 6);
}

export function resumeContactLines(profile: CandidateProfile) {
  const primary = [profile.phone, profile.email, profile.location].filter(Boolean) as string[];
  const links = Object.entries(profile.links ?? {})
    .filter(([, value]) => value?.trim())
    .map(([label, value]) => `${label}: ${value.replace(/^https?:\/\/(?:www\.)?/i, '').replace(/\/$/, '')}`);
  return { primary, links };
}

/** The exact text exposed to an ATS by both generated formats. */
export function visibleResumeText(profile: CandidateProfile, pack: ApplicationPack) {
  const contact = resumeContactLines(profile);
  return [
    profile.name,
    pack.resumeHeadline,
    ...contact.primary,
    ...contact.links,
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
        formatAtsDateRange(source?.start, source?.end),
        ...item.bullets,
      ];
    }),
    'SKILLS',
    ...pack.skills,
    ...(pack.projects.length ? [
      'PROJECTS',
      ...pack.projects.flatMap((project) => [
        project.name,
        ...selectedProjectSkills(profile, pack, project.name),
        ...project.bullets,
      ]),
    ] : []),
    'EDUCATION',
    ...(profile.degrees ?? []).flatMap((degree) => [
      degree.institution,
      [degree.degree, degree.field].filter(Boolean).join(' - ') + (degree.gpa ? `; GPA: ${degree.gpa}` : ''),
      degree.location ?? '',
      formatAtsDateRange(degree.start, degree.end),
      ...(degree.coursework ?? []).slice(0, 2),
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
      .flatMap((item) => [formatAtsDate(item.start), formatAtsDate(item.end)]),
    ...(profile.degrees ?? []).flatMap((item) => [formatAtsDate(item.start), formatAtsDate(item.end)]),
  ].filter(Boolean);
}

export function isStandardAtsDate(value: string) {
  return /^(?:(?:0[1-9]|1[0-2])\/(?:19|20)\d{2}|(?:19|20)\d{2}|Present)(?: \((?:Expected|Anticipated)\))?$/i.test(value);
}
