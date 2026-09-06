import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

const MAX_RESUME_BYTES = 8 * 1024 * 1024;

function extension(name: string) {
  return name.toLowerCase().split('.').pop() ?? '';
}

export async function extractResumeFileText(file: File) {
  if (!file.size) throw new Error('The selected résumé is empty.');
  if (file.size > MAX_RESUME_BYTES) throw new Error('The résumé must be 8 MB or smaller.');
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
    throw new Error('Upload a PDF, DOCX, or TXT résumé. Legacy .doc files are not supported.');
  }

  const cleaned = text
    .replace(/\0/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
  if (cleaned.length < 80) {
    throw new Error('Very little text could be read from this résumé. If it is a scanned PDF, export it as a text-based PDF or DOCX and try again.');
  }
  return cleaned.slice(0, 60000);
}
