import { containsTerm } from './resume-evidence-guards';
import type { ApplicationPack, CandidateProfile, Job, RequirementEvidence } from './types';
import { normalizeText } from './utils';

function unique(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalizeText(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function naturalList(values: string[]) {
  if (values.length <= 1) return values[0] ?? '';
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
}

const JD_PHRASE_HEADS = new Set([
  'administration', 'analysis', 'analytics', 'architecture', 'automation', 'collaboration', 'communication',
  'compliance', 'control', 'databases', 'database', 'delivery', 'design', 'development', 'engineering',
  'gathering', 'governance', 'implementation', 'infrastructure', 'integration', 'intelligence', 'learning',
  'management', 'migration', 'modeling', 'modelling', 'monitoring', 'operations', 'optimization', 'planning',
  'processing', 'programming', 'reporting', 'requirements', 'security', 'service', 'services', 'support',
  'systems', 'system', 'testing', 'troubleshooting', 'visualization', 'workflow', 'workflows', 'apis', 'api',
]);

const JD_PHRASE_START_BLOCK = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'candidate', 'excellent', 'experience', 'experienced',
  'familiarity', 'for', 'from', 'have', 'in', 'including', 'is', 'knowledge', 'of', 'on', 'or', 'preferred',
  'proficiency', 'required', 'responsibilities', 'responsibility', 'role', 'strong', 'the', 'this', 'to', 'using',
  'with', 'work', 'working', 'you', 'your',
]);

const JD_PHRASE_END_BLOCK = new Set([
  'a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'including', 'of', 'on', 'or', 'the', 'to', 'with',
]);

const KEYWORD_STOP_WORDS = new Set([
  ...JD_PHRASE_START_BLOCK,
  'ability', 'demonstrated', 'demonstrate', 'good', 'minimum', 'must', 'plus', 'solid', 'understanding',
]);

function keywordStem(value: string) {
  const word = normalizeText(value).replace(/[^a-z0-9+#.]/g, '');
  const irregular: Record<string, string> = {
    managed: 'manage', managing: 'manage', management: 'manage',
    gathered: 'gather', gathering: 'gather',
    collaborated: 'collaborate', collaborating: 'collaborate', collaboration: 'collaborate',
    communicated: 'communicate', communicating: 'communicate', communication: 'communicate',
    developed: 'develop', developing: 'develop', development: 'develop',
    engineered: 'engineer', engineering: 'engineer',
    analyzed: 'analyze', analysing: 'analyze', analyzing: 'analyze', analysis: 'analyze', analytics: 'analyze',
    automated: 'automate', automating: 'automate', automation: 'automate',
    integrated: 'integrate', integrating: 'integrate', integration: 'integrate',
    supported: 'support', supporting: 'support',
    stakeholders: 'stakeholder', requirements: 'requirement', systems: 'system', databases: 'database',
    services: 'service', workflows: 'workflow', apis: 'api',
  };
  if (irregular[word]) return irregular[word];
  if (word.length > 5 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 5 && word.endsWith('ing')) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith('ed')) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith('s')) return word.slice(0, -1);
  return word;
}

function keywordTokens(value: string) {
  return (value.match(/[A-Za-z0-9][A-Za-z0-9+.#/-]*/g) ?? [])
    .flatMap((token) => token.split(/[-/]/g))
    .map(keywordStem)
    .filter((token) => token.length >= 2 && !KEYWORD_STOP_WORDS.has(token));
}

function tokenOverlap(left: string, right: string) {
  const a = [...new Set(keywordTokens(left))];
  const b = new Set(keywordTokens(right));
  if (!a.length) return 0;
  return a.filter((token) => b.has(token)).length / a.length;
}

function phraseScore(phrase: string) {
  const tokens = phrase.match(/[A-Za-z0-9][A-Za-z0-9+.#/&-]*/g) ?? [];
  const normalized = tokens.map((token) => normalizeText(token).replace(/[^a-z0-9+#.-]/g, ''));
  const head = normalized.at(-1) ?? '';
  let score = JD_PHRASE_HEADS.has(head) ? 5 : 0;
  score += Math.min(3, keywordTokens(phrase).length);
  if (phrase.includes('-')) score += 0.5;
  return score;
}

/** Extract compact, literal phrases from the JD itself. */
export function literalJdKeywordCandidates(job: Job) {
  const source = `${job.title}. ${job.description}`;
  const candidates: Array<{ phrase: string; score: number; order: number }> = [];
  let order = 0;

  for (const clause of source.split(/[\n.;:!?]+/g)) {
    const words = clause.match(/[A-Za-z0-9][A-Za-z0-9+.#/&-]*/g) ?? [];
    for (let size = 2; size <= 4; size += 1) {
      for (let start = 0; start + size <= words.length; start += 1) {
        const slice = words.slice(start, start + size);
        const normalized = slice.map((word) => normalizeText(word).replace(/[^a-z0-9+#.-]/g, ''));
        const first = normalized[0] ?? '';
        const last = normalized.at(-1) ?? '';
        if (JD_PHRASE_START_BLOCK.has(first) || JD_PHRASE_END_BLOCK.has(last)) continue;
        if (normalized.includes('and') || normalized.includes('or')) continue;
        if (!JD_PHRASE_HEADS.has(last)) continue;
        const phrase = slice.join(' ').trim();
        const content = keywordTokens(phrase);
        if (content.length < 2 || content.length > 5 || phrase.length > 64) continue;
        candidates.push({ phrase, score: phraseScore(phrase), order: order += 1 });
      }
    }
  }

  return unique(candidates
    .sort((a, b) => b.score - a.score || a.phrase.split(/\s+/).length - b.phrase.split(/\s+/).length || a.order - b.order)
    .map((item) => item.phrase));
}

export type EvidenceBackedJdKeyword = {
  phrase: string;
  requirement: string;
  importance: RequirementEvidence['importance'];
  confidence: number;
  evidenceIds: string[];
};

/**
 * Map literal JD phrases to requirements that have already been marked supported
 * by the requirement-to-evidence matrix. This allows employer wording to change
 * without changing the underlying candidate claim.
 */
export function evidenceBackedJdKeywords(job: Job, requirementEvidence: RequirementEvidence[]) {
  const supported = requirementEvidence.filter((item) => item.support === 'supported' && item.evidence.length > 0);
  const mapped: EvidenceBackedJdKeyword[] = [];

  for (const phrase of literalJdKeywordCandidates(job)) {
    const ranked = supported.map((item) => {
      const requirementOverlap = tokenOverlap(phrase, item.requirement);
      const exactTermMatch = (item.exactTerms ?? []).some((term) => containsTerm(phrase, term) || containsTerm(term, phrase));
      const evidenceOverlap = Math.max(0, ...item.evidence.map((evidence) => tokenOverlap(phrase, evidence.excerpt)));
      const score = requirementOverlap * 0.72 + evidenceOverlap * 0.18 + (exactTermMatch ? 0.25 : 0);
      return { item, score, requirementOverlap, exactTermMatch };
    }).sort((a, b) => b.score - a.score || b.item.confidence - a.item.confidence);

    const best = ranked[0];
    if (!best) continue;
    if (!best.exactTermMatch && best.requirementOverlap < 0.5) continue;
    if (best.score < 0.38) continue;

    mapped.push({
      phrase,
      requirement: best.item.requirement,
      importance: best.item.importance,
      confidence: best.item.confidence,
      evidenceIds: best.item.evidence.map((evidence) => evidence.id),
    });
  }

  const seen = new Set<string>();
  return mapped
    .sort((a, b) => (a.importance === b.importance ? 0 : a.importance === 'must-have' ? -1 : 1)
      || b.confidence - a.confidence
      || phraseScore(b.phrase) - phraseScore(a.phrase))
    .filter((item) => {
      const key = normalizeText(item.phrase);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

function exactSupportedProfileSkills(profile: CandidateProfile, requirementEvidence: RequirementEvidence[]) {
  const allowed = new Map(profile.skills.map((skill) => [normalizeText(skill), skill]));
  return unique(requirementEvidence
    .filter((item) => item.support === 'supported')
    .flatMap((item) => item.exactTerms ?? [])
    .map((term) => allowed.get(normalizeText(term)))
    .filter((skill): skill is string => Boolean(skill)));
}

function jdMentionedProfileSkills(job: Job, profile: CandidateProfile) {
  const jd = `${job.title} ${job.department ?? ''} ${job.description}`;
  return profile.skills.filter((skill) => containsTerm(jd, skill));
}

function resumeBodyText(pack: ApplicationPack) {
  return [
    pack.resumeSummary,
    ...pack.skills,
    ...pack.experience.flatMap((item) => item.bullets),
    ...pack.projects.flatMap((item) => item.bullets),
    ...(pack.certifications ?? []),
  ].join(' ');
}

function improvedSummary(
  sourceSummary: string,
  optimizedSummary: string,
  prioritizedSkills: string[],
  evidenceBackedPhrases: string[],
  existingResumeText: string,
) {
  const preferred = sourceSummary.trim().length >= 80 ? sourceSummary.trim() : optimizedSummary.trim();
  const base = preferred || optimizedSummary.trim();
  const skillTerms = prioritizedSkills.filter((skill) => !containsTerm(base, skill));
  const semanticTerms = evidenceBackedPhrases.filter((phrase) => !containsTerm(existingResumeText, phrase) && !containsTerm(base, phrase));
  const missing = unique([...skillTerms, ...semanticTerms]).slice(0, 6);
  if (!missing.length) return base;

  const sentence = `Relevant experience also includes ${naturalList(missing)}.`;
  const normalizedBase = base.replace(/[.\s]+$/, '');
  if (`${normalizedBase}. ${sentence}`.length <= 620) return `${normalizedBase}. ${sentence}`;

  const fitting: string[] = [];
  for (const term of missing) {
    const candidate = `Relevant experience also includes ${naturalList([...fitting, term])}.`;
    if (`${normalizedBase}. ${candidate}`.length > 620) break;
    fitting.push(term);
  }
  return fitting.length ? `${normalizedBase}. Relevant experience also includes ${naturalList(fitting)}.` : base;
}

function reconciledRequirementEvidence(
  matrix: RequirementEvidence[],
  keywords: EvidenceBackedJdKeyword[],
) {
  return matrix.map((item) => {
    if (item.support !== 'supported') return item;
    const mapped = keywords.filter((keyword) => normalizeText(keyword.requirement) === normalizeText(item.requirement)).map((keyword) => keyword.phrase);
    return { ...item, exactTerms: unique([...(item.exactTerms ?? []), ...mapped]).slice(0, 10) };
  });
}

/**
 * Final employer-facing resume policy.
 *
 * - Publications are never allowed into an application pack.
 * - Exact JD skills are promoted when the exact skill exists in the verified profile.
 * - Literal JD phrases may be introduced even when the original resume used different
 *   wording, but only when a supported requirement is linked to candidate evidence.
 * - Semantic JD wording goes to the summary rather than masquerading as an exact
 *   source skill. Unsupported requirements remain gaps.
 */
export function strengthenResumeForJob(
  job: Job,
  profile: CandidateProfile,
  optimizedPack: ApplicationPack,
  sourcePack: ApplicationPack,
  requirementEvidence: RequirementEvidence[] = [],
): ApplicationPack {
  const jdKeywords = evidenceBackedJdKeywords(job, requirementEvidence);
  const reconciledEvidence = reconciledRequirementEvidence(requirementEvidence, jdKeywords);
  const supportedExact = exactSupportedProfileSkills(profile, reconciledEvidence);
  const jdSkills = jdMentionedProfileSkills(job, profile);
  const prioritizedSkills = unique([
    ...supportedExact,
    ...jdSkills,
    ...optimizedPack.skills.filter((skill) => profile.skills.some((candidate) => normalizeText(candidate) === normalizeText(skill))),
  ]).slice(0, 26);
  const currentText = resumeBodyText({ ...optimizedPack, skills: prioritizedSkills });

  return {
    ...optimizedPack,
    resumeSummary: improvedSummary(
      sourcePack.resumeSummary,
      optimizedPack.resumeSummary,
      prioritizedSkills.slice(0, 8),
      jdKeywords.map((keyword) => keyword.phrase),
      currentText,
    ),
    skills: prioritizedSkills,
    publications: [],
    requirementEvidence: reconciledEvidence,
  };
}

/**
 * The uploaded career reference is a compact one-page layout with no separate
 * headline, no location in its contact row, no project technology sub-line,
 * no education coursework sub-line, and no publications section. The isolated
 * part-time profile keeps its own contact location while sharing the same safety
 * rules and generation pipeline.
 */
export function referenceTemplateProfile(profile: CandidateProfile): CandidateProfile {
  const career = profile.profilePurpose !== 'part-time';
  return {
    ...profile,
    location: career ? '' : profile.location,
    projects: career ? (profile.projects ?? []).map((project) => ({ ...project, skills: [] })) : profile.projects,
    degrees: career ? (profile.degrees ?? []).map((degree) => ({ ...degree, coursework: [] })) : profile.degrees,
    publications: [],
  };
}

export function referenceTemplatePack(pack: ApplicationPack): ApplicationPack {
  return {
    ...pack,
    resumeHeadline: '',
    publications: [],
  };
}

/** One canonical artifact state used by preview, scoring, validation and downloads. */
export function finalResumeArtifactState(profile: CandidateProfile, pack: ApplicationPack) {
  return {
    profile: referenceTemplateProfile(profile),
    pack: referenceTemplatePack(pack),
  };
}
