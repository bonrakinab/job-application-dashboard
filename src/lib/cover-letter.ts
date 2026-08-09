import type { ApplicationPack, CandidateProfile, Job } from './types';

function cleanParagraph(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function coverLetterBodyParagraphs(pack: ApplicationPack) {
  let text = (pack.coverLetter ?? '').replace(/\r/g, '').trim();
  text = text
    .replace(/^\s*dear\s+[^\n,]+,?\s*/i, '')
    .replace(/\s*(?:sincerely|best regards|kind regards|regards)[,\s\n]+(?:arnob\s+banik)?\s*$/i, '')
    .trim();

  let paragraphs = text
    .split(/\n\s*\n+/)
    .map(cleanParagraph)
    .filter(Boolean);

  if (paragraphs.length === 1) {
    const lines = text.split(/\n+/).map(cleanParagraph).filter(Boolean);
    if (lines.length >= 2) paragraphs = lines;
  }

  return paragraphs
    .map((paragraph) => paragraph
      .replace(/^dear\s+hiring\s+manager,?\s*/i, '')
      .replace(/\s*(?:sincerely|best regards|kind regards|regards),?\s*$/i, '')
      .trim())
    .filter(Boolean)
    .slice(0, 4);
}

export function coverLetterDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Toronto',
  }).format(date);
}

export function coverLetterText(profile: CandidateProfile, job: Job, pack: ApplicationPack, date = new Date()) {
  const contact = [profile.location, profile.phone, profile.email].filter(Boolean).join(' | ');
  const recipient = ['Hiring Manager', job.company, job.location].filter(Boolean).join('\n');
  const paragraphs = coverLetterBodyParagraphs(pack);

  return [
    profile.name,
    contact,
    '',
    coverLetterDate(date),
    '',
    recipient,
    '',
    `Re: ${job.title}`,
    '',
    'Dear Hiring Manager,',
    '',
    ...paragraphs.flatMap((paragraph) => [paragraph, '']),
    'Sincerely,',
    profile.name,
  ].join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
