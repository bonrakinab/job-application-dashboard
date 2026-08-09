export type JobDescriptionBlock = {
  type: 'heading' | 'paragraph' | 'bullet';
  text: string;
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  hellip: '…',
  ldquo: '“',
  lsquo: '‘',
  lt: '<',
  mdash: '—',
  nbsp: ' ',
  ndash: '–',
  quot: '"',
  rdquo: '”',
  rsquo: '’',
};

function decodeHtmlEntities(value: string) {
  return value.replace(/&#x([0-9a-f]+);|&#(\d+);|&([a-z]+);/gi, (match, hex, decimal, named) => {
    if (hex) {
      const codePoint = Number.parseInt(hex, 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    if (decimal) {
      const codePoint = Number.parseInt(decimal, 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return NAMED_ENTITIES[String(named).toLowerCase()] ?? match;
  });
}

function cleanLine(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Convert untrusted ATS/career-site HTML into safe display blocks.
 * We never inject the source as HTML; React renders each returned string as text.
 */
export function formatJobDescription(value = ''): JobDescriptionBlock[] {
  if (!value.trim()) return [];

  // Decode first so descriptions stored as &lt;p&gt;... are handled too. The
  // resulting string is still treated only as untrusted text and parsed below.
  let text = decodeHtmlEntities(value)
    .replace(/\r?\n/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<h[1-6]\b[^>]*>/gi, '\n@@HEADING@@')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n@@BULLET@@')
    .replace(/<\/li>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?:p|div|ul|ol|section|article|header|footer)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  const blocks: JobDescriptionBlock[] = [];
  for (const rawLine of text.split(/\n+/)) {
    let line = cleanLine(rawLine);
    if (!line) continue;

    let type: JobDescriptionBlock['type'] = 'paragraph';
    if (line.startsWith('@@HEADING@@')) {
      type = 'heading';
      line = cleanLine(line.slice('@@HEADING@@'.length));
    } else if (line.startsWith('@@BULLET@@')) {
      type = 'bullet';
      line = cleanLine(line.slice('@@BULLET@@'.length));
    }
    if (!line) continue;

    // Avoid choppy output when plain-text feeds contain arbitrary hard wraps.
    const previous = blocks.at(-1);
    if (type === 'paragraph' && previous?.type === 'paragraph') {
      previous.text = `${previous.text} ${line}`;
    } else {
      blocks.push({ type, text: line });
    }
  }

  return blocks;
}

export function jobDescriptionPlainText(value = '') {
  return formatJobDescription(value)
    .map((block) => block.type === 'bullet' ? `• ${block.text}` : block.text)
    .join('\n');
}
