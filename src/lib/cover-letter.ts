import type { ApplicationPack, CandidateProfile, Job } from './types';

function cleanParagraph(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function stripLetterFraming(value: string) {
  return value
    .replace(/\r/g, '')
    .replace(/^\s*(?:dear\s+[^\n,]+,?|to\s+whom\s+it\s+may\s+concern,?)\s*/i, '')
    .replace(/\s*(?:sincerely|best regards|kind regards|regards|with gratitude|best)[,\s\n]+(?:arnob\s+banik)?\s*$/i, '')
    .trim();
}

function splitSentences(value: string) {
  const matches = cleanParagraph(value).match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
  return matches.map(cleanParagraph).filter(Boolean);
}

function rebalanceToThreeParagraphs(paragraphs: string[]) {
  if (paragraphs.length === 3) return paragraphs;
  if (paragraphs.length > 3) {
    return [paragraphs[0], paragraphs.slice(1, -1).join(' '), paragraphs[paragraphs.length - 1]];
  }

  const sentences = splitSentences(paragraphs.join(' '));
  if (sentences.length < 3) return paragraphs;

  const introCount = sentences.length >= 6 ? 2 : 1;
  const closingCount = sentences.length >= 5 ? 2 : 1;
  const bodyEnd = Math.max(introCount + 1, sentences.length - closingCount);
  const intro = sentences.slice(0, introCount).join(' ');
  const body = sentences.slice(introCount, bodyEnd).join(' ');
  const closing = sentences.slice(bodyEnd).join(' ');
  return [intro, body, closing].map(cleanParagraph).filter(Boolean);
}

/**
 * Normalize model-authored prose into the body structure used by Indeed's
 * cover-letter guidance: introduction, relevant background/body, and closing.
 * The renderer supplies the header, date, salutation, sign-off, and signature.
 */
export function coverLetterBodyParagraphs(pack: ApplicationPack) {
  const text = stripLetterFraming(pack.coverLetter ?? '');

  let paragraphs = text
    .split(/\n\s*\n+/)
    .map(cleanParagraph)
    .filter(Boolean);

  if (paragraphs.length <= 1) {
    const lines = text.split(/\n+/).map(cleanParagraph).filter(Boolean);
    if (lines.length >= 2) paragraphs = lines;
  }

  paragraphs = paragraphs
    .map((paragraph) => paragraph
      .replace(/^dear\s+(?:hiring\s+manager|[^,]+),?\s*/i, '')
      .replace(/\s*(?:sincerely|best regards|kind regards|regards|with gratitude|best),?\s*$/i, '')
      .trim())
    .filter(Boolean);

  return rebalanceToThreeParagraphs(paragraphs).slice(0, 3);
}

export function coverLetterDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Toronto',
  }).format(date);
}

/**
 * Plain-text representation of the Indeed-style template used by the PDF.
 * Header -> date -> salutation -> three focused paragraphs -> sign-off/signature.
 */
export function coverLetterText(profile: CandidateProfile, _job: Job, pack: ApplicationPack, date = new Date()) {
  const paragraphs = coverLetterBodyParagraphs(pack);
  const header = [profile.name, profile.phone, profile.email, profile.location].filter(Boolean) as string[];

  return [
    ...header,
    '',
    coverLetterDate(date),
    '',
    'Dear Hiring Manager,',
    '',
    ...paragraphs.flatMap((paragraph) => [paragraph, '']),
    'Sincerely,',
    profile.name,
  ].join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
