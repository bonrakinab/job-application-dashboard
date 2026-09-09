/** Boundary-aware terms: Java is not JavaScript; C is not C++ or C#. */
export function termOccurrences(text: string, term: string) {
  const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
  const needle = normalize(term);
  if (!needle) return 0;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...normalize(text).matchAll(new RegExp(`(?<![\\p{L}\\p{N}_+#.])${escaped}(?![\\p{L}\\p{N}_+#]|\\.[\\p{L}\\p{N}])`, 'gu'))].length;
}

export function containsTerm(text: string, term: string) {
  return termOccurrences(text, term) > 0;
}

const CONNECTIVES = new Set('a an the and or for from of on in to with by using through via as into'.split(' '));
// Deliberately narrow equivalences. Related tools, ownership, scale and outcomes
// are not synonyms. This is a conservative rule check, not an entailment model.
const EQUIVALENTS: Record<string, string> = {
  built: 'build', building: 'build', developed: 'build', developing: 'build',
  analysed: 'analyze', analyzed: 'analyze', analysing: 'analyze', analyzing: 'analyze', analysis: 'analyze',
  automated: 'automate', automating: 'automate', automation: 'automate',
  supported: 'support', supporting: 'support',
  created: 'create', creating: 'create',
  implemented: 'implement', implementing: 'implement', implementation: 'implement',
  designed: 'design', designing: 'design',
  reports: 'report', reporting: 'report', applications: 'application', systems: 'system',
  dashboards: 'dashboard', workflows: 'workflow', components: 'component',
};

function contentTerms(value: string) {
  return (value.toLowerCase().match(/[a-z0-9]+(?:[+#.][a-z0-9+#]*)*/g) ?? [])
    .map((word) => word.replace(/\.$/, ''))
    .filter((word) => !CONNECTIVES.has(word))
    .map((word) => EQUIVALENTS[word] ?? word);
}

export function groundedRewriteIssue(proposed: string, source: string, localSkills: string[] = []): string | null {
  const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
  if (normalize(proposed) === normalize(source)) return null;
  if (proposed.length < 24 || proposed.length > 330 || /\b(i|my|me|we|our)\b/i.test(proposed)) return 'Invalid accomplishment wording.';
  // A matching number alone does not preserve what the measurement describes.
  // Keep quantitative evidence verbatim until a semantic review can verify it.
  if (/\d/.test(proposed) || /\d/.test(source)) return 'Numeric evidence must retain its original wording.';
  const polarity = /\b(not|never|without|assisted|helped|supported|supporting|learning|studied|prototype|prototyped|simulation|simulated)\b/gi;
  for (const qualifier of source.match(polarity) ?? []) {
    if (!containsTerm(proposed, qualifier)) return `Source qualifier was removed: ${qualifier}.`;
  }
  const allowed = new Set(contentTerms(source));
  // A parent skill may clarify the terminology, but cannot introduce an action.
  localSkills.flatMap(contentTerms).forEach((term) => allowed.add(term));
  const terms = contentTerms(proposed);
  const unknown = terms.filter((term) => !allowed.has(term));
  if (unknown.length) return `Wording introduces unsupported detail: ${[...new Set(unknown)].slice(0, 4).join(', ')}.`;
  const sourceTerms = new Set(contentTerms(source));
  if (terms.filter((term) => sourceTerms.has(term)).length < Math.min(4, sourceTerms.size)) return 'Insufficient source detail retained.';
  return null;
}
