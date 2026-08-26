import { inflateRawSync } from 'node:zlib';
import type {
  CandidateProfile,
  EducationItem,
  ExperienceItem,
  LinkedInImportSummary,
  ProjectItem,
} from './types';
import { importFileBaseName, isSupportedLinkedInCsvFile } from './linkedin-import-files';
import { normalizeText } from './utils';

export type LinkedInImportFile = {
  name: string;
  bytes: Uint8Array;
};

type CsvRow = Record<string, string>;

export type LinkedInProfileData = {
  name?: string;
  headline?: string;
  summary?: string;
  industry?: string;
  location?: string;
  skills: string[];
  experience: ExperienceItem[];
  degrees: EducationItem[];
  projects: ProjectItem[];
  certifications: string[];
  languages: string[];
  courses: string[];
  awards: string[];
  publications: string[];
  links: Record<string, string>;
  sourceFiles: string[];
};

export type LinkedInMergeResult = {
  profile: CandidateProfile;
  summary: LinkedInImportSummary;
};

const MAX_ARCHIVE_BYTES = 20 * 1024 * 1024;
const MAX_ENTRY_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_EXTRACTED_BYTES = 16 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 250;
const TEXT_EXTENSIONS = new Set(['csv']);

function unique(values: Array<string | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = raw?.trim();
    if (!value) continue;
    const key = normalizeText(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function extension(value: string) {
  const match = importFileBaseName(value).toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? '';
}

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function parseCsvCells(value: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quoted) {
      if (char === '"' && value[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }

  if (field || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows;
}

export function parseCsv(value: string): CsvRow[] {
  const cells = parseCsvCells(value);
  if (!cells.length) return [];
  const singleColumnHeaders = new Set(['name', 'skill', 'language', 'title']);
  const headerIndex = cells.findIndex((row) => {
    const populated = row.filter((cell) => cell.trim());
    return populated.length >= 2 || (populated.length === 1 && singleColumnHeaders.has(normalizeHeader(populated[0])));
  });
  if (headerIndex < 0) return [];
  const headers = cells[headerIndex].map(normalizeHeader);
  return cells.slice(headerIndex + 1).map((row) => Object.fromEntries(
    headers.map((header, index) => [header, row[index]?.trim() ?? '']),
  )).filter((row) => Object.values(row).some(Boolean));
}

function value(row: CsvRow, ...aliases: string[]) {
  for (const alias of aliases) {
    const found = row[normalizeHeader(alias)]?.trim();
    if (found) return found;
  }
  return undefined;
}

function splitDescription(description?: string) {
  if (!description) return [];
  const lines = description
    .split(/\r?\n|\s+[•●▪]\s*/)
    .map((line) => line.replace(/^[\s\-–—•●▪]+/, '').trim())
    .filter(Boolean);
  return unique(lines.length ? lines : [description]);
}

function joinEvidence(parts: Array<string | undefined>) {
  return parts.map((part) => part?.trim()).filter(Boolean).join(' · ');
}

function urlsFrom(value?: string) {
  return value?.match(/https?:\/\/[^\s,;\]}"']+/gi) ?? [];
}

function emptyData(): LinkedInProfileData {
  return {
    skills: [],
    experience: [],
    degrees: [],
    projects: [],
    certifications: [],
    languages: [],
    courses: [],
    awards: [],
    publications: [],
    links: {},
    sourceFiles: [],
  };
}

function addRows(data: LinkedInProfileData, filename: string, rows: CsvRow[]) {
  const normalizedName = importFileBaseName(filename).toLowerCase();
  data.sourceFiles.push(importFileBaseName(filename));

  if (/^profile(?:_v2)?\.csv$/.test(normalizedName)) {
    const row = rows[0] ?? {};
    data.name = [value(row, 'First Name'), value(row, 'Last Name')].filter(Boolean).join(' ') || value(row, 'Name');
    data.headline = value(row, 'Headline');
    data.summary = value(row, 'Summary');
    data.industry = value(row, 'Industry');
    data.location = value(row, 'Geo Location', 'Location', 'Address');
    const websites = urlsFrom(value(row, 'Websites', 'Website'));
    websites.forEach((url, index) => { data.links[index ? `linkedinWebsite${index + 1}` : 'linkedinWebsite'] = url; });
    return;
  }

  if (/skills?\.csv$/.test(normalizedName)) {
    data.skills.push(...rows.map((row) => value(row, 'Name', 'Skill')).filter((item): item is string => Boolean(item)));
    return;
  }

  if (/(positions?|experience)\.csv$/.test(normalizedName)) {
    for (const row of rows) {
      const organization = value(row, 'Company Name', 'Company', 'Organization');
      const title = value(row, 'Title', 'Job Title');
      if (!organization || !title) continue;
      data.experience.push({
        organization,
        title,
        start: value(row, 'Started On', 'Start Date', 'From'),
        end: value(row, 'Finished On', 'End Date', 'To') ?? 'Present',
        location: value(row, 'Location'),
        bullets: splitDescription(value(row, 'Description')),
      });
    }
    return;
  }

  if (/education\.csv$/.test(normalizedName)) {
    for (const row of rows) {
      const institution = value(row, 'School Name', 'Institution', 'School');
      const degree = value(row, 'Degree Name', 'Degree');
      if (!institution || !degree) continue;
      data.degrees.push({
        institution,
        degree,
        field: value(row, 'Field Of Study', 'Field'),
        start: value(row, 'Start Date', 'Started On'),
        end: value(row, 'End Date', 'Finished On'),
        location: value(row, 'Location'),
        coursework: unique([
          ...splitDescription(value(row, 'Notes')),
          ...splitDescription(value(row, 'Activities')),
        ]),
      });
    }
    return;
  }

  if (/projects?\.csv$/.test(normalizedName)) {
    for (const row of rows) {
      const name = value(row, 'Title', 'Name', 'Project Name');
      if (!name) continue;
      const description = value(row, 'Description') ?? '';
      data.projects.push({
        name,
        description,
        bullets: splitDescription(description),
        url: value(row, 'Url', 'URL', 'Link'),
      });
    }
    return;
  }

  if (/certifications?\.csv$/.test(normalizedName)) {
    data.certifications.push(...rows.map((row) => joinEvidence([
      value(row, 'Name', 'Title'),
      value(row, 'Authority', 'Issuing Organization'),
      value(row, 'License Number'),
    ])).filter(Boolean));
    return;
  }

  if (/languages?\.csv$/.test(normalizedName)) {
    data.languages.push(...rows.map((row) => joinEvidence([
      value(row, 'Name', 'Language'),
      value(row, 'Proficiency'),
    ])).filter(Boolean));
    return;
  }

  if (/courses?\.csv$/.test(normalizedName)) {
    data.courses.push(...rows.map((row) => joinEvidence([
      value(row, 'Name', 'Course Name'),
      value(row, 'Number', 'Course Number'),
      value(row, 'Associated With'),
    ])).filter(Boolean));
    return;
  }

  if (/(honors?|awards?)\.csv$/.test(normalizedName)) {
    data.awards.push(...rows.map((row) => joinEvidence([
      value(row, 'Title', 'Name'),
      value(row, 'Issuer'),
      value(row, 'Issued On', 'Date'),
      value(row, 'Description'),
    ])).filter(Boolean));
    return;
  }

  if (/publications?\.csv$/.test(normalizedName)) {
    data.publications.push(...rows.map((row) => joinEvidence([
      value(row, 'Name', 'Title'),
      value(row, 'Publisher'),
      value(row, 'Published On', 'Date'),
      value(row, 'Url', 'URL'),
    ])).filter(Boolean));
  }
}

function readZipEntries(bytes: Uint8Array): LinkedInImportFile[] {
  if (bytes.byteLength > MAX_ARCHIVE_BYTES) throw new Error('The LinkedIn archive is larger than 20 MB.');
  const buffer = Buffer.from(bytes);
  const minimum = Math.max(0, buffer.length - 65_557);
  let eocd = -1;
  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error('The ZIP archive is not valid.');

  const entries = buffer.readUInt16LE(eocd + 10);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  if (entries > MAX_ARCHIVE_ENTRIES) throw new Error('The LinkedIn archive contains too many files.');

  const extracted: LinkedInImportFile[] = [];
  let total = 0;
  let offset = centralOffset;
  for (let index = 0; index < entries; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('The ZIP directory is invalid.');
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    offset += 46 + nameLength + extraLength + commentLength;

    if (name.endsWith('/') || !isSupportedLinkedInCsvFile(name)) continue;
    if (uncompressedSize > MAX_ENTRY_BYTES || total + uncompressedSize > MAX_TOTAL_EXTRACTED_BYTES) throw new Error('The LinkedIn archive expands beyond the safe import limit.');
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('The ZIP entry is invalid.');
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
    if (compressed.length !== compressedSize) throw new Error('The ZIP entry is incomplete.');
    const content = method === 0
      ? compressed
      : method === 8
        ? inflateRawSync(compressed, { maxOutputLength: Math.min(MAX_ENTRY_BYTES, uncompressedSize + 1) })
        : undefined;
    if (!content) continue;
    if (content.byteLength !== uncompressedSize) throw new Error('The ZIP entry size is invalid.');
    total += content.byteLength;
    extracted.push({ name, bytes: content });
  }
  return extracted;
}

function finalize(data: LinkedInProfileData): LinkedInProfileData {
  return {
    ...data,
    skills: unique(data.skills),
    experience: data.experience.filter((item) => item.organization && item.title),
    degrees: data.degrees.filter((item) => item.institution && item.degree),
    projects: data.projects.filter((item) => item.name),
    certifications: unique(data.certifications),
    languages: unique(data.languages),
    courses: unique(data.courses),
    awards: unique(data.awards),
    publications: unique(data.publications),
    sourceFiles: unique(data.sourceFiles),
  };
}

export function parseLinkedInArchiveFiles(files: LinkedInImportFile[]): LinkedInProfileData {
  const expanded = files.flatMap((file) => extension(file.name) === 'zip' ? readZipEntries(file.bytes) : [file]);
  const data = emptyData();
  for (const file of expanded) {
    const ext = extension(file.name);
    if (!TEXT_EXTENSIONS.has(ext) || !isSupportedLinkedInCsvFile(file.name)) continue;
    if (file.bytes.byteLength > MAX_ENTRY_BYTES) throw new Error(`${importFileBaseName(file.name)} is too large to import.`);
    const text = Buffer.from(file.bytes).toString('utf8');
    if (ext === 'csv') addRows(data, file.name, parseCsv(text));
  }
  const result = finalize(data);
  const importedCount = result.skills.length + result.experience.length + result.degrees.length
    + result.projects.length + result.certifications.length + result.languages.length
    + result.courses.length + result.awards.length + result.publications.length;
  const hasProfileText = Boolean(result.headline || result.summary || result.industry || result.location || Object.keys(result.links).length);
  if (!result.sourceFiles.length || (!importedCount && !hasProfileText)) throw new Error('No supported LinkedIn profile data was found in the selected files.');
  return result;
}

function mergeStrings(existing: string[] | undefined, incoming: string[] | undefined) {
  return unique([...(existing ?? []), ...(incoming ?? [])]);
}

function mergeExperience(existing: ExperienceItem[] | undefined, incoming: ExperienceItem[]) {
  const result = [...(existing ?? [])];
  for (const item of incoming) {
    const key = `${normalizeText(item.organization)}|${normalizeText(item.title)}`;
    const index = result.findIndex((current) => `${normalizeText(current.organization)}|${normalizeText(current.title)}` === key);
    if (index < 0) result.push(item);
    else result[index] = {
      ...item,
      ...result[index],
      bullets: mergeStrings(result[index].bullets, item.bullets),
      skills: mergeStrings(result[index].skills, item.skills),
    };
  }
  return result;
}

function mergeEducation(existing: EducationItem[] | undefined, incoming: EducationItem[]) {
  const result = [...(existing ?? [])];
  for (const item of incoming) {
    const institution = normalizeText(item.institution);
    const degree = normalizeText(item.degree);
    const index = result.findIndex((current) => normalizeText(current.institution) === institution
      && (normalizeText(current.degree) === degree || Boolean(current.field && item.field
        && normalizeText(current.field) === normalizeText(item.field))));
    if (index < 0) result.push(item);
    else result[index] = {
      ...item,
      ...result[index],
      coursework: mergeStrings(result[index].coursework, item.coursework),
    };
  }
  return result;
}

function mergeProjects(existing: ProjectItem[] | undefined, incoming: ProjectItem[]) {
  const result = [...(existing ?? [])];
  for (const item of incoming) {
    const index = result.findIndex((current) => normalizeText(current.name) === normalizeText(item.name));
    if (index < 0) result.push(item);
    else result[index] = {
      ...item,
      ...result[index],
      bullets: mergeStrings(result[index].bullets, item.bullets),
      skills: mergeStrings(result[index].skills, item.skills),
    };
  }
  return result;
}

function additions(before: CandidateProfile, after: CandidateProfile) {
  return {
    skills: after.skills.length - before.skills.length,
    experience: (after.experience?.length ?? 0) - (before.experience?.length ?? 0),
    education: (after.degrees?.length ?? 0) - (before.degrees?.length ?? 0),
    projects: (after.projects?.length ?? 0) - (before.projects?.length ?? 0),
    certifications: (after.certifications?.length ?? 0) - (before.certifications?.length ?? 0),
    languages: (after.languages?.length ?? 0) - (before.languages?.length ?? 0),
    courses: (after.courses?.length ?? 0) - (before.courses?.length ?? 0),
    awards: (after.awards?.length ?? 0) - (before.awards?.length ?? 0),
    publications: (after.publications?.length ?? 0) - (before.publications?.length ?? 0),
  };
}

export function mergeLinkedInProfile(
  current: CandidateProfile,
  linkedin: LinkedInProfileData,
  importedAt = new Date().toISOString(),
): LinkedInMergeResult {
  const profile: CandidateProfile = {
    ...current,
    name: current.name || linkedin.name || 'Candidate',
    location: current.location || linkedin.location,
    skills: mergeStrings(current.skills, linkedin.skills),
    experience: mergeExperience(current.experience, linkedin.experience),
    degrees: mergeEducation(current.degrees, linkedin.degrees),
    projects: mergeProjects(current.projects, linkedin.projects),
    certifications: mergeStrings(current.certifications, linkedin.certifications),
    languages: mergeStrings(current.languages, linkedin.languages),
    courses: mergeStrings(current.courses, linkedin.courses),
    awards: mergeStrings(current.awards, linkedin.awards),
    publications: mergeStrings(current.publications, linkedin.publications),
    links: { ...linkedin.links, ...(current.links ?? {}) },
  };
  const summary: LinkedInImportSummary = {
    profileUrl: profile.links?.linkedin,
    importedAt,
    sourceFiles: linkedin.sourceFiles,
    headline: linkedin.headline,
    summary: linkedin.summary,
    industry: linkedin.industry,
    added: additions(current, profile),
  };
  profile.profileSources = { ...current.profileSources, linkedin: summary };
  return { profile, summary };
}
