import type { AtsAnalyzerResult, AtsCheckerResult } from './ats-analyzer';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);
const TOP = 746;
const BOTTOM = 42;

type FontName = 'R' | 'B' | 'I';

function ascii(value: string) {
  return value
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/•/g, '-')
    .replace(/→/g, '->')
    .replace(/≈/g, 'approximately ')
    .replace(/[^ -~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapePdf(value: string) {
  return ascii(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function estimatedWidth(value: string, size: number, font: FontName) {
  const factor = font === 'B' ? 0.55 : 0.51;
  return [...ascii(value)].reduce((total, character) => {
    if (character === ' ') return total + (size * 0.26);
    if (/[ilI.,'!:;]/.test(character)) return total + (size * 0.24);
    if (/[MW@%]/.test(character)) return total + (size * 0.82);
    return total + (size * factor);
  }, 0);
}

function wrap(value: string, width: number, size: number, font: FontName = 'R') {
  const words = ascii(value).split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && estimatedWidth(candidate, size, font) > width) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

class ReportCanvas {
  private pages: string[][] = [[]];
  private y = TOP;

  private get page() {
    return this.pages[this.pages.length - 1];
  }

  private newPage() {
    this.pages.push([]);
    this.y = TOP;
  }

  private ensure(height: number) {
    if (this.y - height < BOTTOM) this.newPage();
  }

  private command(value: string) {
    this.page.push(value);
  }

  private text(value: string, x: number, y: number, size: number, font: FontName = 'R', color = '0.12 0.16 0.22') {
    if (!value) return;
    this.command(`${color} rg BT /${font} ${size.toFixed(2)} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdf(value)}) Tj ET`);
  }

  gap(amount: number) {
    this.y -= amount;
  }

  title(value: string) {
    this.ensure(52);
    this.text(value, MARGIN, this.y, 23, 'B', '0.08 0.12 0.18');
    this.y -= 14;
    this.command(`0.29 0.55 0.11 rg ${MARGIN} ${(this.y - 4).toFixed(2)} 72 3 re f`);
    this.y -= 20;
  }

  section(value: string) {
    this.ensure(34);
    this.y -= 3;
    this.command(`0.94 0.96 0.98 rg ${MARGIN} ${(this.y - 16).toFixed(2)} ${CONTENT_WIDTH} 24 re f`);
    this.text(value.toUpperCase(), MARGIN + 10, this.y - 9, 9.5, 'B', '0.19 0.27 0.36');
    this.y -= 31;
  }

  subheading(value: string) {
    this.ensure(22);
    this.text(value, MARGIN, this.y, 10.5, 'B', '0.10 0.18 0.27');
    this.y -= 17;
  }

  paragraph(value: string, options: { size?: number; font?: FontName; indent?: number; color?: string; gap?: number } = {}) {
    const size = options.size ?? 9.4;
    const font = options.font ?? 'R';
    const indent = options.indent ?? 0;
    const lineHeight = size + 3.1;
    const lines = wrap(value, CONTENT_WIDTH - indent, size, font);
    this.ensure(lines.length * lineHeight + (options.gap ?? 4));
    for (const line of lines) {
      this.text(line, MARGIN + indent, this.y, size, font, options.color);
      this.y -= lineHeight;
    }
    this.y -= options.gap ?? 4;
  }

  labelValue(label: string, value: string) {
    const labelText = `${label}:`;
    const labelWidth = estimatedWidth(labelText, 9.2, 'B') + 5;
    const lines = wrap(value, CONTENT_WIDTH - labelWidth, 9.2, 'R');
    this.ensure(Math.max(1, lines.length) * 12.2 + 3);
    this.text(labelText, MARGIN, this.y, 9.2, 'B');
    lines.forEach((line, index) => {
      this.text(line, MARGIN + labelWidth, this.y, 9.2);
      if (index < lines.length - 1) this.y -= 12.2;
    });
    this.y -= 15.2;
  }

  bullet(value: string, tone: 'normal' | 'good' | 'bad' | 'improve' = 'normal') {
    const color = tone === 'good' ? '0.09 0.42 0.20'
      : tone === 'bad' ? '0.68 0.16 0.18'
        : tone === 'improve' ? '0.57 0.39 0.02'
          : '0.12 0.16 0.22';
    const size = 9.1;
    const lines = wrap(value, CONTENT_WIDTH - 18, size);
    this.ensure(lines.length * 12 + 3);
    this.text('-', MARGIN + 2, this.y, size, 'B', color);
    lines.forEach((line, index) => {
      this.text(line, MARGIN + 16, this.y, size, 'R', color);
      if (index < lines.length - 1) this.y -= 12;
    });
    this.y -= 14.2;
  }

  scoreRow(checkers: AtsCheckerResult[]) {
    for (const checker of checkers) {
      this.ensure(20);
      this.text(checker.name, MARGIN, this.y, 9.2, 'R');
      this.text(`${checker.score}/100`, PAGE_WIDTH - MARGIN - 48, this.y, 9.2, 'B', checker.score >= 80 ? '0.09 0.42 0.20' : checker.score >= 60 ? '0.57 0.39 0.02' : '0.68 0.16 0.18');
      this.y -= 14;
    }
    this.y -= 4;
  }

  streams() {
    const total = this.pages.length;
    return this.pages.map((commands, index) => {
      const footer = [
        '0.45 0.49 0.55 rg',
        `BT /R 7.5 Tf ${MARGIN} 22 Td (ATS Analyzer - Full Report) Tj ET`,
        `BT /R 7.5 Tf ${(PAGE_WIDTH - MARGIN - 52).toFixed(2)} 22 Td (Page ${index + 1} of ${total}) Tj ET`,
      ];
      return [...commands, ...footer].join('\n');
    });
  }
}

function addList(canvas: ReportCanvas, title: string, items: string[], tone: 'good' | 'bad' | 'improve') {
  canvas.subheading(title);
  if (!items.length) {
    canvas.paragraph('No items flagged.', { color: '0.45 0.49 0.55' });
    return;
  }
  items.forEach((item) => canvas.bullet(item, tone));
  canvas.gap(2);
}

function pdfFromStreams(streams: string[]) {
  const objects: Buffer[] = [];
  const add = (body: string | Buffer) => {
    objects.push(typeof body === 'string' ? Buffer.from(body, 'ascii') : body);
    return objects.length;
  };
  const regular = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const bold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const italic = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>');
  const pagesId = add('');
  const pageIds: number[] = [];
  for (const stream of streams) {
    const contentId = add(`<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`);
    pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /R ${regular} 0 R /B ${bold} 0 R /I ${italic} 0 R >> >> /Contents ${contentId} 0 R >>`));
  }
  objects[pagesId - 1] = Buffer.from(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`, 'ascii');
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  const infoId = add('<< /Title (ATS Analyzer Full Report) /Creator (Job Application Dashboard) >>');
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
  trailer += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  chunks.push(Buffer.from(trailer, 'ascii'));
  return Buffer.concat(chunks);
}

export function isAtsAnalyzerResult(value: unknown): value is AtsAnalyzerResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<AtsAnalyzerResult>;
  return typeof result.combinedScore === 'number'
    && typeof result.targetScore === 'number'
    && typeof result.label === 'string'
    && Boolean(result.job && typeof result.job.title === 'string' && typeof result.job.company === 'string')
    && Boolean(result.resume && typeof result.resume.name === 'string' && typeof result.resume.format === 'string')
    && Array.isArray(result.checkers)
    && result.checkers.every((checker) => checker && typeof checker.name === 'string' && typeof checker.score === 'number' && Array.isArray(checker.metrics))
    && Array.isArray(result.matchedKeywords)
    && Array.isArray(result.missingKeywords)
    && Array.isArray(result.requirements)
    && typeof result.analyzedAt === 'string'
    && typeof result.disclaimer === 'string';
}

export function atsAnalyzerReportPdf(result: AtsAnalyzerResult) {
  const canvas = new ReportCanvas();
  canvas.title('ATS Analyzer - Full Report');
  canvas.labelValue('Target role', result.job.title);
  canvas.labelValue('Company', result.job.company);
  if (result.job.location) canvas.labelValue('Location', result.job.location);
  canvas.labelValue('Resume', `${result.resume.name} (${result.resume.format}${result.resume.pages ? `, ${result.resume.pages} page${result.resume.pages === 1 ? '' : 's'}` : ''})`);
  canvas.labelValue('Completed', new Date(result.analyzedAt).toLocaleString('en-CA', { timeZone: 'America/Toronto', dateStyle: 'long', timeStyle: 'short' }));
  canvas.gap(3);
  canvas.section('Overall result');
  canvas.paragraph(`${result.combinedScore}/100 - ${result.label}`, { size: 18, font: 'B', color: result.combinedScore >= 80 ? '0.09 0.42 0.20' : result.combinedScore >= 60 ? '0.57 0.39 0.02' : '0.68 0.16 0.18', gap: 9 });
  canvas.paragraph(`Optimization target: ${result.targetScore}/100`, { font: 'B' });
  canvas.scoreRow(result.checkers);

  for (const checker of result.checkers) {
    canvas.section(`${checker.name} - ${checker.score}/100`);
    canvas.paragraph(checker.summary, { font: 'I', color: '0.32 0.37 0.43', gap: 8 });
    canvas.subheading('Metrics');
    checker.metrics.forEach((metric) => canvas.labelValue(metric.label, `${metric.score}/100`));
    canvas.gap(2);
    addList(canvas, 'What is working', checker.good, 'good');
    addList(canvas, 'Needs work', checker.needsWork, 'bad');
    addList(canvas, 'How to improve', checker.improvements, 'improve');
  }

  canvas.section('Keyword analysis');
  addList(canvas, 'Matched keywords', result.matchedKeywords.map((keyword) => keyword), 'good');
  addList(canvas, 'Missing keywords', result.missingKeywords.map((keyword) => keyword), 'bad');

  canvas.section('Requirement evidence');
  if (!result.requirements.length) {
    canvas.paragraph('No detailed requirements were available from the job analysis.');
  } else {
    result.requirements.forEach((requirement, index) => {
      canvas.subheading(`${index + 1}. ${requirement.requirement}`);
      canvas.labelValue('Classification', `${requirement.importance}; ${requirement.support}; confidence ${requirement.confidence}/100${requirement.category ? `; ${requirement.category}` : ''}`);
      if (requirement.exactTerms?.length) canvas.labelValue('Exact terms', requirement.exactTerms.join(', '));
      if (requirement.evidence.length) {
        requirement.evidence.forEach((evidence) => canvas.bullet(`${evidence.label}: ${evidence.excerpt} (evidence score ${evidence.score}/100)`, requirement.support === 'supported' ? 'good' : 'normal'));
      } else {
        canvas.bullet('No supporting resume evidence was identified.', 'bad');
      }
      canvas.gap(4);
    });
  }

  canvas.section('Analysis details');
  canvas.labelValue('Selected model', result.models.selected);
  canvas.labelValue('Profile extraction', result.models.profileExtraction);
  canvas.labelValue('Job analysis', result.models.jobAnalysis);
  canvas.paragraph(result.disclaimer, { font: 'I', color: '0.40 0.35 0.18', gap: 0 });
  return pdfFromStreams(canvas.streams());
}
