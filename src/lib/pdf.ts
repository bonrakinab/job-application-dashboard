import type { ApplicationPack, CandidateProfile, Job } from './types';
import { normalizeText } from './utils';
import { RESUME_LAYOUT_ATTEMPTS, RESUME_PAGE } from './resume-template';

const A4_WIDTH = RESUME_PAGE.width;
const A4_HEIGHT = RESUME_PAGE.height;
const MARGIN = RESUME_PAGE.margin;
const RIGHT = A4_WIDTH - MARGIN;
const BOTTOM = RESUME_PAGE.bottom;

type FontName = 'TR' | 'TB' | 'TI' | 'TBI' | 'HR' | 'HB';

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
  const factor = font === 'TB' || font === 'TBI' || font === 'HB' ? 0.47 : 0.44;
  return ascii(text).length * size * factor;
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

type LayoutOptions = {
  scale: number;
  maxExperienceBullets: number;
  maxProjects: number;
  maxProjectBullets: number;
};

class ResumeCanvas {
  commands: string[] = [];
  y = 810;
  overflow = false;
  constructor(readonly scale: number) {}

  size(value: number) { return value * this.scale; }
  gap(value: number) { return value * this.scale; }

  text(text: string, x: number, y: number, size: number, font: FontName = 'TR') {
    if (!text) return;
    this.commands.push(`BT /${font} ${size.toFixed(2)} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdf(text)}) Tj ET`);
  }

  right(text: string, y: number, size: number, font: FontName = 'TR') {
    this.text(text, Math.max(MARGIN, RIGHT - width(text, size, font)), y, size, font);
  }

  center(text: string, y: number, size: number, font: FontName = 'TR') {
    this.text(text, Math.max(MARGIN, (A4_WIDTH - width(text, size, font)) / 2), y, size, font);
  }

  rule(y: number) {
    this.commands.push(`0.35 w ${MARGIN.toFixed(2)} ${y.toFixed(2)} m ${RIGHT.toFixed(2)} ${y.toFixed(2)} l S`);
  }

  mainBullet(x: number, y: number) {
    const r = 1.55;
    const k = r * 0.55228475;
    const cy = y;
    this.commands.push(`${(x + r).toFixed(2)} ${cy.toFixed(2)} m ${(x + r).toFixed(2)} ${(cy + k).toFixed(2)} ${(x + k).toFixed(2)} ${(cy + r).toFixed(2)} ${x.toFixed(2)} ${(cy + r).toFixed(2)} c ${(x - k).toFixed(2)} ${(cy + r).toFixed(2)} ${(x - r).toFixed(2)} ${(cy + k).toFixed(2)} ${(x - r).toFixed(2)} ${cy.toFixed(2)} c ${(x - r).toFixed(2)} ${(cy - k).toFixed(2)} ${(x - k).toFixed(2)} ${(cy - r).toFixed(2)} ${x.toFixed(2)} ${(cy - r).toFixed(2)} c ${(x + k).toFixed(2)} ${(cy - r).toFixed(2)} ${(x + r).toFixed(2)} ${(cy - k).toFixed(2)} ${(x + r).toFixed(2)} ${cy.toFixed(2)} c f`);
  }

  subBullet(x: number, y: number) {
    this.text('o', x - 0.3, y - 1.2, this.size(6.0), 'TR');
  }

  consume(amount: number) {
    this.y -= this.gap(amount);
    if (this.y < BOTTOM) this.overflow = true;
  }

  section(label: string) {
    this.consume(1.5);
    this.text(label.toUpperCase(), MARGIN, this.y, this.size(9.5), 'TR');
    this.rule(this.y - this.gap(2.0));
    this.consume(11.0);
  }

  paragraph(text: string, baseSize = 8.0, baseLineHeight = 9.25) {
    const size = this.size(baseSize);
    for (const line of wrapWidth(text, RIGHT - MARGIN, size, 'TR')) {
      this.text(line, MARGIN, this.y, size, 'TR');
      this.consume(baseLineHeight);
    }
  }

  subBulletText(text: string, left = MARGIN + 30, baseSize = 7.55, baseLineHeight = 8.3) {
    const size = this.size(baseSize);
    const lines = wrapWidth(text, RIGHT - left, size, 'TR');
    if (!lines.length) return;
    this.subBullet(left - 12, this.y + this.gap(0.8));
    for (const line of lines) {
      this.text(line, left, this.y, size, 'TR');
      this.consume(baseLineHeight);
    }
  }
}

function roleSource(profile: CandidateProfile, organization: string, title: string) {
  return (profile.experience ?? []).find((item) => normalizeText(item.organization) === normalizeText(organization) && normalizeText(item.title) === normalizeText(title));
}

function addRole(canvas: ResumeCanvas, profile: CandidateProfile, item: ApplicationPack['experience'][number], maxBullets: number) {
  const source = roleSource(profile, item.organization, item.title);
  canvas.mainBullet(MARGIN + 1, canvas.y + canvas.gap(1.8));
  canvas.text(item.organization, MARGIN + 11, canvas.y, canvas.size(8.7), 'TB');
  if (source?.location) canvas.right(source.location, canvas.y, canvas.size(7.65), 'TR');
  canvas.consume(8.7);
  canvas.text(item.title, MARGIN + 11, canvas.y, canvas.size(7.85), 'TI');
  const dates = dateRange(source?.start, source?.end);
  if (dates) canvas.right(dates, canvas.y, canvas.size(7.65), 'TI');
  canvas.consume(8.1);
  for (const bullet of item.bullets.slice(0, maxBullets)) canvas.subBulletText(bullet);
  canvas.consume(1.0);
}

function renderSkillGroups(canvas: ResumeCanvas, profile: CandidateProfile, pack: ApplicationPack) {
  const selected = new Set(pack.skills.map(normalizeText));
  const rendered = new Set<string>();
  for (const group of profile.skillGroups ?? []) {
    const skills = group.skills.filter((skill) => selected.has(normalizeText(skill)));
    if (!skills.length) continue;
    skills.forEach((skill) => rendered.add(normalizeText(skill)));
    canvas.mainBullet(MARGIN + 1, canvas.y + canvas.gap(1.7));
    const label = `${group.label}:`;
    const labelSize = canvas.size(7.7);
    canvas.text(label, MARGIN + 11, canvas.y, labelSize, 'TB');
    const left = MARGIN + 11 + width(label, labelSize, 'TB') + 4;
    const bodySize = canvas.size(7.45);
    const lines = wrapWidth(skills.join(', '), RIGHT - left, bodySize, 'TR');
    lines.forEach((line, index) => {
      canvas.text(line, index === 0 ? left : MARGIN + 24, canvas.y, bodySize, 'TR');
      canvas.consume(8.0);
    });
  }
  const extras = pack.skills.filter((skill) => !rendered.has(normalizeText(skill)));
  if (extras.length) {
    canvas.mainBullet(MARGIN + 1, canvas.y + canvas.gap(1.7));
    const label = 'Additional:';
    const labelSize = canvas.size(7.7);
    canvas.text(label, MARGIN + 11, canvas.y, labelSize, 'TB');
    const left = MARGIN + 11 + width(label, labelSize, 'TB') + 4;
    const bodySize = canvas.size(7.45);
    const lines = wrapWidth(extras.join(', '), RIGHT - left, bodySize, 'TR');
    lines.forEach((line, index) => {
      canvas.text(line, index === 0 ? left : MARGIN + 24, canvas.y, bodySize, 'TR');
      canvas.consume(8.0);
    });
  }
}

function renderProjects(canvas: ResumeCanvas, profile: CandidateProfile, pack: ApplicationPack, options: LayoutOptions) {
  const sourceProjects = new Map((profile.projects ?? []).map((project) => [normalizeText(project.name), project]));
  for (const item of pack.projects.slice(0, options.maxProjects)) {
    const source = sourceProjects.get(normalizeText(item.name));
    if (!source) continue;
    canvas.mainBullet(MARGIN + 1, canvas.y + canvas.gap(1.8));
    canvas.text(source.name, MARGIN + 11, canvas.y, canvas.size(8.1), 'TB');
    const tech = (source.skills ?? []).filter((skill) => pack.skills.some((selected) => normalizeText(selected) === normalizeText(skill))).slice(0, 6);
    const technology = tech.length ? ` / ${tech.join(', ')}` : '';
    const projectWidth = width(source.name, canvas.size(8.1), 'TB');
    if (technology && projectWidth + width(technology, canvas.size(7.0), 'TI') < RIGHT - (MARGIN + 11)) {
      canvas.text(technology, MARGIN + 11 + projectWidth + 3, canvas.y, canvas.size(7.0), 'TI');
    }
    if (source.linkLabel) canvas.right(source.linkLabel, canvas.y, canvas.size(7.0), 'TI');
    canvas.consume(8.7);
    for (const bullet of item.bullets.slice(0, options.maxProjectBullets)) canvas.subBulletText(bullet);
    canvas.consume(0.8);
  }
}

function buildResumeStream(profile: CandidateProfile, pack: ApplicationPack, options: LayoutOptions) {
  const canvas = new ResumeCanvas(options.scale);
  canvas.center(profile.name, canvas.y, canvas.size(24.5), 'TB');
  canvas.consume(17.0);

  const contactParts = [
    profile.phone,
    profile.email,
    profile.links?.linkedin ? 'LinkedIn' : undefined,
    profile.links?.github ? 'GitHub' : undefined,
    profile.links?.portfolio ? 'Portfolio' : undefined,
  ].filter(Boolean) as string[];
  canvas.center(contactParts.join('   |   '), canvas.y, canvas.size(7.25), 'TR');
  canvas.consume(9.0);

  canvas.section('Professional Summary');
  canvas.paragraph(pack.resumeSummary, 7.85, 8.9);

  canvas.section('Experience');
  for (const item of pack.experience) addRole(canvas, profile, item, options.maxExperienceBullets);

  canvas.section('Skills');
  renderSkillGroups(canvas, profile, pack);

  if (pack.projects.length) {
    canvas.section('Projects');
    renderProjects(canvas, profile, pack, options);
  }

  canvas.section('Education');
  for (const degree of profile.degrees ?? []) {
    canvas.mainBullet(MARGIN + 1, canvas.y + canvas.gap(1.8));
    canvas.text(degree.institution, MARGIN + 11, canvas.y, canvas.size(8.45), 'TB');
    if (degree.location) canvas.right(degree.location, canvas.y, canvas.size(7.4), 'TR');
    canvas.consume(8.6);
    const degreeText = [degree.degree, degree.field].filter(Boolean).join(' - ') + (degree.gpa ? `; GPA: ${degree.gpa}` : '');
    canvas.text(degreeText, MARGIN + 11, canvas.y, canvas.size(7.55), 'TI');
    const dates = dateRange(degree.start, degree.end);
    if (dates) canvas.right(dates, canvas.y, canvas.size(7.4), 'TI');
    canvas.consume(8.5);
  }

  if ((profile.certifications ?? []).length) {
    canvas.section('Certifications');
    for (const certification of profile.certifications ?? []) {
      canvas.mainBullet(MARGIN + 1, canvas.y + canvas.gap(1.6));
      canvas.text(certification, MARGIN + 11, canvas.y, canvas.size(7.15), 'TR');
      canvas.consume(7.7);
    }
  }

  canvas.center('1', 16, canvas.size(6.8), 'TR');
  return { stream: canvas.commands.join('\n'), overflow: canvas.overflow, bottomY: canvas.y };
}

function pdfFromStreams(streams: string[], pageSize: [number, number], fonts: Record<FontName, string>) {
  const objects: string[] = [];
  const add = (body: string) => { objects.push(body); return objects.length; };
  const fontIds = Object.fromEntries(Object.entries(fonts).map(([key, base]) => [key, add(`<< /Type /Font /Subtype /Type1 /BaseFont /${base} >>`)]));
  const pagesId = add('');
  const pageIds: number[] = [];
  for (const stream of streams) {
    const contentId = add(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`);
    const fontResources = Object.entries(fontIds).map(([key, id]) => `/${key} ${id} 0 R`).join(' ');
    const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageSize[0]} ${pageSize[1]}] /Resources << /Font << ${fontResources} >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  }
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

export function resumePdf(profile: CandidateProfile, _job: Job, pack: ApplicationPack): Buffer {
  const attempts: LayoutOptions[] = RESUME_LAYOUT_ATTEMPTS.map((attempt) => ({ ...attempt }));
  let rendered = buildResumeStream(profile, pack, attempts[attempts.length - 1]);
  for (const attempt of attempts) {
    const candidate = buildResumeStream(profile, pack, attempt);
    rendered = candidate;
    if (!candidate.overflow && candidate.bottomY >= BOTTOM) break;
  }
  return pdfFromStreams([rendered.stream], [A4_WIDTH, A4_HEIGHT], {
    TR: 'Times-Roman',
    TB: 'Times-Bold',
    TI: 'Times-Italic',
    TBI: 'Times-BoldItalic',
    HR: 'Helvetica',
    HB: 'Helvetica-Bold',
  });
}

function wrap(text: string, widthChars = 92) {
  const words = ascii(text).split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > widthChars && line) { lines.push(line); line = word; }
    else line = (line + ' ' + word).trim();
  }
  if (line) lines.push(line);
  return lines;
}

function pageStreams(lines: Array<{ text: string; size?: number; bold?: boolean; gap?: number }>) {
  const pages: string[][] = [[]];
  let y = 756;
  for (const item of lines) {
    const size = item.size ?? 10;
    const gap = item.gap ?? Math.max(13, size + 3);
    for (const line of wrap(item.text, size >= 15 ? 72 : 96)) {
      if (y < 52) { pages.push([]); y = 756; }
      const font = item.bold ? 'HB' : 'HR';
      pages.at(-1)!.push(`BT /${font} ${size} Tf 54 ${y} Td (${escapePdf(line)}) Tj ET`);
      y -= gap;
    }
    y -= item.gap ? 2 : 0;
  }
  return pages.map((page) => page.join('\n'));
}

export function coverLetterPdf(profile: CandidateProfile, job: Job, pack: ApplicationPack): Buffer {
  const lines: Array<{ text: string; size?: number; bold?: boolean; gap?: number }> = [
    { text: profile.name, size: 16, bold: true, gap: 22 },
    { text: [profile.email, profile.phone, profile.location].filter(Boolean).join(' | '), size: 9, gap: 16 },
    { text: `Re: ${job.title} - ${job.company}`, size: 11, bold: true, gap: 18 },
    ...pack.coverLetter.split(/\n+/).filter(Boolean).map((text) => ({ text, size: 10, gap: 15 })),
  ];
  return pdfFromStreams(pageStreams(lines), [612, 792], {
    TR: 'Times-Roman', TB: 'Times-Bold', TI: 'Times-Italic', TBI: 'Times-BoldItalic', HR: 'Helvetica', HB: 'Helvetica-Bold',
  });
}
