import { createHash } from 'node:crypto';

export function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function decodeHtmlEntities(value: string) {
  let text = value;
  // Multi-pass so double-encoded sequences like `&amp;lt;p&amp;gt;` become real tags.
  for (let i = 0; i < 3; i += 1) {
    const previous = text;
    text = text
      .replace(/&nbsp;/gi, ' ')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&apos;/gi, "'")
      .replace(/&#0*39;/gi, "'")
      .replace(/&#(\d+);/g, (_, code) => {
        const point = Number(code);
        return Number.isFinite(point) && point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '';
      })
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
        const point = parseInt(hex, 16);
        return Number.isFinite(point) && point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '';
      })
      .replace(/&amp;/gi, '&');
    if (text === previous) break;
  }
  return text;
}

function removeScriptsAndStyles(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ');
}

/** Flatten HTML/entity markup to a single plain-text line (scoring, connectors, AI). */
export function stripHtml(value = '') {
  const decoded = decodeHtmlEntities(removeScriptsAndStyles(value));
  return decoded
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Convert HTML/entity markup into readable plain text with paragraphs and bullets for UI display. */
export function htmlToReadableText(value = '') {
  const decoded = decodeHtmlEntities(removeScriptsAndStyles(value));
  return decoded
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*p\s*>/gi, '\n\n')
    .replace(/<\s*p[^>]*>/gi, '')
    .replace(/<\s*\/\s*h[1-6]\s*>/gi, '\n\n')
    .replace(/<\s*h[1-6][^>]*>/gi, '\n\n')
    .replace(/<\s*li[^>]*>/gi, '\n• ')
    .replace(/<\s*\/\s*li\s*>/gi, '')
    .replace(/<\s*\/?\s*(ul|ol)[^>]*>/gi, '\n')
    .replace(/<\s*\/\s*(div|tr|section|article|blockquote)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function normalizeText(value = '') {
  return stripHtml(value).toLowerCase().replace(/[^a-z0-9+#.\-/ ]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function stableJobId(source: string, sourceKey: string, externalId: string) {
  return createHash('sha256').update(`${source}:${sourceKey}:${externalId}`).digest('hex').slice(0, 32);
}

export function formatDate(value?: string) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

export function daysSince(value?: string) {
  if (!value) return Number.POSITIVE_INFINITY;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return (Date.now() - t) / 86_400_000;
}

export function jsonEnv<T>(name: string): T | null {
  const value = process.env[name];
  if (!value) return null;
  try { return JSON.parse(value) as T; } catch { return null; }
}

export function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
