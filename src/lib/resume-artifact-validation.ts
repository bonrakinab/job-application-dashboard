import JSZip from 'jszip';
import mammoth from 'mammoth';
import type { ApplicationPack, CandidateProfile } from './types';
import { visibleResumeText } from './resume-content';
import { normalizeText } from './utils';

export interface ResumeArtifactValidation {
  safe: boolean;
  parseCoverage: number;
  missingMarkers: string[];
  sectionOrderValid: boolean;
  structuralIssues: string[];
}

const SECTIONS = ['professional summary', 'experience', 'skills', 'projects', 'education', 'certifications', 'publications'];

function significantTokens(value: string) {
  return [...new Set(normalizeArtifactText(value).split(/\s+/).map((token) => token.replace(/[^a-z0-9+#./-]/g, '')).filter((token) => token.length >= 2))];
}

function normalizeArtifactText(value: string) {
  return value.normalize('NFKC').toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/·/g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/→/g, '->')
    .replace(/≈/g, 'approximately ')
    .replace(/([A-Za-z])[-]\s+(?=[A-Za-z])/g, '$1-')
    .replace(/\s+/g, ' ').trim();
}

function expectedMarkers(profile: CandidateProfile, pack: ApplicationPack) {
  // Check complete content blocks, including summary, contact, dates and skills;
  // a set of unique words alone can conceal dropped or reordered sentences.
  return visibleResumeText(profile, pack).split('\n').filter(Boolean);
}

function sectionHeadings(text: string) {
  return text.split(/\r?\n/).map((line) => normalizeText(line.trim())).filter((line) => SECTIONS.includes(line));
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * PDF text extractors do not guarantee that a visually separated heading is
 * returned as its own line. In particular, kerning/font maps may produce
 * "PROFESSIONALSUMMARY" or split the words across line boundaries. Resume
 * headings are emitted in uppercase, so match those exact uppercase labels
 * while allowing arbitrary extractor whitespace. This avoids treating normal
 * lowercase prose such as "skills and projects" as section headings.
 */
function sectionHeadingPosition(text: string, section: string) {
  const pattern = section.toUpperCase().split(/\s+/).map(escapeRegex).join('\\s*');
  const match = new RegExp(pattern).exec(text.normalize('NFKC'));
  return match?.index ?? -1;
}

function markerPresent(extracted: string, normalizedExtracted: string, marker: string) {
  const normalizedMarker = normalizeArtifactText(marker);
  if (normalizedExtracted.includes(normalizedMarker)) return true;
  return SECTIONS.includes(normalizedMarker) && sectionHeadingPosition(extracted, normalizedMarker) >= 0;
}

export function validateExtractedResumeText(
  extracted: string,
  profile: CandidateProfile,
  pack: ApplicationPack,
  structuralIssues: string[] = [],
): ResumeArtifactValidation {
  const actual = normalizeArtifactText(extracted);
  const expected = visibleResumeText(profile, pack);
  const expectedTokens = significantTokens(expected);
  const actualTokens = new Set(significantTokens(actual));
  const parseCoverage = Math.round((expectedTokens.length
    ? expectedTokens.filter((token) => actualTokens.has(token)).length / expectedTokens.length
    : 1) * 100);
  const missingMarkers = expectedMarkers(profile, pack).filter((marker) => !markerPresent(extracted, actual, marker));
  const expectedSections = sectionHeadings(expected);
  const sectionPositions = expectedSections.map((section) => sectionHeadingPosition(extracted, section));
  const sectionOrderValid = sectionPositions.every((position, index) => position >= 0 && (index === 0 || position > sectionPositions[index - 1]));
  return {
    safe: parseCoverage >= 92 && !missingMarkers.length && sectionOrderValid && !structuralIssues.length,
    parseCoverage,
    missingMarkers,
    sectionOrderValid,
    structuralIssues,
  };
}

export async function validateResumePdfArtifact(pdf: Buffer, profile: CandidateProfile, pack: ApplicationPack) {
  // Load inside the request's error boundary so runtime/worker initialization
  // failures are recorded and returned as JSON instead of crashing route import.
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: pdf });
  try {
    const parsed = await parser.getText();
    return validateExtractedResumeText(parsed.text, profile, pack, parsed.total === 1 ? [] : ['Résumé must fit on one PDF page.']);
  } finally {
    await parser.destroy();
  }
}

export async function validateResumeDocxArtifact(docx: Buffer, profile: CandidateProfile, pack: ApplicationPack) {
  const [parsed, zip] = await Promise.all([
    mammoth.extractRawText({ buffer: docx }),
    JSZip.loadAsync(docx),
  ]);
  const documentXml = await zip.file('word/document.xml')?.async('string');
  const fileNames = Object.keys(zip.files);
  const issues: string[] = [];
  if (!documentXml) issues.push('Missing Word document body.');
  if (documentXml && /<w:tbl\b/i.test(documentXml)) issues.push('Tables are present.');
  if (documentXml && /<w:(?:vanish|webHidden|drawing|pict)\b/i.test(documentXml)) issues.push('Hidden text or drawings are present.');
  if (documentXml && /<w:txbxContent\b/i.test(documentXml)) issues.push('Text boxes are present.');
  if (documentXml && /<w:cols\b[^>]*w:num="(?:[2-9]|\d{2,})"/i.test(documentXml)) issues.push('Multiple columns are present.');
  if (fileNames.some((name) => /^word\/(?:header|footer)\d*\.xml$/i.test(name))) issues.push('Header or footer content is present.');
  return validateExtractedResumeText(parsed.value, profile, pack, issues);
}

export function assertResumeArtifact(validation: ResumeArtifactValidation, format: 'PDF' | 'DOCX') {
  if (validation.safe) return;
  const details = [
    validation.parseCoverage < 92 ? `parse coverage ${validation.parseCoverage}%` : '',
    validation.missingMarkers.length ? `missing ${validation.missingMarkers.slice(0, 3).join(', ')}` : '',
    !validation.sectionOrderValid ? 'section reading order invalid' : '',
    ...validation.structuralIssues,
  ].filter(Boolean).join('; ');
  throw new Error(`${format} résumé failed the final ATS parseability check: ${details || 'unknown validation failure'}.`);
}
