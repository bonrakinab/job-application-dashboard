import type { ApplicationPack, CandidateProfile, Job } from './types';
import { normalizeText } from './utils';

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 33;
const RIGHT = A4_WIDTH - MARGIN;

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
  const factor = font === 'TB' || font === 'TBI' || font === 'HB' ? 0.49 : 0.455;
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
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) return value;
  const months = ['Jan', 'Feb', 'March', 'April', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
  return `${months[Number(match[2]) - 1]} ${match[1]}`;
}

function dateRange(start?: string, end?: string) {
  const left = fmtDate(start);
  const right = fmtDate(end);
  return [left, right].filter(Boolean).join(' - ');
}

class ResumeCanvas {
  commands: string[] = [];
  y = 808;

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

  bullet(x: number, y: number, filled = true) {
    if (filled) this.commands.push(`${x.toFixed(2)} ${(y - 1.2).toFixed(2)} 2.3 2.3 re f`);
    else this.text('o', x - 0.5, y - 1.5, 6.2, 'TR');
  }

  section(label: string) {
    this.y -= 1;
    this.text(label.toUpperCase(), MARGIN, this.y, 10.1, 'TR');
    this.rule(this.y - 2.2);
    this.y -= 12.2;
  }

  paragraph(text: string, size = 7.85, lineHeight = 9.15, left = MARGIN, maxWidth = RIGHT - MARGIN) {
    for (const line of wrapWidth(text, maxWidth, size)) {
      this.text(line, left, this.y, size, 'TR');
      this.y -= lineHeight;
    }
  }

  subBullet(text: string, left = MARGIN + 30, size = 7.55) {
    const maxWidth = RIGHT - left;
    const lines = wrapWidth(text, maxWidth, size);
    if (!lines.length) return;
    this.bullet(left - 11, this.y + 1, false);
    lines.forEach((line, index) => {
      this.text(line, left, this.y, size, 'TR');
      this.y -= 8.45;
      if (index === 0) return;
    });
  }
}

function addRole(canvas: ResumeCanvas, profileItem: NonNullable<CandidateProfile['experience']>[number], bullets: string[]) {
  canvas.bullet(MARGIN + 1, canvas.y + 2, true);
  canvas.text(profileItem.organization, MARGIN + 10, canvas.y, 8.8, 'TB');
  if (profileItem.location) canvas.right(profileItem.location, canvas.y, 8.0, 'TR');
  canvas.y -= 9.4;
  canvas.text(profileItem.title, MARGIN + 10, canvas.y, 8.0, 'TI');
  const dates = dateRange(profileItem.start, profileItem.end);
  if (dates) canvas.right(dates, canvas.y, 8.0, 'TI');
  canvas.y -= 8.8;
  for (const bullet of bullets.slice(0, 3)) canvas.subBullet(bullet);
  canvas.y -= 1.5;
}

function buildResumeStream(profile: CandidateProfile, pack: ApplicationPack) {
  const canvas = new ResumeCanvas();
  canvas.center(profile.name, canvas.y, 20.5, 'TB');
  canvas.y -= 16.5;

  const contactParts = [
    profile.phone,
    profile.email,
    profile.links?.linkedin ? 'LinkedIn' : undefined,
    profile.links?.github ? 'GitHub' : undefined,
    profile.links?.portfolio ? 'Portfolio' : undefined,
  ].filter(Boolean) as string[];
  canvas.center(contactParts.join('   |   '), canvas.y, 7.45, 'TR');
  canvas.y -= 9.5;

  canvas.section('Professional Summary');
  canvas.paragraph(pack.resumeSummary, 7.75, 9.0);

  canvas.section('Experience');
  const packExperience = new Map(pack.experience.map((item) => [
    `${normalizeText(item.organization)}|${normalizeText(item.title)}`,
    item,
  ]));
  for (const source of profile.experience ?? []) {
    const selected = packExperience.get(`${normalizeText(source.organization)}|${normalizeText(source.title)}`);
    addRole(canvas, source, selected?.bullets?.length ? selected.bullets : source.bullets.slice(0, 2));
  }

  canvas.section('Skills');
  const selectedSkills = new Set(pack.skills.map(normalizeText));
  const rendered = new Set<string>();
  const groups = profile.skillGroups ?? [];
  for (const group of groups) {
    const skills = group.skills.filter((skill) => selectedSkills.has(normalizeText(skill)));
    if (!skills.length) continue;
    skills.forEach((skill) => rendered.add(normalizeText(skill)));
    canvas.bullet(MARGIN + 1, canvas.y + 2, true);
    const label = `${group.label}:`;
    canvas.text(label, MARGIN + 10, canvas.y, 7.8, 'TB');
    const left = MARGIN + 10 + width(label, 7.8, 'TB') + 4;
    const lines = wrapWidth(skills.join(', '), RIGHT - left, 7.55);
    lines.forEach((line, index) => {
      canvas.text(line, index === 0 ? left : MARGIN + 24, canvas.y, 7.55, 'TR');
      canvas.y -= 8.6;
    });
  }
  const extras = pack.skills.filter((skill) => !rendered.has(normalizeText(skill)));
  if (extras.length) {
    canvas.bullet(MARGIN + 1, canvas.y + 2, true);
    canvas.text('Additional:', MARGIN + 10, canvas.y, 7.8, 'TB');
    const left = MARGIN + 10 + width('Additional:', 7.8, 'TB') + 4;
    const lines = wrapWidth(extras.join(', '), RIGHT - left, 7.55);
    lines.forEach((line, index) => {
      canvas.text(line, index === 0 ? left : MARGIN + 24, canvas.y, 7.55, 'TR');
      canvas.y -= 8.6;
    });
  }
  canvas.y -= 1;

  canvas.section('Projects');
  const sourceProjects = new Map((profile.projects ?? []).map((project) => [normalizeText(project.name), project]));
  for (const selected of pack.projects.slice(0, 4)) {
    const source = sourceProjects.get(normalizeText(selected.name));
    if (!source) continue;
    canvas.bullet(MARGIN + 1, canvas.y + 2, true);
    canvas.text(source.name, MARGIN + 10, canvas.y, 8.25, 'TB');
    const projectSkills = (source.skills ?? []).filter((skill) => selectedSkills.has(normalizeText(skill))).slice(0, 7);
    const tech = projectSkills.length ? projectSkills : (source.skills ?? []).slice(0, 5);
    if (tech.length) {
      const prefixWidth = width(source.name, 8.25, 'TB') + 5;
      const technology = `/ ${tech.join(', ')}`;
      if (prefixWidth + width(technology, 7.15, 'TI') < RIGHT - (MARGIN + 10)) {
        canvas.text(technology, MARGIN + 10 + prefixWidth, canvas.y, 7.15, 'TI');
      }
    }
    canvas.y -= 9.2;
    for (const bullet of selected.bullets.slice(0, 2)) canvas.subBullet(bullet);
    canvas.y -= 1.2;
  }

  canvas.section('Education');
  for (const degree of profile.degrees ?? []) {
    canvas.bullet(MARGIN + 1, canvas.y + 2, true);
    canvas.text(degree.institution, MARGIN + 10, canvas.y, 8.6, 'TB');
    if (degree.location) canvas.right(degree.location, canvas.y, 7.8, 'TR');
    canvas.y -= 9.2;
    const degreeText = [degree.degree, degree.field].filter(Boolean).join(' - ') + (degree.gpa ? `; GPA: ${degree.gpa}` : '');
    canvas.text(degreeText, MARGIN + 10, canvas.y, 7.8, 'TI');
    const dates = dateRange(degree.start, degree.end);
    if (dates) canvas.right(dates, canvas.y, 7.8, 'TI');
    canvas.y -= 9.2;
  }

  canvas.section('Certifications');
  for (const certification of profile.certifications ?? []) {
    canvas.bullet(MARGIN + 1, canvas.y + 2, true);
    canvas.text(certification, MARGIN + 10, canvas.y, 7.45, 'TR');
    canvas.y -= 8.25;
  }

  canvas.center('1', 18, 7.2, 'TR');
  return canvas.commands.join('\n');
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
  const stream = buildResumeStream(profile, pack);
  return pdfFromStreams([stream], [A4_WIDTH, A4_HEIGHT], {
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
