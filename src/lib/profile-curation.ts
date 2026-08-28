import type { CandidateProfile, EducationItem, ExperienceItem, ProjectItem, ProjectRoleFamily } from './types';
import { normalizeText } from './utils';

const GENERIC_APPLICATION_SKILLS = new Set([
  'analytical skills',
  'board of directors',
  'communication',
  'customer satisfaction',
  'engineering',
  'market research',
  'microsoft office',
  'organizational collaboration',
  'problem solving',
  'programming',
  'software development',
  'team leadership',
  'teamwork',
]);

const SKILL_ALIASES: Array<[RegExp, string]> = [
  [/^python \(programming language\)$/i, 'Python'],
  [/^c \(programming language\)$/i, 'C'],
  [/^amazon web services \(aws\)$/i, 'AWS'],
  [/^artificial intelligence \(ai\)$/i, 'Artificial Intelligence'],
  [/^cascading style sheets \(css\)$/i, 'CSS'],
  [/^enterprise resource planning \(erp\)$/i, 'ERP'],
  [/^oracle fusion applications \(ofa\)$/i, 'Oracle Fusion ERP Cloud'],
  [/^general ledgers?$/i, 'General Ledger (GL)'],
  [/^python programming language$/i, 'Python'],
];

const MONTHS: Record<string, string> = {
  jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03', apr: '04', april: '04',
  may: '05', jun: '06', june: '06', jul: '07', july: '07', aug: '08', august: '08', sep: '09', sept: '09',
  september: '09', oct: '10', october: '10', nov: '11', november: '11', dec: '12', december: '12',
};

const PROJECT_SKILL_SIGNALS: Array<[RegExp, string]> = [
  [/\bpython\b/i, 'Python'], [/\bc\+\+\b/i, 'C++'], [/\bjava\b/i, 'Java'], [/\bphp\b/i, 'PHP'],
  [/\bhtml5?\b/i, 'HTML5'], [/\bcss\b/i, 'CSS'], [/\bsql\b/i, 'SQL'], [/\bmysql\b/i, 'MySQL'],
  [/\bangular\b/i, 'Angular'], [/\breact\b/i, 'React'], [/\bnext\.?js\b/i, 'Next.js'],
  [/\bmachine learning\b/i, 'Machine Learning'], [/\bdeep learning\b/i, 'Deep Learning'],
  [/\bimage processing\b/i, 'Image Processing'], [/\bcryptograph/i, 'Cryptography'],
  [/\bweb development\b/i, 'Web Development'], [/\biis\b/i, 'IIS'], [/\bsql server\b/i, 'SQL Server'],
];

const ROLE_FAMILY_SIGNALS: Array<[ProjectRoleFamily, RegExp]> = [
  ['ai-ml', /\b(ai|artificial intelligence|machine learning|deep learning|image processing|computer vision)\b/i],
  ['data-analytics', /\b(data|analytics|sql|database|prediction)\b/i],
  ['software', /\b(software|application|website|web development|react|angular|php|html|css)\b/i],
  ['erp-enterprise', /\b(erp|oracle fusion|financials|procurement|tax engine)\b/i],
  ['it-systems', /\b(server|infrastructure|edms|iis|systems? administration)\b/i],
  ['cloud-devops', /\b(cloud|devops|deployment|ci\/cd|vercel)\b/i],
  ['cybersecurity', /\b(security|phishing|cryptograph|encryption)\b/i],
  ['systems-algorithms', /\b(algorithm|operating system|file system|parallel|kmp|microprocessor)\b/i],
  ['business-analysis', /\b(business|process|stakeholder|financial|reporting)\b/i],
];

function unique<T>(values: T[], key: (value: T) => string) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = key(value);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

export function cleanLinkedInText(value: string) {
  return value.normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[•●▪◦]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[-–—\s]+/, '')
    .trim();
}

function canonicalSkill(value: string) {
  const cleaned = cleanLinkedInText(value);
  return SKILL_ALIASES.find(([pattern]) => pattern.test(cleaned))?.[1] ?? cleaned;
}

export function curateSkills(values: string[] | undefined) {
  return unique((values ?? []).map(canonicalSkill).filter((skill) => {
    const normalized = normalizeText(skill);
    return normalized && !GENERIC_APPLICATION_SKILLS.has(normalized)
      && !/^rfid (antennas?|tags?|readers?)$/.test(normalized)
      && normalized !== 'bluetooth low energy'
      && normalized !== 'angularjs';
  }), normalizeText);
}

function normalizedDate(value?: string) {
  if (!value) return '';
  const normalized = normalizeText(value);
  if (/present|current/.test(normalized)) return 'present';
  const year = normalized.match(/\b(19|20)\d{2}\b/)?.[0];
  const month = Object.entries(MONTHS).find(([name]) => new RegExp(`\\b${name}\\b`).test(normalized))?.[1];
  return [year, month].filter(Boolean).join('-');
}

function normalizedOrganization(value: string) {
  return normalizeText(value).replace(/\b(incorporated|inc|limited|ltd|plc|llc)\b/g, '').replace(/\s+/g, ' ').trim();
}

function normalizedTitle(value: string) {
  return normalizeText(value)
    .replace(/\badvanced internship program\b|\baip\b|\bteam leader\b/g, '')
    .replace(/\bit$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenCoverage(left: string, right: string) {
  const a = new Set(normalizeText(left).split(/\s+/).filter((token) => token.length > 2));
  const b = new Set(normalizeText(right).split(/\s+/).filter((token) => token.length > 2));
  if (!a.size || !b.size) return 0;
  const hits = [...a].filter((token) => b.has(token)).length;
  return hits / Math.min(a.size, b.size);
}

function sameExperience(left: ExperienceItem, right: ExperienceItem) {
  if (normalizedOrganization(left.organization) !== normalizedOrganization(right.organization)) return false;
  const leftTitle = normalizedTitle(left.title);
  const rightTitle = normalizedTitle(right.title);
  const titleMatch = leftTitle === rightTitle || tokenCoverage(leftTitle, rightTitle) >= 0.78;
  if (!titleMatch) return false;
  const datesMatch = normalizedDate(left.start) === normalizedDate(right.start)
    && normalizedDate(left.end) === normalizedDate(right.end);
  return datesMatch || leftTitle === rightTitle;
}

function cleanLocation(value?: string) {
  if (!value) return undefined;
  const cleaned = cleanLinkedInText(value);
  if (!/^\d/.test(cleaned) && cleaned.length <= 65) return cleaned;
  const parts = cleaned.split(',').map((part) => part.trim()).filter(Boolean);
  const provinceIndex = parts.findIndex((part) => /^(ON|Ontario)(?:\s|$)/i.test(part));
  if (provinceIndex > 0) return `${parts[provinceIndex - 1]}, Ontario, Canada`;
  const stateIndex = parts.findIndex((part) => /^[A-Z]{2}\s+\d{5}/.test(part));
  if (stateIndex > 0) return `${parts[stateIndex - 1]}, ${parts[stateIndex].slice(0, 2)}, United States`;
  return parts.slice(-3).join(', ');
}

function cleanBullets(values: string[] | undefined) {
  return unique((values ?? []).map((value) => {
    const cleaned = cleanLinkedInText(value);
    if (cleaned.length <= 360) return cleaned;
    const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
    let compact = '';
    for (const sentence of sentences) {
      if (compact && compact.length + sentence.length + 1 > 340) break;
      compact = `${compact} ${sentence}`.trim();
    }
    if (compact.length >= 45) return compact;
    const clipped = cleaned.slice(0, 337);
    return `${clipped.replace(/\s+\S*$/, '')}...`;
  }).filter(Boolean), normalizeText);
}

function mergeExperience(existing: ExperienceItem, incoming: ExperienceItem): ExperienceItem {
  const baseBullets = cleanBullets(existing.bullets);
  const incomingBullets = cleanBullets(incoming.bullets)
    .filter((bullet) => bullet.length <= 320 && !baseBullets.some((current) => tokenCoverage(current, bullet) >= 0.72));
  return {
    ...incoming,
    ...existing,
    location: cleanLocation(existing.location) ?? cleanLocation(incoming.location),
    bullets: [...baseBullets, ...incomingBullets.slice(0, Math.max(0, 3 - baseBullets.length))],
    skills: curateSkills([...(existing.skills ?? []), ...(incoming.skills ?? [])]),
  };
}

function dedupeExperience(items: ExperienceItem[] | undefined) {
  const result: ExperienceItem[] = [];
  for (const raw of items ?? []) {
    if (!raw.organization?.trim() || !raw.title?.trim()) continue;
    const item = { ...raw, location: cleanLocation(raw.location), bullets: cleanBullets(raw.bullets), skills: curateSkills(raw.skills) };
    const index = result.findIndex((current) => sameExperience(current, item));
    if (index < 0) result.push(item);
    else result[index] = mergeExperience(result[index], item);
  }
  return result;
}

const NON_RESUME_EXPERIENCE_TITLES = /\b(?:active general member|appointment committee|general secretary|head of finance|senior adviser|student representative|volunteer)\b/i;

const CORE_RESUME_EXPERIENCE = [
  { organization: /\bbanglalink\b/i, title: /enterprise solutions and services specialist engineer/i },
  { organization: /\bbanglalink\b/i, title: /information technology intern/i },
  { organization: /\bgaotek\b/i, title: /software development intern.*team leader/i },
] as const;

/**
 * Keep the complete LinkedIn history in the master profile while excluding
 * extracurricular, volunteer, and empty records from employer-facing resumes.
 * Genuine technical/enterprise employment remains available for job-specific
 * ranking, including graduate-assistant work when it is relevant.
 */
export function isResumeExperience(item: ExperienceItem) {
  if (!(item.bullets ?? []).some((bullet) => cleanLinkedInText(bullet).length >= 20)) return false;
  return !NON_RESUME_EXPERIENCE_TITLES.test(item.title);
}

export function resumeExperience(profile: CandidateProfile) {
  const eligible = dedupeExperience(profile.experience).filter(isResumeExperience);
  const core = CORE_RESUME_EXPERIENCE
    .map((expected) => eligible.find((item) => expected.organization.test(item.organization) && expected.title.test(item.title)))
    .filter((item): item is ExperienceItem => Boolean(item));

  // This is a personal dashboard with an established three-role resume. Keep
  // extra LinkedIn positions as profile evidence without letting them replace
  // the verified employment chronology in generated documents.
  return core.length === CORE_RESUME_EXPERIENCE.length ? core : eligible;
}

function degreeLevel(value: string) {
  const normalized = normalizeText(value);
  if (/master|msc|ms\b/.test(normalized)) return 'master';
  if (/bachelor|btech|bsc/.test(normalized)) return 'bachelor';
  if (/phd|doctor/.test(normalized)) return 'doctorate';
  if (/o levels?|a levels?|secondary|high school/.test(normalized)) return 'secondary';
  return normalized;
}

function sameEducation(left: EducationItem, right: EducationItem) {
  return normalizeText(left.institution) === normalizeText(right.institution)
    && degreeLevel(left.degree) === degreeLevel(right.degree);
}

function dedupeEducation(items: EducationItem[] | undefined) {
  const result: EducationItem[] = [];
  for (const raw of items ?? []) {
    if (!raw.institution?.trim() || !raw.degree?.trim()) continue;
    const item = { ...raw, location: cleanLocation(raw.location), coursework: cleanBullets(raw.coursework) };
    const index = result.findIndex((current) => sameEducation(current, item));
    if (index < 0) result.push(item);
    else result[index] = {
      ...item,
      ...result[index],
      coursework: unique([...(result[index].coursework ?? []), ...(item.coursework ?? [])], normalizeText),
    };
  }
  return result;
}

function projectTokens(value: string) {
  return normalizeText(value).split(/\s+/).filter((token) => token.length > 2 && !['and', 'the', 'using', 'project'].includes(token));
}

function sameProject(left: ProjectItem, right: ProjectItem) {
  const a = projectTokens(left.name);
  const b = projectTokens(right.name);
  if (!a.length || !b.length) return false;
  const hits = a.filter((token) => b.includes(token)).length;
  return hits / Math.min(a.length, b.length) >= 0.72;
}

function inferredProjectSkills(project: ProjectItem) {
  const text = [project.name, project.description, ...(project.bullets ?? [])].join(' ');
  return unique(PROJECT_SKILL_SIGNALS.filter(([pattern]) => pattern.test(text)).map(([, skill]) => skill), normalizeText);
}

function inferredRoleFamilies(project: ProjectItem) {
  const tagged = project as ProjectItem & { roleFamilies?: ProjectRoleFamily[] };
  const text = [project.name, project.description, ...(project.bullets ?? []), ...(project.skills ?? [])].join(' ');
  return unique([...(tagged.roleFamilies ?? []), ...ROLE_FAMILY_SIGNALS.filter(([, pattern]) => pattern.test(text)).map(([family]) => family)], (value) => value);
}

function prepareProject(raw: ProjectItem): ProjectItem {
  const project = {
    ...raw,
    name: cleanLinkedInText(raw.name),
    description: cleanLinkedInText(raw.description ?? ''),
    bullets: cleanBullets(raw.bullets),
    skills: curateSkills([...(raw.skills ?? []), ...inferredProjectSkills(raw)]),
  } as ProjectItem & { roleFamilies?: ProjectRoleFamily[] };
  project.roleFamilies = inferredRoleFamilies(project);
  return project;
}

function dedupeProjects(items: ProjectItem[] | undefined) {
  const result: ProjectItem[] = [];
  for (const raw of items ?? []) {
    if (!raw.name?.trim()) continue;
    const item = prepareProject(raw);
    const index = result.findIndex((current) => sameProject(current, item));
    if (index < 0) result.push(item);
    else {
      const current = result[index] as ProjectItem & { roleFamilies?: ProjectRoleFamily[] };
      const baseBullets = cleanBullets(current.bullets);
      const incomingBullets = cleanBullets(item.bullets)
        .filter((bullet) => bullet.length <= 320 && !baseBullets.some((existing) => tokenCoverage(existing, bullet) >= 0.7));
      result[index] = {
        ...item,
        ...current,
        description: current.description || item.description,
        bullets: [...baseBullets, ...incomingBullets.slice(0, Math.max(0, 3 - baseBullets.length))],
        skills: curateSkills([...(current.skills ?? []), ...(item.skills ?? [])]),
        roleFamilies: unique([...(current.roleFamilies ?? []), ...inferredRoleFamilies(item)], (value) => value),
      } as ProjectItem;
    }
  }
  return result;
}

function certificationKey(value: string) {
  const normalized = normalizeText(value).replace(/\b(certificate|specialization)\b/g, '').trim();
  if (/google it support/.test(normalized)) return 'google-it-support';
  if (/aws academy.*cloud foundations/.test(normalized)) return 'aws-cloud-foundations';
  if (/oracle cloud infrastructure.*data science professional/.test(normalized)) return 'oci-data-science-professional';
  if (/oracle cloud infrastructure.*foundations associate/.test(normalized)) return 'oci-foundations';
  if (/oracle cloud data management.*foundations associate/.test(normalized)) return 'oci-data-management';
  if (/machine learning for all/.test(normalized)) return 'machine-learning-for-all';
  return normalized.replace(/\b[a-z0-9]{10,}\b/g, '').trim();
}

function cleanCertification(value: string) {
  const parts = cleanLinkedInText(value).split('·').map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1 && /^[A-Z0-9-]{8,}$/i.test(parts[parts.length - 1])) parts.pop();
  return parts.join(' · ');
}

function dedupeCertifications(values: string[] | undefined) {
  return unique((values ?? []).map(cleanCertification).filter(Boolean), certificationKey);
}

function dedupeLinks(links: Record<string, string> | undefined) {
  const seen = new Set<string>();
  return Object.fromEntries(Object.entries(links ?? {}).filter(([, url]) => {
    const key = url.trim().replace(/\/$/, '').toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }));
}

export function curateCandidateProfile(profile: CandidateProfile): CandidateProfile {
  return {
    ...profile,
    skills: curateSkills(profile.skills),
    experience: dedupeExperience(profile.experience),
    degrees: dedupeEducation(profile.degrees),
    projects: dedupeProjects(profile.projects),
    certifications: dedupeCertifications(profile.certifications),
    languages: unique((profile.languages ?? []).map(cleanLinkedInText).filter(Boolean), normalizeText),
    courses: unique((profile.courses ?? []).map(cleanLinkedInText).filter(Boolean), normalizeText),
    awards: unique((profile.awards ?? []).map(cleanLinkedInText).filter(Boolean), normalizeText),
    publications: unique((profile.publications ?? []).map(cleanLinkedInText).filter(Boolean), normalizeText),
    links: dedupeLinks(profile.links),
  };
}

export function employerFacingCandidateProfile(profile: CandidateProfile): CandidateProfile {
  const curated = curateCandidateProfile(profile);
  const { profileSources: _profileSources, ...safe } = curated;
  return safe;
}

export function resumeEducation(profile: CandidateProfile) {
  const degrees = dedupeEducation(profile.degrees);
  const postSecondary = degrees.filter((degree) => degreeLevel(degree.degree) !== 'secondary');
  return (postSecondary.length >= 2 ? postSecondary : degrees).slice(0, 2);
}
