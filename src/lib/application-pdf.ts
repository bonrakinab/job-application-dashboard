import type { ApplicationPack, CandidateProfile, Job } from './types';
import { normalizeText } from './utils';
import { RESUME_LAYOUT_ATTEMPTS, RESUME_PAGE } from './resume-template';
import { coverLetterBodyParagraphs, coverLetterDate } from './cover-letter';
import { EMBEDDED_RESUME_FONTS } from './resume-fonts';
import { formatResumeDateRange, resumeTemplateContactItems } from './resume-content';
import { organizedResumeSkillGroups } from './resume-skill-groups';

const A4_WIDTH = RESUME_PAGE.width;
const A4_HEIGHT = RESUME_PAGE.height;
const MARGIN = RESUME_PAGE.margin;
const RIGHT = A4_WIDTH - MARGIN;
const BOTTOM = RESUME_PAGE.bottom;

type FontName = 'TR' | 'TB' | 'TI' | 'TBI' | 'HR' | 'HB';
type FontVariant = 'regular' | 'bold' | 'italic' | 'boldItalic';
type LayoutOptions = {
  scale: number;
  maxExperienceBullets: number;
  maxProjects: number;
  maxProjectBullets: number;
  maxSkills: number;
};

function ascii(text: string) {
  return text
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/→/g, '->')
    .replace(/≈/g, 'approximately ')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapePdf(text: string) {
  return ascii(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function variantFor(font: FontName): FontVariant {
  if (font === 'TB' || font === 'HB') return 'bold';
  if (font === 'TI') return 'italic';
  if (font === 'TBI') return 'boldItalic';
  return 'regular';
}

function fontMetrics(font: FontName) {
  return EMBEDDED_RESUME_FONTS[variantFor(font)];
}

function width(text: string, size: number, font: FontName = 'TR') {
  const metrics = fontMetrics(font);
  const units = [...ascii(text)].reduce((total, character) => {
    const code = character.charCodeAt(0);
    return total + (metrics.widths[code - 32] ?? metrics.widths[0]);
  }, 0);
  return units * size / 1000;
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
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

function fittedSize(text: string, maxWidth: number, preferred: number, minimum: number, font: FontName = 'TR') {
  let size = preferred;
  while (size > minimum && width(text, size, font) > maxWidth) size -= 0.15;
  return Math.max(minimum, size);
}

class ResumeCanvas {
  commands: string[] = [];
  // Baseline measured against the supplied one-page LaTeX reference.
  y = 785;
  overflow = false;
  constructor(readonly scale: number) {}
  size(value: number) { return value * this.scale; }
  gap(value: number) { return value * this.scale; }
  text(text: string, x: number, y: number, size: number, font: FontName = 'TR') {
    if (!text) return;
    if (x < MARGIN - 2 || x + width(text, size, font) > RIGHT + 0.5 || y < BOTTOM) this.overflow = true;
    this.commands.push(`BT /${font} ${size.toFixed(2)} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdf(text)}) Tj ET`);
  }
  right(text: string, y: number, size: number, font: FontName = 'TR') {
    this.text(text, Math.max(MARGIN, RIGHT - width(text, size, font)), y, size, font);
  }
  center(text: string, y: number, size: number, font: FontName = 'TR') {
    this.text(text, Math.max(MARGIN, (A4_WIDTH - width(text, size, font)) / 2), y, size, font);
  }
  footer(text: string, y: number, size: number, font: FontName = 'TR') {
    const x = Math.max(0, (A4_WIDTH - width(text, size, font)) / 2);
    this.commands.push(`BT /${font} ${size.toFixed(2)} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdf(text)}) Tj ET`);
  }
  smallCaps(text: string, x: number, y: number, largeSize: number, smallSize: number) {
    let cursor = x;
    for (const original of ascii(text)) {
      const isLower = original >= 'a' && original <= 'z';
      const glyph = isLower ? original.toUpperCase() : original;
      const size = isLower ? smallSize : largeSize;
      this.text(glyph, cursor, y, size, 'TR');
      cursor += width(glyph, size, 'TR');
    }
  }
  rule(y: number) { this.commands.push(`0.35 w ${MARGIN} ${y.toFixed(2)} m ${RIGHT} ${y.toFixed(2)} l S`); }
  mainBullet(x: number, y: number) {
    const r = 1.35; const k = r * 0.55228475;
    this.commands.push(`${(x + r).toFixed(2)} ${y.toFixed(2)} m ${(x + r).toFixed(2)} ${(y + k).toFixed(2)} ${(x + k).toFixed(2)} ${(y + r).toFixed(2)} ${x.toFixed(2)} ${(y + r).toFixed(2)} c ${(x - k).toFixed(2)} ${(y + r).toFixed(2)} ${(x - r).toFixed(2)} ${(y + k).toFixed(2)} ${(x - r).toFixed(2)} ${y.toFixed(2)} c ${(x - r).toFixed(2)} ${(y - k).toFixed(2)} ${(x - k).toFixed(2)} ${(y - r).toFixed(2)} ${x.toFixed(2)} ${(y - r).toFixed(2)} c ${(x + k).toFixed(2)} ${(y - r).toFixed(2)} ${(x + r).toFixed(2)} ${(y - k).toFixed(2)} ${(x + r).toFixed(2)} ${y.toFixed(2)} c f`);
  }
  subBullet(x: number, y: number) {
    const r = 1.25; const k = r * 0.55228475;
    this.commands.push(`0.42 w ${(x + r).toFixed(2)} ${y.toFixed(2)} m ${(x + r).toFixed(2)} ${(y + k).toFixed(2)} ${(x + k).toFixed(2)} ${(y + r).toFixed(2)} ${x.toFixed(2)} ${(y + r).toFixed(2)} c ${(x - k).toFixed(2)} ${(y + r).toFixed(2)} ${(x - r).toFixed(2)} ${(y + k).toFixed(2)} ${(x - r).toFixed(2)} ${y.toFixed(2)} c ${(x - r).toFixed(2)} ${(y - k).toFixed(2)} ${(x - k).toFixed(2)} ${(y - r).toFixed(2)} ${x.toFixed(2)} ${(y - r).toFixed(2)} c ${(x + k).toFixed(2)} ${(y - r).toFixed(2)} ${(x + r).toFixed(2)} ${(y - k).toFixed(2)} ${(x + r).toFixed(2)} ${y.toFixed(2)} c S`);
  }
  consume(amount: number) { this.y -= this.gap(amount); if (this.y < BOTTOM) this.overflow = true; }
  section(label: string) {
    this.consume(0.8);
    // The reference uses CMCSC10. Reproduce its visual hierarchy with genuine
    // Computer Modern glyphs and small-cap sizing instead of a plain heading.
    this.smallCaps(label, MARGIN, this.y, this.size(11.96), this.size(9.55));
    this.rule(this.y - this.gap(2.4));
    this.consume(13.4);
  }
  paragraph(text: string, baseSize = 9.96, lineHeight = 11.05) {
    const size = this.size(baseSize);
    for (const line of wrapWidth(text, RIGHT - MARGIN, size)) {
      this.text(line, MARGIN, this.y, size);
      this.consume(lineHeight);
    }
  }
  subBulletText(text: string, left = MARGIN + 31, baseSize = 9.96, lineHeight = 11.05) {
    const size = this.size(baseSize);
    const lines = wrapWidth(text, RIGHT - left, size);
    if (!lines.length) return;
    this.subBullet(left - 11, this.y + this.gap(2.45));
    for (const line of lines) {
      this.text(line, left, this.y, size);
      this.consume(lineHeight);
    }
  }
}

function fitsSideBySide(leftText: string, rightText: string, leftSize: number, rightSize: number, leftFont: FontName, rightFont: FontName, leftX = MARGIN + 10, gap = 14) {
  if (!rightText) return true;
  return width(leftText, leftSize, leftFont) + width(rightText, rightSize, rightFont) + gap <= RIGHT - leftX;
}

function roleSource(profile: CandidateProfile, organization: string, title: string) {
  return (profile.experience ?? []).find((item) => normalizeText(item.organization) === normalizeText(organization) && normalizeText(item.title) === normalizeText(title));
}

function pairedRow(canvas: ResumeCanvas, leftText: string, rightText: string, baseSize: number, rightSize: number, font: FontName = 'TR', rightFont: FontName = 'TR') {
  const left = MARGIN + 10;
  const size = canvas.size(baseSize);
  if (fitsSideBySide(leftText, rightText, size, canvas.size(rightSize), font, rightFont, left)) {
    const lines = wrapWidth(leftText, RIGHT - left - (rightText ? width(rightText, canvas.size(rightSize), rightFont) + 14 : 0), size, font);
    for (const [index, line] of lines.entries()) {
      canvas.text(line, left, canvas.y, size, font);
      if (index === 0 && rightText) canvas.right(rightText, canvas.y, canvas.size(rightSize), rightFont);
      canvas.consume(baseSize + 1.0);
    }
  } else {
    for (const line of wrapWidth(leftText, RIGHT - left, size, font)) {
      canvas.text(line, left, canvas.y, size, font);
      canvas.consume(baseSize + 1.0);
    }
    for (const line of wrapWidth(rightText, RIGHT - left, canvas.size(rightSize), rightFont)) {
      canvas.right(line, canvas.y, canvas.size(rightSize), rightFont);
      canvas.consume(rightSize + 1.0);
    }
  }
}

function addRole(canvas: ResumeCanvas, profile: CandidateProfile, item: ApplicationPack['experience'][number], maxBullets: number, roleIndex: number) {
  const source = roleSource(profile, item.organization, item.title);
  canvas.mainBullet(MARGIN + 1.5, canvas.y + canvas.gap(2));
  pairedRow(canvas, item.organization, source?.location ?? '', 9.96, 9.96, 'TB');
  pairedRow(canvas, item.title, formatResumeDateRange(source?.start, source?.end), 9.96, 9.96, 'TI', 'TI');
  const referenceBudget = roleIndex === 0 ? 3 : roleIndex === 1 ? 2 : 1;
  for (const bullet of item.bullets.slice(0, Math.min(maxBullets, referenceBudget))) canvas.subBulletText(bullet);
  canvas.consume(0.8);
}

function renderSkills(canvas: ResumeCanvas, profile: CandidateProfile, pack: ApplicationPack, maxSkills: number) {
  const groups = organizedResumeSkillGroups(profile, pack.skills.slice(0, maxSkills));
  for (const group of groups) {
    canvas.mainBullet(MARGIN + 1.5, canvas.y + canvas.gap(2));
    const label = `${group.label}:`;
    const labelSize = canvas.size(9.96);
    canvas.text(label, MARGIN + 10, canvas.y, labelSize, 'TB');
    const left = MARGIN + 10 + width(label, labelSize, 'TB') + 4;
    const bodySize = canvas.size(9.96);
    const lines = wrapWidth(group.skills.join(', '), RIGHT - left, bodySize);
    lines.forEach((line, index) => {
      canvas.text(line, index === 0 ? left : MARGIN + 21, canvas.y, bodySize);
      canvas.consume(11.0);
    });
  }
}

function renderProjects(canvas: ResumeCanvas, profile: CandidateProfile, pack: ApplicationPack, options: LayoutOptions) {
  const sources = new Map((profile.projects ?? []).map((project) => [normalizeText(project.name), project]));
  for (const item of pack.projects.slice(0, options.maxProjects)) {
    const source = sources.get(normalizeText(item.name));
    if (!source) continue;
    canvas.mainBullet(MARGIN + 1.5, canvas.y + canvas.gap(2));
    pairedRow(canvas, source.name, '', 9.96, 9.96, 'TB', 'TI');
    for (const bullet of item.bullets.slice(0, options.maxProjectBullets)) canvas.subBulletText(bullet, MARGIN + 31, 9.96, 11.05);
    canvas.consume(0.8);
  }
}

function renderEducation(canvas: ResumeCanvas, profile: CandidateProfile) {
  for (const degree of profile.degrees ?? []) {
    canvas.mainBullet(MARGIN + 1.5, canvas.y + canvas.gap(2));
    pairedRow(canvas, degree.institution, degree.location ?? '', 9.96, 9.96, 'TB');
    const degreeText = [degree.degree, degree.field].filter(Boolean).join(' - ') + (degree.gpa ? `; GPA: ${degree.gpa}` : '');
    pairedRow(canvas, degreeText, formatResumeDateRange(degree.start, degree.end), 9.96, 9.96, 'TI', 'TI');
    canvas.consume(0.6);
  }
}

function buildResumeStream(profile: CandidateProfile, pack: ApplicationPack, options: LayoutOptions) {
  const canvas = new ResumeCanvas(options.scale);
  const nameSize = canvas.size(24.79);
  canvas.center(profile.name, canvas.y, nameSize, 'TB');
  canvas.consume(20.8);

  const contactText = resumeTemplateContactItems(profile).join('   ');
  if (contactText) {
    const contactSize = fittedSize(contactText, RIGHT - MARGIN, canvas.size(8.97), canvas.size(8.2));
    canvas.center(contactText, canvas.y, contactSize);
    canvas.consume(13.1);
  }

  canvas.section('Professional Summary');
  canvas.paragraph(pack.resumeSummary);
  canvas.section('Experience');
  pack.experience.slice(0, 3).forEach((item, index) => addRole(canvas, profile, item, options.maxExperienceBullets, index));
  canvas.section('Skills');
  renderSkills(canvas, profile, pack, options.maxSkills);
  if (pack.projects.length) {
    canvas.section('Projects');
    renderProjects(canvas, profile, pack, options);
  }
  canvas.section('Education');
  renderEducation(canvas, profile);
  if ((pack.certifications ?? []).length) {
    canvas.section('Certifications');
    for (const certification of pack.certifications ?? []) {
      canvas.mainBullet(MARGIN + 1.5, canvas.y + canvas.gap(2));
      for (const line of wrapWidth(certification, RIGHT - MARGIN - 10, canvas.size(9.96))) {
        canvas.text(line, MARGIN + 10, canvas.y, canvas.size(9.96));
        canvas.consume(10.85);
      }
    }
  }
  canvas.footer('1', 7.5, canvas.size(6.8));
  return { stream: canvas.commands.join('\n'), overflow: canvas.overflow, bottomY: canvas.y };
}

function pdfFromStreams(streams: string[], pageSize: [number, number], fonts: Record<FontName, FontVariant>) {
  const objects: Buffer[] = [];
  const add = (body: string | Buffer) => {
    objects.push(typeof body === 'string' ? Buffer.from(body, 'ascii') : body);
    return objects.length;
  };
  const variantIds = new Map<FontVariant, number>();
  for (const variant of [...new Set(Object.values(fonts))]) {
    const definition = EMBEDDED_RESUME_FONTS[variant];
    const fontFileId = add(Buffer.concat([
      Buffer.from(`<< /Length ${definition.data.length} /Length1 ${definition.data.length} >>\nstream\n`, 'ascii'),
      definition.data,
      Buffer.from('\nendstream', 'ascii'),
    ]));
    const descriptorId = add(`<< /Type /FontDescriptor /FontName /${definition.baseFont} /Flags ${definition.flags} /FontBBox [${definition.bbox.join(' ')}] /ItalicAngle ${definition.italicAngle} /Ascent ${definition.ascent} /Descent ${definition.descent} /CapHeight ${definition.capHeight} /StemV ${definition.stemV} /MissingWidth ${definition.widths[0]} /FontFile2 ${fontFileId} 0 R >>`);
    const fontId = add(`<< /Type /Font /Subtype /TrueType /BaseFont /${definition.baseFont} /FirstChar 32 /LastChar 126 /Widths [${definition.widths.join(' ')}] /Encoding /WinAnsiEncoding /FontDescriptor ${descriptorId} 0 R >>`);
    variantIds.set(variant, fontId);
  }
  const fontIds = Object.fromEntries(Object.entries(fonts).map(([key, variant]) => [key, variantIds.get(variant)!]));
  const pagesId = add('');
  const pageIds: number[] = [];
  for (const stream of streams) {
    const contentId = add(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`);
    const resources = Object.entries(fontIds).map(([key, id]) => `/${key} ${id} 0 R`).join(' ');
    pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageSize[0]} ${pageSize[1]}] /Resources << /Font << ${resources} >> >> /Contents ${contentId} 0 R >>`));
  }
  objects[pagesId - 1] = Buffer.from(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`, 'ascii');
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n', 'binary')];
  const offsets = [0];
  let length = chunks[0].length;
  objects.forEach((body, index) => {
    offsets.push(length);
    const object = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`, 'ascii'), body, Buffer.from('\nendobj\n', 'ascii')]);
    chunks.push(object);
    length += object.length;
  });
  const xref = length;
  let trailer = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) trailer += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  trailer += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  chunks.push(Buffer.from(trailer, 'ascii'));
  return Buffer.concat(chunks);
}

const FONT_MAP: Record<FontName, FontVariant> = {
  TR: 'regular',
  TB: 'bold',
  TI: 'italic',
  TBI: 'boldItalic',
  HR: 'regular',
  HB: 'bold',
};

export function resumePdf(profile: CandidateProfile, _job: Job, pack: ApplicationPack): Buffer {
  const attempts: LayoutOptions[] = RESUME_LAYOUT_ATTEMPTS.map((attempt) => ({ ...attempt }));
  let best = buildResumeStream(profile, pack, attempts[attempts.length - 1]);
  for (const attempt of attempts) {
    const candidate = buildResumeStream(profile, pack, attempt);
    best = candidate;
    if (!candidate.overflow && candidate.bottomY >= BOTTOM) break;
  }
  if (best.overflow || best.bottomY < BOTTOM) {
    throw new Error('The selected resume evidence cannot fit safely on one A4 page. Reduce the selected evidence before export.');
  }
  return pdfFromStreams([best.stream], [A4_WIDTH, A4_HEIGHT], FONT_MAP);
}

class LetterCanvas {
  commands: string[] = [];
  y = 742;
  readonly left = 58;
  readonly right = 554;
  text(text: string, x: number, y: number, size: number, font: FontName = 'HR') {
    if (text) this.commands.push(`BT /${font} ${size.toFixed(2)} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdf(text)}) Tj ET`);
  }
  center(text: string, y: number, size: number, font: FontName = 'HR') { this.text(text, (612 - width(text, size, font)) / 2, y, size, font); }
  line(y: number) { this.commands.push(`0.45 w ${this.left} ${y.toFixed(2)} m ${this.right} ${y.toFixed(2)} l S`); }
  paragraph(text: string, size: number, lineHeight: number) {
    for (const line of wrapWidth(text, this.right - this.left, size, 'HR')) { this.text(line, this.left, this.y, size, 'HR'); this.y -= lineHeight; }
  }
}

function buildCoverLetterStream(profile: CandidateProfile, job: Job, pack: ApplicationPack) {
  const c = new LetterCanvas();
  c.center(profile.name, c.y, 18.5, 'HB');
  c.y -= 18;
  c.center([profile.phone, profile.email, profile.location].filter(Boolean).join('  |  '), c.y, 8.7, 'HR');
  c.y -= 12;
  c.line(c.y);
  c.y -= 25;
  c.text(coverLetterDate(), c.left, c.y, 10, 'HR');
  c.y -= 28;
  c.text('Hiring Manager', c.left, c.y, 10, 'HB');
  c.y -= 14;
  c.text(job.company, c.left, c.y, 10, 'HR');
  if (job.location) { c.y -= 14; c.text(job.location, c.left, c.y, 10, 'HR'); }
  c.y -= 28;
  c.text(`Re: ${job.title}`, c.left, c.y, 10.5, 'HB');
  c.y -= 30;
  c.text('Dear Hiring Manager,', c.left, c.y, 10.5, 'HR');
  c.y -= 25;
  const paragraphs = coverLetterBodyParagraphs(pack);
  const totalChars = paragraphs.join(' ').length;
  const bodySize = totalChars > 2200 ? 9.6 : totalChars > 1750 ? 9.9 : 10.2;
  const lineHeight = bodySize + 3.2;
  for (const paragraph of paragraphs) { c.paragraph(paragraph, bodySize, lineHeight); c.y -= 11; }
  c.y -= 5;
  c.text('Sincerely,', c.left, c.y, 10.5, 'HR');
  c.y -= 28;
  c.text(profile.name, c.left, c.y, 10.5, 'HB');
  return c.commands.join('\n');
}

export function coverLetterPdf(profile: CandidateProfile, job: Job, pack: ApplicationPack): Buffer {
  return pdfFromStreams([buildCoverLetterStream(profile, job, pack)], [612, 792], FONT_MAP);
}
