import type { ApplicationPack, CandidateProfile, Job } from './types';
import { normalizeText } from './utils';
import { RESUME_LAYOUT_ATTEMPTS, RESUME_PAGE } from './resume-template';
import { coverLetterBodyParagraphs, coverLetterDate } from './cover-letter';
import { EMBEDDED_RESUME_FONTS } from './resume-fonts';

const A4_WIDTH = RESUME_PAGE.width;
const A4_HEIGHT = RESUME_PAGE.height;
const MARGIN = RESUME_PAGE.margin;
const RIGHT = A4_WIDTH - MARGIN;
const BOTTOM = RESUME_PAGE.bottom;

type FontName = 'TR' | 'TB' | 'TI' | 'TBI' | 'HR' | 'HB';

type LayoutOptions = {
  scale: number;
  maxExperienceBullets: number;
  maxProjects: number;
  maxProjectBullets: number;
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

function width(text: string, size: number, font: FontName = 'TR') {
  const metrics = font === 'TB' || font === 'TBI' || font === 'HB'
    ? EMBEDDED_RESUME_FONTS.bold
    : EMBEDDED_RESUME_FONTS.regular;
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

function fmtDate(value?: string) {
  if (!value) return '';
  return value
    .replace(/^September\b/i, 'Sept')
    .replace(/^August\b/i, 'Aug')
    .replace(/^December\b/i, 'Dec')
    .replace(/^November\b/i, 'Nov')
    .replace(/^October\b/i, 'Oct')
    .replace(/^February\b/i, 'Feb')
    .replace(/^January\b/i, 'Jan');
}

function dateRange(start?: string, end?: string) {
  return [fmtDate(start), fmtDate(end)].filter(Boolean).join(' - ');
}

class ResumeCanvas {
  commands: string[] = [];
  y = 808;
  overflow = false;
  constructor(readonly scale: number) {}
  size(value: number) { return value * this.scale; }
  gap(value: number) { return value * this.scale; }
  text(text: string, x: number, y: number, size: number, font: FontName = 'TR') {
    if (!text) return;
    const position = font === 'TI' || font === 'TBI'
      ? `1 0 0.18 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm`
      : `${x.toFixed(2)} ${y.toFixed(2)} Td`;
    this.commands.push(`BT /${font} ${size.toFixed(2)} Tf ${position} (${escapePdf(text)}) Tj ET`);
  }
  right(text: string, y: number, size: number, font: FontName = 'TR') {
    this.text(text, Math.max(MARGIN, RIGHT - width(text, size, font)), y, size, font);
  }
  center(text: string, y: number, size: number, font: FontName = 'TR') {
    this.text(text, Math.max(MARGIN, (A4_WIDTH - width(text, size, font)) / 2), y, size, font);
  }
  rule(y: number) { this.commands.push(`0.35 w ${MARGIN} ${y.toFixed(2)} m ${RIGHT} ${y.toFixed(2)} l S`); }
  mainBullet(x: number, y: number) {
    const r = 1.5;
    const k = r * 0.55228475;
    this.commands.push(`${(x + r).toFixed(2)} ${y.toFixed(2)} m ${(x + r).toFixed(2)} ${(y + k).toFixed(2)} ${(x + k).toFixed(2)} ${(y + r).toFixed(2)} ${x.toFixed(2)} ${(y + r).toFixed(2)} c ${(x - k).toFixed(2)} ${(y + r).toFixed(2)} ${(x - r).toFixed(2)} ${(y + k).toFixed(2)} ${(x - r).toFixed(2)} ${y.toFixed(2)} c ${(x - r).toFixed(2)} ${(y - k).toFixed(2)} ${(x - k).toFixed(2)} ${(y - r).toFixed(2)} ${x.toFixed(2)} ${(y - r).toFixed(2)} c ${(x + k).toFixed(2)} ${(y - r).toFixed(2)} ${(x + r).toFixed(2)} ${(y - k).toFixed(2)} ${(x + r).toFixed(2)} ${y.toFixed(2)} c f`);
  }
  subBullet(x: number, y: number) { this.text('o', x - 0.3, y - 1.2, this.size(6), 'TR'); }
  consume(amount: number) { this.y -= this.gap(amount); if (this.y < BOTTOM) this.overflow = true; }
  section(label: string) {
    this.consume(1.5);
    this.text(label.toUpperCase(), MARGIN, this.y, this.size(10.5), 'TR');
    this.rule(this.y - this.gap(2));
    this.consume(12.2);
  }
  paragraph(text: string, baseSize = 9.15, lineHeight = 10.35) {
    const size = this.size(baseSize);
    for (const line of wrapWidth(text, RIGHT - MARGIN, size)) { this.text(line, MARGIN, this.y, size); this.consume(lineHeight); }
  }
  subBulletText(text: string, left = MARGIN + 30, baseSize = 8.65, lineHeight = 9.65) {
    const size = this.size(baseSize);
    const lines = wrapWidth(text, RIGHT - left, size);
    if (!lines.length) return;
    this.subBullet(left - 12, this.y + this.gap(0.8));
    for (const line of lines) { this.text(line, left, this.y, size); this.consume(lineHeight); }
  }
}

function fitsSideBySide(
  leftText: string,
  rightText: string,
  leftSize: number,
  rightSize: number,
  leftFont: FontName,
  rightFont: FontName,
  leftX = MARGIN + 11,
  gap = 14,
) {
  if (!rightText) return true;
  return width(leftText, leftSize, leftFont) + width(rightText, rightSize, rightFont) + gap <= RIGHT - leftX;
}

function roleSource(profile: CandidateProfile, organization: string, title: string) {
  return (profile.experience ?? []).find((item) => normalizeText(item.organization) === normalizeText(organization) && normalizeText(item.title) === normalizeText(title));
}

function addRole(canvas: ResumeCanvas, profile: CandidateProfile, item: ApplicationPack['experience'][number], maxBullets: number) {
  const source = roleSource(profile, item.organization, item.title);
  canvas.mainBullet(MARGIN + 1, canvas.y + canvas.gap(1.8));
  canvas.text(item.organization, MARGIN + 11, canvas.y, canvas.size(9.7), 'TB');
  if (source?.location) canvas.right(source.location, canvas.y, canvas.size(8.5));
  canvas.consume(10);
  canvas.text(item.title, MARGIN + 11, canvas.y, canvas.size(8.85), 'TI');
  const dates = dateRange(source?.start, source?.end);
  if (dates) canvas.right(dates, canvas.y, canvas.size(8.5), 'TI');
  canvas.consume(9.4);
  for (const bullet of item.bullets.slice(0, maxBullets)) canvas.subBulletText(bullet);
  canvas.consume(1);
}

function renderSkills(canvas: ResumeCanvas, profile: CandidateProfile, pack: ApplicationPack) {
  const selected = new Set(pack.skills.map(normalizeText));
  const rendered = new Set<string>();
  for (const group of profile.skillGroups ?? []) {
    const skills = group.skills.filter((skill) => selected.has(normalizeText(skill)));
    if (!skills.length) continue;
    skills.forEach((skill) => rendered.add(normalizeText(skill)));
    canvas.mainBullet(MARGIN + 1, canvas.y + canvas.gap(1.7));
    const label = `${group.label}:`;
    const labelSize = canvas.size(8.75);
    canvas.text(label, MARGIN + 11, canvas.y, labelSize, 'TB');
    const left = MARGIN + 11 + width(label, labelSize, 'TB') + 4;
    const bodySize = canvas.size(8.4);
    const lines = wrapWidth(skills.join(', '), RIGHT - left, bodySize);
    lines.forEach((line, index) => { canvas.text(line, index === 0 ? left : MARGIN + 24, canvas.y, bodySize); canvas.consume(9.35); });
  }
  const extras = pack.skills.filter((skill) => !rendered.has(normalizeText(skill)));
  if (extras.length) {
    canvas.mainBullet(MARGIN + 1, canvas.y + canvas.gap(1.7));
    const label = 'Additional:';
    const labelSize = canvas.size(8.75);
    canvas.text(label, MARGIN + 11, canvas.y, labelSize, 'TB');
    const left = MARGIN + 11 + width(label, labelSize, 'TB') + 4;
    const bodySize = canvas.size(8.4);
    const lines = wrapWidth(extras.join(', '), RIGHT - left, bodySize);
    lines.forEach((line, index) => { canvas.text(line, index === 0 ? left : MARGIN + 24, canvas.y, bodySize); canvas.consume(9.35); });
  }
}

function renderProjects(canvas: ResumeCanvas, profile: CandidateProfile, pack: ApplicationPack, options: LayoutOptions) {
  const sources = new Map((profile.projects ?? []).map((project) => [normalizeText(project.name), project]));
  for (const item of pack.projects.slice(0, options.maxProjects)) {
    const source = sources.get(normalizeText(item.name));
    if (!source) continue;
    canvas.mainBullet(MARGIN + 1, canvas.y + canvas.gap(1.8));
    canvas.text(source.name, MARGIN + 11, canvas.y, canvas.size(9.25), 'TB');
    const tech = (source.skills ?? []).filter((skill) => pack.skills.some((selected) => normalizeText(selected) === normalizeText(skill))).slice(0, 6);
    const technology = tech.length ? ` / ${tech.join(', ')}` : '';
    const nameWidth = width(source.name, canvas.size(9.25), 'TB');
    if (technology && nameWidth + width(technology, canvas.size(7.8), 'TI') < RIGHT - (MARGIN + 11)) canvas.text(technology, MARGIN + 14 + nameWidth, canvas.y, canvas.size(7.8), 'TI');
    if (source.linkLabel) canvas.right(source.linkLabel, canvas.y, canvas.size(7.8), 'TI');
    canvas.consume(10);
    for (const bullet of item.bullets.slice(0, options.maxProjectBullets)) canvas.subBulletText(bullet);
    canvas.consume(0.8);
  }
}

function renderEducation(canvas: ResumeCanvas, profile: CandidateProfile) {
  for (const degree of profile.degrees ?? []) {
    const left = MARGIN + 11;
    const institutionSize = canvas.size(9.45);
    const locationSize = canvas.size(8.2);
    const degreeSize = canvas.size(8.45);
    const dateSize = canvas.size(8.2);
    const courseSize = canvas.size(8.05);

    canvas.mainBullet(MARGIN + 1, canvas.y + canvas.gap(1.8));
    canvas.text(degree.institution, left, canvas.y, institutionSize, 'TB');
    if (degree.location && fitsSideBySide(degree.institution, degree.location, institutionSize, locationSize, 'TB', 'TR', left)) {
      canvas.right(degree.location, canvas.y, locationSize);
      canvas.consume(9.8);
    } else {
      canvas.consume(9.8);
      if (degree.location) {
        canvas.right(degree.location, canvas.y, locationSize);
        canvas.consume(8.7);
      }
    }

    const degreeText = [degree.degree, degree.field].filter(Boolean).join(' - ') + (degree.gpa ? `; GPA: ${degree.gpa}` : '');
    const dates = dateRange(degree.start, degree.end);
    canvas.text(degreeText, left, canvas.y, degreeSize, 'TI');
    if (dates && fitsSideBySide(degreeText, dates, degreeSize, dateSize, 'TI', 'TI', left)) {
      canvas.right(dates, canvas.y, dateSize, 'TI');
      canvas.consume(9.6);
    } else {
      canvas.consume(9.6);
      if (dates) {
        canvas.right(dates, canvas.y, dateSize, 'TI');
        canvas.consume(8.7);
      }
    }

    const courses = (degree.coursework ?? []).slice(0, 2);
    if (courses.length) {
      const courseworkText = `Relevant Coursework: ${courses.join(', ')}`;
      for (const line of wrapWidth(courseworkText, RIGHT - left, courseSize, 'TI')) {
        canvas.text(line, left, canvas.y, courseSize, 'TI');
        canvas.consume(8.8);
      }
    }
    canvas.consume(0.8);
  }
}

function buildResumeStream(profile: CandidateProfile, pack: ApplicationPack, options: LayoutOptions) {
  const canvas = new ResumeCanvas(options.scale);
  canvas.center(profile.name, canvas.y, canvas.size(25.5), 'TB');
  canvas.consume(18.5);
  const contact = [profile.phone, profile.email, profile.links?.linkedin ? 'LinkedIn' : undefined, profile.links?.github ? 'GitHub' : undefined, profile.links?.portfolio ? 'Portfolio' : undefined].filter(Boolean) as string[];
  canvas.center(contact.join('   |   '), canvas.y, canvas.size(8.15));
  canvas.consume(10.5);
  canvas.section('Professional Summary');
  canvas.paragraph(pack.resumeSummary);
  canvas.section('Experience');
  for (const item of pack.experience.slice(0, 3)) addRole(canvas, profile, item, options.maxExperienceBullets);
  canvas.section('Skills');
  renderSkills(canvas, profile, pack);
  if (pack.projects.length) { canvas.section('Projects'); renderProjects(canvas, profile, pack, options); }
  canvas.section('Education');
  renderEducation(canvas, profile);
  if ((pack.certifications ?? []).length) {
    canvas.section('Certifications');
    for (const certification of (pack.certifications ?? []).slice(0, 3)) {
      canvas.mainBullet(MARGIN + 1, canvas.y + canvas.gap(1.6));
      canvas.text(certification, MARGIN + 11, canvas.y, canvas.size(8.05));
      canvas.consume(8.8);
    }
  }
  if ((pack.publications ?? []).length) {
    canvas.section('Selected Publication');
    for (const publication of (pack.publications ?? []).slice(0, 1)) canvas.subBulletText(publication, MARGIN + 18, 7.85, 8.7);
  }
  canvas.center('1', 16, canvas.size(6.8));
  return { stream: canvas.commands.join('\n'), overflow: canvas.overflow, bottomY: canvas.y };
}

function pdfFromStreams(streams: string[], pageSize: [number, number], fonts: Record<FontName, 'regular' | 'bold'>) {
  const objects: Buffer[] = [];
  const add = (body: string | Buffer) => {
    objects.push(typeof body === 'string' ? Buffer.from(body, 'ascii') : body);
    return objects.length;
  };
  const variantIds = new Map<'regular' | 'bold', number>();
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

const FONT_MAP: Record<FontName, 'regular' | 'bold'> = { TR: 'regular', TB: 'bold', TI: 'regular', TBI: 'bold', HR: 'regular', HB: 'bold' };

export function resumePdf(profile: CandidateProfile, _job: Job, pack: ApplicationPack): Buffer {
  const attempts: LayoutOptions[] = RESUME_LAYOUT_ATTEMPTS.map((attempt) => ({ ...attempt }));
  let best = buildResumeStream(profile, pack, attempts[attempts.length - 1]);
  for (const attempt of attempts) {
    const candidate = buildResumeStream(profile, pack, attempt);
    best = candidate;
    if (!candidate.overflow && candidate.bottomY >= BOTTOM) break;
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
