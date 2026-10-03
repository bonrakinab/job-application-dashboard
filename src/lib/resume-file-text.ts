import JSZip from 'jszip';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

const MAX_RESUME_BYTES = 8 * 1024 * 1024;

function extension(name: string) {
  return name.toLowerCase().split('.').pop() ?? '';
}

export interface ResumeFileInspection {
  text: string;
  format: 'PDF' | 'DOCX' | 'TXT';
  pageCount?: number;
  structuralIssues: string[];
  parseabilityScore: number;
}

function cleanedText(value: string, label: string) {
  const cleaned = value
    .replace(/\0/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
  if (cleaned.length < 80) {
    throw new Error(`Very little text could be read from this ${label}. If it is a scanned PDF, export it as a text-based PDF or DOCX and try again.`);
  }
  return cleaned.slice(0, 60000);
}

function parseabilityScore(text: string, pageCount: number | undefined, issues: string[]) {
  let score = 100;
  score -= Math.min(72, issues.length * 16);
  if (text.length < 600) score -= 18;
  if (pageCount && pageCount > 2) score -= Math.min(15, (pageCount - 2) * 5);
  return Math.max(0, Math.min(100, Math.round(score)));
}

export async function inspectResumeFile(file: File): Promise<ResumeFileInspection> {
  if (!file.size) throw new Error('The selected résumé is empty.');
  if (file.size > MAX_RESUME_BYTES) throw new Error('The résumé must be 8 MB or smaller.');
  const ext = extension(file.name);
  const bytes = Buffer.from(await file.arrayBuffer());
  let text = '';
  let format: ResumeFileInspection['format'];
  let pageCount: number | undefined;
  const structuralIssues: string[] = [];

  if (ext === 'pdf' || file.type === 'application/pdf') {
    format = 'PDF';
    const parser = new PDFParse({ data: bytes });
    try {
      const parsed = await parser.getText();
      text = parsed.text;
      pageCount = parsed.total;
    } finally {
      await parser.destroy();
    }
  } else if (ext === 'docx' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    format = 'DOCX';
    const [parsed, zip] = await Promise.all([
      mammoth.extractRawText({ buffer: bytes }),
      JSZip.loadAsync(bytes),
    ]);
    text = parsed.value;
    const documentXml = await zip.file('word/document.xml')?.async('string');
    const fileNames = Object.keys(zip.files);
    if (!documentXml) structuralIssues.push('The Word document body could not be inspected.');
    if (documentXml && /<w:tbl\b/i.test(documentXml)) structuralIssues.push('Tables can change the ATS reading order.');
    if (documentXml && /<w:txbxContent\b/i.test(documentXml)) structuralIssues.push('Text boxes may be skipped by some ATS parsers.');
    if (documentXml && /<w:cols\b[^>]*w:num="(?:[2-9]|\d{2,})"/i.test(documentXml)) structuralIssues.push('Multiple columns can scramble the ATS reading order.');
    if (documentXml && /<w:(?:vanish|webHidden|drawing|pict)\b/i.test(documentXml)) structuralIssues.push('Hidden text or drawings may not parse consistently.');
    if (fileNames.some((name) => /^word\/(?:header|footer)\d*\.xml$/i.test(name))) structuralIssues.push('Contact details in headers or footers may be missed by an ATS.');
  } else if (ext === 'txt' || file.type === 'text/plain') {
    format = 'TXT';
    text = bytes.toString('utf8');
  } else {
    throw new Error('Upload a PDF, DOCX, or TXT résumé. Legacy .doc files are not supported.');
  }

  const cleaned = cleanedText(text, 'résumé');
  return {
    text: cleaned,
    format,
    pageCount,
    structuralIssues,
    parseabilityScore: parseabilityScore(cleaned, pageCount, structuralIssues),
  };
}

export async function extractDocumentFileText(file: File, label = 'document') {
  if (!file.size) throw new Error(`The selected ${label} is empty.`);
  if (file.size > MAX_RESUME_BYTES) throw new Error(`The ${label} must be 8 MB or smaller.`);
  const ext = extension(file.name);
  const bytes = Buffer.from(await file.arrayBuffer());
  let text = '';
  if (ext === 'pdf' || file.type === 'application/pdf') {
    const parser = new PDFParse({ data: bytes });
    try {
      text = (await parser.getText()).text;
    } finally {
      await parser.destroy();
    }
  } else if (ext === 'docx' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    text = (await mammoth.extractRawText({ buffer: bytes })).value;
  } else if (ext === 'txt' || file.type === 'text/plain') {
    text = bytes.toString('utf8');
  } else {
    throw new Error(`Upload the ${label} as PDF, DOCX, or TXT. Legacy .doc files are not supported.`);
  }
  return cleanedText(text, label);
}

export async function extractResumeFileText(file: File) {
  return (await inspectResumeFile(file)).text;
}
