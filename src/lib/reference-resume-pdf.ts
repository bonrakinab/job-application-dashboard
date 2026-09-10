import type { ApplicationPack, CandidateProfile, Job } from './types';
import { normalizeText } from './utils';
import { RESUME_LAYOUT_ATTEMPTS, RESUME_PAGE } from './resume-template';
import { formatResumeDateRange, resumeTemplateContactItems } from './resume-content';

const PAGE_W = RESUME_PAGE.width;
const PAGE_H = RESUME_PAGE.height;
const MARGIN = RESUME_PAGE.margin;
const RIGHT = PAGE_W - MARGIN;
const BOTTOM = RESUME_PAGE.bottom;

type FontName = 'TR' | 'TB' | 'TI' | 'TBI';
type LayoutOptions = { scale: number; maxExperienceBullets: number; maxProjects: number; maxProjectBullets: number };

const TIMES_WIDTHS: Record<FontName, number[]> = {
  TR: [250,333,408,500,500,833,778,180,333,333,500,564,250,333,250,278,500,500,500,500,500,500,500,500,500,500,278,278,564,564,564,444,921,722,667,667,722,611,556,722,722,333,389,722,611,889,722,722,556,722,667,556,611,722,722,944,722,722,611,333,278,333,469,500,333,444,500,444,500,444,333,500,500,278,278,500,278,778,500,500,500,500,333,389,278,500,500,722,500,500,444,480,200,480,541],
  TB: [250,333,555,500,500,1000,833,278,333,333,500,570,250,333,250,278,500,500,500,500,500,500,500,500,500,500,333,333,570,570,570,500,930,722,667,722,722,667,611,778,778,389,500,778,667,944,722,778,611,778,722,556,667,722,722,1000,722,722,667,333,278,333,581,500,333,500,556,444,556,444,333,500,556,278,333,556,278,833,556,500,556,556,444,389,333,556,500,722,500,500,444,394,220,394,520],
  TI: [250,333,420,500,500,833,778,214,333,333,500,675,250,333,250,278,500,500,500,500,500,500,500,500,500,500,333,333,675,675,675,500,920,611,611,667,722,611,611,722,722,333,444,667,556,833,667,722,611,722,611,500,556,722,611,833,611,556,556,389,278,389,422,500,333,500,500,444,500,444,278,500,500,278,278,444,278,722,500,500,500,500,389,389,278,500,444,667,444,444,389,400,275,400,541],
  TBI: [250,389,555,500,500,833,778,278,333,333,500,570,250,333,250,278,500,500,500,500,500,500,500,500,500,500,333,333,570,570,570,500,832,667,667,667,722,667,667,722,778,389,500,667,611,889,722,722,611,722,667,556,611,722,667,889,667,611,611,333,278,333,570,500,333,500,500,444,500,444,333,500,556,278,278,500,278,778,556,500,500,500,389,389,278,556,444,667,500,444,389,348,220,348,570],
};

const FONT_BASE: Record<FontName, string> = {
  TR: 'Times-Roman', TB: 'Times-Bold', TI: 'Times-Italic', TBI: 'Times-BoldItalic',
};

function ascii(value: string) {
  return value.replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/→/g, '->').replace(/≈/g, 'approximately ').replace(/·/g, ' | ')
    .replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapePdf(value: string) {
  return ascii(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function textWidth(value: string, size: number, font: FontName = 'TR') {
  const widths = TIMES_WIDTHS[font];
  const units = [...ascii(value)].reduce((sum, char) => sum + (widths[char.charCodeAt(0) - 32] ?? 500), 0);
  return units * size / 1000;
}

function wrap(value: string, maxWidth: number, size: number, font: FontName = 'TR') {
  const words = ascii(value).split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidth(next, size, font) > maxWidth) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function fittedSize(value: string, maxWidth: number, preferred: number, minimum: number, font: FontName = 'TR') {
  let size = preferred;
  while (size > minimum && textWidth(value, size, font) > maxWidth) size -= 0.1;
  return Math.max(minimum, size);
}

class Canvas {
  commands: string[] = [];
  y = 804;
  overflow = false;
  constructor(readonly scale: number) {}
  s(v: number) { return v * this.scale; }
  consume(v: number) { this.y -= this.s(v); if (this.y < BOTTOM) this.overflow = true; }
  text(value: string, x: number, y: number, size: number, font: FontName = 'TR') {
    if (!value) return;
    if (x < MARGIN - 2 || x + textWidth(value, size, font) > RIGHT + 1 || y < BOTTOM) this.overflow = true;
    this.commands.push(`BT /${font} ${size.toFixed(2)} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdf(value)}) Tj ET`);
  }
  right(value: string, y: number, size: number, font: FontName = 'TR') {
    this.text(value, Math.max(MARGIN, RIGHT - textWidth(value, size, font)), y, size, font);
  }
  center(value: string, y: number, size: number, font: FontName = 'TR') {
    this.text(value, Math.max(MARGIN, (PAGE_W - textWidth(value, size, font)) / 2), y, size, font);
  }
  rule(y: number) { this.commands.push(`0.32 w ${MARGIN} ${y.toFixed(2)} m ${RIGHT} ${y.toFixed(2)} l S`); }
  solidBullet(x: number, y: number) { this.commands.push(`${x.toFixed(2)} ${y.toFixed(2)} 1.45 0 360 arc f`); }
  hollowBullet(x: number, y: number) { this.commands.push(`0.45 w ${x.toFixed(2)} ${y.toFixed(2)} 1.35 0 360 arc S`); }
  section(label: string) {
    this.consume(2.0);
    this.text(label, MARGIN, this.y, this.s(10.7), 'TR');
    this.rule(this.y - this.s(2.2));
    this.consume(13.1);
  }
  paragraph(value: string, baseSize = 8.6, lineHeight = 9.8) {
    const size = this.s(baseSize);
    for (const line of wrap(value, RIGHT - MARGIN, size)) { this.text(line, MARGIN, this.y, size); this.consume(lineHeight); }
  }
  bullet(value: string, left = MARGIN + 28, baseSize = 8.2, lineHeight = 9.25) {
    const size = this.s(baseSize);
    const lines = wrap(value, RIGHT - left, size);
    if (!lines.length) return;
    this.hollowBullet(left - 11, this.y + this.s(2.3));
    for (const line of lines) { this.text(line, left, this.y, size); this.consume(lineHeight); }
  }
}

function roleSource(profile: CandidateProfile, organization: string, title: string) {
  return (profile.experience ?? []).find((item) => normalizeText(item.organization) === normalizeText(organization)
    && normalizeText(item.title) === normalizeText(title));
}

function paired(canvas: Canvas, leftText: string, rightText: string, leftSize: number, rightSize: number, leftFont: FontName, rightFont: FontName, x = MARGIN + 10) {
  const ls = canvas.s(leftSize); const rs = canvas.s(rightSize);
  const rightWidth = rightText ? textWidth(rightText, rs, rightFont) : 0;
  const maxLeft = RIGHT - x - (rightText ? rightWidth + 12 : 0);
  const lines = wrap(leftText, Math.max(100, maxLeft), ls, leftFont);
  for (const [index, line] of lines.entries()) {
    canvas.text(line, x, canvas.y, ls, leftFont);
    if (index === 0 && rightText) canvas.right(rightText, canvas.y, rs, rightFont);
    canvas.consume(leftSize + 1.15);
  }
}

function addExperience(canvas: Canvas, profile: CandidateProfile, item: ApplicationPack['experience'][number]) {
  const source = roleSource(profile, item.organization, item.title);
  canvas.solidBullet(MARGIN + 2.1, canvas.y + canvas.s(2.2));
  paired(canvas, item.organization, source?.location ?? '', 9.25, 8.15, 'TB', 'TR');
  paired(canvas, item.title, formatResumeDateRange(source?.start, source?.end), 8.55, 8.15, 'TI', 'TI');
  for (const bullet of item.bullets) canvas.bullet(bullet);
  canvas.consume(1.1);
}

type SkillGroup = { label: string; skills: string[] };

function skillCategory(skill: string) {
  const value = normalizeText(skill);
  if (/oracle|\berp\b|financials|procurement|general ledger|accounts payable|accounts receivable|tax rules|bi publisher|visual builder/.test(value)) return 'Enterprise & ERP';
  if (/rest|api|integration|migration|sql|postgres|mysql|data loading|data transformation|database/.test(value)) return 'Integration & Data';
  if (/jira|confluence|requirement|process mapping|documentation|project management|iso 27001|risk|access management/.test(value)) return 'Business Systems';
  if (/machine learning|deep learning|bert|clip|hnsw|faiss|computer vision|nlp|tensorflow|scikit|multimodal|vector search|image retrieval/.test(value)) return 'Applied AI & ML';
  if (/python|javascript|typescript|\br\b|matlab|java|c\+\+|c#|\.net/.test(value)) return 'Languages';
  if (/oci|aws|azure|gcp|cloud|docker|kubernetes|vercel|github actions|postman|devops/.test(value)) return 'Cloud & Development';
  if (/next|react|node|angular|tailwind|prisma|auth|pwa|capacitor/.test(value)) return 'Development & APIs';
  return 'Additional';
}

function skillGroups(job: Job, pack: ApplicationPack): SkillGroup[] {
  const buckets = new Map<string, string[]>();
  for (const skill of pack.skills) {
    const label = skillCategory(skill);
    const list = buckets.get(label) ?? [];
    if (!list.some((item) => normalizeText(item) === normalizeText(skill))) list.push(skill);
    buckets.set(label, list);
  }
  const jobText = normalizeText(`${job.title} ${job.description}`);
  const order = /oracle|\berp\b|financial systems|business systems/.test(jobText)
    ? ['Enterprise & ERP', 'Integration & Data', 'Business Systems', 'Languages', 'Cloud & Development', 'Development & APIs', 'Applied AI & ML', 'Additional']
    : /machine learning|\bai\b|data scientist|computer vision|nlp/.test(jobText)
      ? ['Languages', 'Applied AI & ML', 'Integration & Data', 'Cloud & Development', 'Development & APIs', 'Business Systems', 'Enterprise & ERP', 'Additional']
      : ['Languages', 'Development & APIs', 'Integration & Data', 'Cloud & Development', 'Business Systems', 'Enterprise & ERP', 'Applied AI & ML', 'Additional'];
  return order.flatMap((label) => buckets.get(label)?.length ? [{ label, skills: buckets.get(label)! }] : []);
}

function renderSkills(canvas: Canvas, job: Job, pack: ApplicationPack) {
  for (const group of skillGroups(job, pack)) {
    canvas.solidBullet(MARGIN + 2.1, canvas.y + canvas.s(2.05));
    const label = `${group.label}:`;
    const labelSize = canvas.s(8.25);
    const bodySize = canvas.s(8.15);
    const left = MARGIN + 10;
    canvas.text(label, left, canvas.y, labelSize, 'TB');
    const bodyLeft = left + textWidth(label, labelSize, 'TB') + 4;
    const lines = wrap(group.skills.join(', '), RIGHT - bodyLeft, bodySize);
    for (const [index, line] of lines.entries()) {
      canvas.text(line, index === 0 ? bodyLeft : MARGIN + 22, canvas.y, bodySize);
      canvas.consume(9.15);
    }
  }
}

function renderProjects(canvas: Canvas, pack: ApplicationPack) {
  for (const project of pack.projects) {
    canvas.solidBullet(MARGIN + 2.1, canvas.y + canvas.s(2.1));
    paired(canvas, project.name, '', 8.95, 8, 'TB', 'TR');
    for (const bullet of project.bullets) canvas.bullet(bullet, MARGIN + 28, 8.15, 9.15);
    canvas.consume(0.7);
  }
}

function renderEducation(canvas: Canvas, profile: CandidateProfile) {
  for (const degree of profile.degrees ?? []) {
    canvas.solidBullet(MARGIN + 2.1, canvas.y + canvas.s(2.1));
    paired(canvas, degree.institution, degree.location ?? '', 9.05, 8.1, 'TB', 'TR');
    const degreeText = [degree.degree, degree.field].filter(Boolean).join(' - ') + (degree.gpa ? `; GPA: ${degree.gpa}` : '');
    paired(canvas, degreeText, formatResumeDateRange(degree.start, degree.end), 8.35, 8.05, 'TI', 'TI');
    for (const coursework of (degree.coursework ?? []).slice(0, 2)) canvas.bullet(`Relevant Coursework: ${coursework}`, MARGIN + 28, 7.9, 8.8);
    canvas.consume(0.7);
  }
}

function buildStream(profile: CandidateProfile, job: Job, pack: ApplicationPack, options: LayoutOptions) {
  const c = new Canvas(options.scale);
  const nameSize = c.s(22.5);
  c.center(profile.name, c.y, nameSize, 'TB');
  c.consume(23.5);
  const contact = resumeTemplateContactItems(profile).join(' | ');
  if (contact) {
    const size = fittedSize(contact, RIGHT - MARGIN, c.s(8.2), c.s(6.9));
    c.center(contact, c.y, size, 'TR');
    c.consume(11.0);
  }

  c.section('Professional Summary');
  c.paragraph(pack.resumeSummary);
  c.section('Experience');
  for (const item of pack.experience) addExperience(c, profile, item);
  c.section('Skills');
  renderSkills(c, job, pack);
  if (pack.projects.length) { c.section('Projects'); renderProjects(c, pack); }
  c.section('Education');
  renderEducation(c, profile);
  if ((pack.certifications ?? []).length) {
    c.section('Certifications');
    for (const certification of pack.certifications ?? []) {
      c.solidBullet(MARGIN + 2.1, c.y + c.s(1.9));
      const size = c.s(7.9);
      for (const line of wrap(certification, RIGHT - (MARGIN + 10), size)) {
        c.text(line, MARGIN + 10, c.y, size);
        c.consume(8.65);
      }
    }
  }
  // Publications are intentionally never rendered.
  c.center('1', 8.0, c.s(6.8));
  return { stream: c.commands.join('\n'), overflow: c.overflow, bottomY: c.y };
}

function pdfFromStream(stream: string) {
  const objects: Buffer[] = [];
  const add = (body: string) => { objects.push(Buffer.from(body, 'ascii')); return objects.length; };
  const fontIds = Object.fromEntries((Object.keys(FONT_BASE) as FontName[]).map((name) => [name,
    add(`<< /Type /Font /Subtype /Type1 /BaseFont /${FONT_BASE[name]} /Encoding /WinAnsiEncoding >>`)]));
  const pagesId = add('');
  const contentId = add(`<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`);
  const resources = (Object.keys(fontIds) as FontName[]).map((name) => `/${name} ${fontIds[name]} 0 R`).join(' ');
  const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << ${resources} >> >> /Contents ${contentId} 0 R >>`);
  objects[pagesId - 1] = Buffer.from(`<< /Type /Pages /Kids [${pageId} 0 R] /Count 1 >>`, 'ascii');
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n', 'ascii')];
  const offsets = [0];
  let length = chunks[0].length;
  objects.forEach((body, index) => {
    offsets.push(length);
    const object = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`, 'ascii'), body, Buffer.from('\nendobj\n', 'ascii')]);
    chunks.push(object); length += object.length;
  });
  const xref = length;
  let trailer = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) trailer += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  trailer += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  chunks.push(Buffer.from(trailer, 'ascii'));
  return Buffer.concat(chunks);
}

export function resumePdf(profile: CandidateProfile, job: Job, pack: ApplicationPack): Buffer {
  const attempts: LayoutOptions[] = RESUME_LAYOUT_ATTEMPTS.map((item) => ({ ...item }));
  let chosen = buildStream(profile, job, pack, attempts[attempts.length - 1]);
  for (const attempt of attempts) {
    const candidate = buildStream(profile, job, pack, attempt);
    chosen = candidate;
    if (!candidate.overflow && candidate.bottomY >= BOTTOM) break;
  }
  if (chosen.overflow || chosen.bottomY < BOTTOM) throw new Error('The selected resume evidence cannot fit safely on one A4 page. Reduce selected evidence before export.');
  return pdfFromStream(chosen.stream);
}
