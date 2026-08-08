import type { ApplicationPack, CandidateProfile, Job } from './types';

function escapePdf(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7E]/g, '?');
}

function wrap(text: string, width = 92) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > width && line) { lines.push(line); line = word; }
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
      const font = item.bold ? 'F2' : 'F1';
      pages.at(-1)!.push(`BT /${font} ${size} Tf 54 ${y} Td (${escapePdf(line)}) Tj ET`);
      y -= gap;
    }
    y -= item.gap ? 2 : 0;
  }
  return pages.map((p) => p.join('\n'));
}

export function resumePdf(profile: CandidateProfile, job: Job, pack: ApplicationPack): Buffer {
  const lines: Array<{ text: string; size?: number; bold?: boolean; gap?: number }> = [
    { text: profile.name, size: 18, bold: true, gap: 23 },
    { text: pack.resumeHeadline, size: 11, bold: true },
    { text: [profile.email, profile.phone, profile.location].filter(Boolean).join(' | '), size: 9, gap: 15 },
    { text: 'SUMMARY', size: 11, bold: true, gap: 16 },
    { text: pack.resumeSummary, size: 9, gap: 13 },
    { text: 'SKILLS', size: 11, bold: true, gap: 16 },
    { text: pack.skills.join(' | '), size: 9, gap: 13 },
  ];
  for (const exp of pack.experience) {
    lines.push({ text: `${exp.title} — ${exp.organization}`, size: 10, bold: true, gap: 15 });
    for (const bullet of exp.bullets) lines.push({ text: `- ${bullet}`, size: 9, gap: 12 });
  }
  if (pack.projects.length) lines.push({ text: 'PROJECTS', size: 11, bold: true, gap: 16 });
  for (const project of pack.projects) {
    lines.push({ text: project.name, size: 10, bold: true, gap: 15 });
    for (const bullet of project.bullets) lines.push({ text: `- ${bullet}`, size: 9, gap: 12 });
  }
  lines.push({ text: `Tailored for ${job.title} at ${job.company}`, size: 7, gap: 10 });
  const streams = pageStreams(lines);

  const objects: string[] = [];
  const add = (body: string) => { objects.push(body); return objects.length; };
  const fontRegular = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const fontBold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const pagesId = add('');
  const pageIds: number[] = [];
  for (const stream of streams) {
    const contentId = add(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`);
    const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  }
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, i) => { offsets.push(Buffer.byteLength(pdf, 'utf8')); pdf += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

export function coverLetterPdf(profile: CandidateProfile, job: Job, pack: ApplicationPack): Buffer {
  const lines: Array<{ text: string; size?: number; bold?: boolean; gap?: number }> = [
    { text: profile.name, size: 16, bold: true, gap: 22 },
    { text: [profile.email, profile.phone, profile.location].filter(Boolean).join(' | '), size: 9, gap: 16 },
    { text: `Re: ${job.title} — ${job.company}`, size: 11, bold: true, gap: 18 },
    ...pack.coverLetter.split(/\n+/).filter(Boolean).map((text) => ({ text, size: 10, gap: 15 })),
  ];
  const streams = pageStreams(lines);
  const objects: string[] = [];
  const add = (body: string) => { objects.push(body); return objects.length; };
  const fontRegular = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const fontBold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const pagesId = add('');
  const pageIds: number[] = [];
  for (const stream of streams) {
    const contentId = add(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`);
    const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  }
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, i) => { offsets.push(Buffer.byteLength(pdf, 'utf8')); pdf += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}
