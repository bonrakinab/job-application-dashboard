import type { ApplicationPack, CandidateProfile, Job } from './types';
import { coverLetterBodyParagraphs, coverLetterDate } from './cover-letter';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 72; // 1 inch, matching Indeed's formatting guidance.
const RIGHT = PAGE_WIDTH - MARGIN;
const BOTTOM = 72;

type FontName = 'TR' | 'TB';

function ascii(text: string) {
  return text
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapePdf(text: string) {
  return ascii(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function width(text: string, size: number, font: FontName = 'TR') {
  return ascii(text).length * size * (font === 'TB' ? 0.48 : 0.45);
}

function wrapWidth(text: string, maxWidth: number, size: number, font: FontName = 'TR') {
  const words = ascii(text).split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && width(candidate, size, font) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

class LetterCanvas {
  commands: string[] = [];
  y = PAGE_HEIGHT - MARGIN;
  overflow = false;

  text(text: string, x: number, y: number, size: number, font: FontName = 'TR') {
    if (!text) return;
    this.commands.push(`BT /${font} ${size.toFixed(2)} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdf(text)}) Tj ET`);
  }

  line(text: string, size: number, font: FontName = 'TR', lineHeight = size + 4) {
    this.text(text, MARGIN, this.y, size, font);
    this.y -= lineHeight;
    if (this.y < BOTTOM) this.overflow = true;
  }

  wrapped(text: string, size: number, lineHeight: number) {
    for (const line of wrapWidth(text, RIGHT - MARGIN, size, 'TR')) {
      this.line(line, size, 'TR', lineHeight);
    }
  }

  gap(points: number) {
    this.y -= points;
    if (this.y < BOTTOM) this.overflow = true;
  }
}

function buildStream(profile: CandidateProfile, job: Job, pack: ApplicationPack, bodySize: number) {
  const c = new LetterCanvas();
  const lineHeight = bodySize + 4.2;

  // Indeed-style sender header: simple, left-aligned, no decorative banner.
  c.line(profile.name, 12, 'TB', 16);
  if (profile.phone) c.line(profile.phone, bodySize, 'TR', lineHeight);
  if (profile.email) c.line(profile.email, bodySize, 'TR', lineHeight);
  if (profile.location) c.line(profile.location, bodySize, 'TR', lineHeight);

  c.gap(11);
  c.line(coverLetterDate(), bodySize, 'TR', lineHeight);
  c.gap(13);
  c.line('Dear Hiring Manager,', bodySize, 'TR', lineHeight);
  c.gap(11);

  const paragraphs = coverLetterBodyParagraphs(pack);
  for (const paragraph of paragraphs) {
    c.wrapped(paragraph, bodySize, lineHeight);
    c.gap(11);
  }

  c.line('Sincerely,', bodySize, 'TR', lineHeight);
  c.gap(18);
  c.line(profile.name, bodySize, 'TR', lineHeight);

  // Keep the renderer job-aware for future recipient-name support while avoiding
  // subject/recipient blocks not present in the referenced Indeed example.
  void job;

  return { stream: c.commands.join('\n'), overflow: c.overflow, bottomY: c.y };
}

function pdfFromStream(stream: string) {
  const objects: string[] = [];
  const add = (body: string) => { objects.push(body); return objects.length; };
  const tr = add('<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>');
  const tb = add('<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>');
  const pages = add('');
  const content = add(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`);
  const page = add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /TR ${tr} 0 R /TB ${tb} 0 R >> >> /Contents ${content} 0 R >>`);
  objects[pages - 1] = `<< /Type /Pages /Kids [${page} 0 R] /Count 1 >>`;
  const catalog = add(`<< /Type /Catalog /Pages ${pages} 0 R >>`);

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

/**
 * Professional one-page cover letter following the structure and formatting
 * pattern referenced from Indeed: one-inch margins, Times-style 10-12 pt text,
 * sender header, date, salutation, focused body paragraphs, and formal sign-off.
 */
export function coverLetterPdf(profile: CandidateProfile, job: Job, pack: ApplicationPack): Buffer {
  const sizes = [11, 10.75, 10.5, 10.25, 10];
  let rendered = buildStream(profile, job, pack, sizes[sizes.length - 1]);
  for (const size of sizes) {
    const candidate = buildStream(profile, job, pack, size);
    rendered = candidate;
    if (!candidate.overflow && candidate.bottomY >= BOTTOM) break;
  }
  return pdfFromStream(rendered.stream);
}
