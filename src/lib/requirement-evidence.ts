import type {
  CandidateProfile,
  Job,
  MatchScore,
  RequirementEvidence,
  RequirementSupport,
} from './types';
import { normalizeText } from './utils';

type EvidenceRecord = {
  id: string;
  label: string;
  excerpt: string;
  text: string;
  kind: 'experience' | 'project' | 'skill' | 'education' | 'certification' | 'course' | 'language' | 'award' | 'publication' | 'profile';
};

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'have', 'in', 'into', 'is', 'it',
  'of', 'on', 'or', 'the', 'their', 'this', 'to', 'using', 'with', 'you', 'your', 'will', 'work', 'working',
  'role', 'team', 'experience', 'experiences', 'skill', 'skills', 'required', 'preferred', 'requirement',
  'requirements', 'responsibilities', 'candidate', 'position', 'ability', 'knowledge', 'strong', 'excellent',
  'including', 'minimum', 'plus', 'must', 'proficiency', 'proficient', 'familiarity', 'understanding',
]);

const CONCEPT_GROUPS = [
  ['javascript', 'js', 'typescript', 'ts', 'node', 'nodejs', 'react', 'nextjs', 'frontend', 'fullstack'],
  ['python', 'pandas', 'numpy', 'fastapi', 'django', 'flask'],
  ['sql', 'postgres', 'postgresql', 'mysql', 'database', 'databases', 'relational'],
  ['aws', 'amazon web services', 'azure', 'gcp', 'google cloud', 'cloud'],
  ['docker', 'kubernetes', 'k8s', 'container', 'containers', 'containerization'],
  ['machine learning', 'ml', 'artificial intelligence', 'ai', 'data science', 'predictive modeling'],
  ['llm', 'large language model', 'generative ai', 'natural language processing', 'nlp', 'rag'],
  ['analytics', 'business intelligence', 'bi', 'power bi', 'tableau', 'reporting', 'dashboard'],
  ['oracle fusion', 'oracle cloud', 'oracle erp', 'erp', 'enterprise applications'],
  ['ci cd', 'continuous integration', 'continuous delivery', 'github actions', 'devops'],
  ['terraform', 'infrastructure as code', 'iac'],
  ['agile', 'scrum', 'kanban'],
  ['stakeholder', 'stakeholders', 'cross functional', 'communication', 'requirements gathering'],
] as const;

function tokens(value: string) {
  return [...new Set(normalizeText(value)
    .split(/\s+/)
    .map((token) => token.replace(/^[-/.]+|[-/.]+$/g, ''))
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token)))];
}

function concepts(value: string) {
  const normalized = normalizeText(value);
  return CONCEPT_GROUPS.flatMap((group, index) => group.some((term) => normalized.includes(normalizeText(term))) ? [index] : []);
}

function evidenceRecords(profile: CandidateProfile): EvidenceRecord[] {
  const records: EvidenceRecord[] = [];
  (profile.experience ?? []).forEach((item, experienceIndex) => {
    item.bullets.forEach((bullet, bulletIndex) => records.push({
      id: `EXP:${experienceIndex}:${bulletIndex}`,
      label: `${item.title} · ${item.organization}`,
      excerpt: bullet,
      text: [item.title, item.organization, bullet, ...(item.skills ?? [])].join(' '),
      kind: 'experience',
    }));
  });
  (profile.projects ?? []).forEach((project, projectIndex) => {
    const bullets = project.bullets?.length ? project.bullets : [project.description];
    bullets.filter(Boolean).forEach((bullet, bulletIndex) => records.push({
      id: `PROJ:${projectIndex}:${bulletIndex}`,
      label: project.name,
      excerpt: bullet,
      text: [project.name, project.description, bullet, ...(project.skills ?? [])].join(' '),
      kind: 'project',
    }));
  });
  profile.skills.forEach((skill, index) => records.push({
    id: `SKILL:${index}`,
    label: 'Verified skill',
    excerpt: skill,
    text: skill,
    kind: 'skill',
  }));
  (profile.degrees ?? []).forEach((degree, index) => records.push({
    id: `EDU:${index}`,
    label: degree.institution,
    excerpt: [degree.degree, degree.field, degree.end].filter(Boolean).join(' · '),
    text: [degree.degree, degree.field, degree.institution, degree.end, ...(degree.coursework ?? [])].filter(Boolean).join(' '),
    kind: 'education',
  }));
  (profile.certifications ?? []).forEach((certification, index) => records.push({
    id: `CERT:${index}`,
    label: 'Certification',
    excerpt: certification,
    text: certification,
    kind: 'certification',
  }));
  (profile.courses ?? []).forEach((course, index) => records.push({
    id: `COURSE:${index}`, label: 'Course', excerpt: course, text: course, kind: 'course',
  }));
  (profile.languages ?? []).forEach((language, index) => records.push({
    id: `LANG:${index}`, label: 'Language', excerpt: language, text: language, kind: 'language',
  }));
  (profile.awards ?? []).forEach((award, index) => records.push({
    id: `AWARD:${index}`, label: 'Honor or award', excerpt: award, text: award, kind: 'award',
  }));
  (profile.publications ?? []).forEach((publication, index) => records.push({
    id: `PUB:${index}`, label: 'Publication', excerpt: publication, text: publication, kind: 'publication',
  }));
  if (profile.yearsExperience != null) records.push({
    id: 'PROFILE:YEARS',
    label: 'Verified profile',
    excerpt: `${profile.yearsExperience} years of professional experience`,
    text: `${profile.yearsExperience} years of professional experience`,
    kind: 'profile',
  });
  (profile.workAuthorization ?? []).forEach((authorization, index) => records.push({
    id: `PROFILE:AUTH:${index}`,
    label: 'Work authorization',
    excerpt: authorization,
    text: authorization,
    kind: 'profile',
  }));
  return records;
}

function lexicalScore(requirement: string, evidence: EvidenceRecord) {
  const requirementText = normalizeText(requirement);
  const evidenceText = normalizeText(evidence.text);
  const requirementTokens = tokens(requirement);
  if (!requirementTokens.length) return 0;
  const evidenceTokens = new Set(tokens(evidence.text));
  const hits = requirementTokens.filter((token) => evidenceTokens.has(token)).length;
  const coverage = hits / requirementTokens.length;
  const exactPhrase = requirementText.length >= 3 && evidenceText.includes(requirementText);
  return Math.min(1, coverage * 0.78 + (exactPhrase ? 0.22 : 0));
}

function conceptScore(requirement: string, evidence: EvidenceRecord) {
  const required = concepts(requirement);
  if (!required.length) return 0;
  const present = new Set(concepts(evidence.text));
  return required.filter((concept) => present.has(concept)).length / required.length;
}

function numericRequirementSupport(requirement: string, profile: CandidateProfile) {
  const match = normalizeText(requirement).match(/(\d+(?:\.\d+)?)\s*\+?\s*years?/);
  if (!match) return null;
  const required = Number(match[1]);
  if (!Number.isFinite(required) || profile.yearsExperience == null) return 'gap' as const;
  if (profile.yearsExperience >= required) return 'supported' as const;
  return profile.yearsExperience >= Math.max(1, required - 1) ? 'partial' as const : 'gap' as const;
}

function degreeSupport(requirement: string, record: EvidenceRecord) {
  if (record.kind !== 'education') return null;
  const required = normalizeText(requirement);
  if (!/\b(bachelor|master|msc|phd|degree|diploma)\b/.test(required)) return null;
  const evidence = normalizeText(record.text);
  const levelMatches = [
    ['bachelor', /\b(bachelor|bsc|btech)\b/],
    ['master', /\b(master|msc)\b/],
    ['msc', /\b(master|msc)\b/],
    ['phd', /\b(phd|doctorate)\b/],
    ['diploma', /\bdiploma\b/],
  ].some(([term, pattern]) => required.includes(term as string) && (pattern as RegExp).test(evidence));
  if (!levelMatches && !required.includes('degree')) return 'gap' as const;
  return /expected|present|current/.test(evidence) && /\b(required|must have|completed|hold)\b/.test(required)
    ? 'partial' as const
    : 'supported' as const;
}

function rankEvidence(requirement: string, records: EvidenceRecord[]) {
  const lexical = records.map((record) => ({ record, score: lexicalScore(requirement, record) }))
    .sort((a, b) => b.score - a.score);
  const semantic = records.map((record) => ({ record, score: conceptScore(requirement, record) }))
    .sort((a, b) => b.score - a.score);
  const lexicalRanks = new Map(lexical.map((item, index) => [item.record.id, index + 1]));
  const semanticRanks = new Map(semantic.map((item, index) => [item.record.id, index + 1]));

  return records.map((record) => {
    const exact = lexicalScore(requirement, record);
    const related = conceptScore(requirement, record);
    const lexicalRank = lexicalRanks.get(record.id) ?? records.length;
    const semanticRank = semanticRanks.get(record.id) ?? records.length;
    const rrf = 1 / (60 + lexicalRank) + 1 / (60 + semanticRank);
    const score = Math.min(1, exact * 0.66 + related * 0.24 + rrf * 3);
    return { record, score, exact, related };
  }).sort((a, b) => b.score - a.score);
}

function supportStatus(requirement: string, profile: CandidateProfile, top: ReturnType<typeof rankEvidence>[number] | undefined): RequirementSupport {
  const numeric = numericRequirementSupport(requirement, profile);
  if (numeric) return numeric;
  if (!top) return 'gap';
  const degree = degreeSupport(requirement, top.record);
  if (degree) return degree;
  if (top.exact >= 0.72 || (top.exact >= 0.34 && top.related >= 0.5) || top.score >= 0.68) return 'supported';
  if (top.exact >= 0.26 || top.related >= 0.5 || top.score >= 0.34) return 'partial';
  return 'gap';
}

function uniqueRequirements(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalizeText(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildRequirementEvidenceMatrix(
  _job: Job,
  profile: CandidateProfile,
  match?: MatchScore,
): RequirementEvidence[] {
  const records = evidenceRecords(profile);
  const requirements = [
    ...uniqueRequirements(match?.mustHave ?? []).map((requirement) => ({ requirement, importance: 'must-have' as const })),
    ...uniqueRequirements(match?.preferred ?? []).filter((requirement) => !(match?.mustHave ?? []).some((must) => normalizeText(must) === normalizeText(requirement)))
      .map((requirement) => ({ requirement, importance: 'preferred' as const })),
  ];

  return requirements.slice(0, 18).map(({ requirement, importance }) => {
    const ranked = rankEvidence(requirement, records);
    const top = ranked[0];
    const support = supportStatus(requirement, profile, top);
    const minimum = support === 'supported' ? 0.28 : 0.2;
    const evidence = support === 'gap' ? [] : ranked
      .filter((item) => item.score >= minimum)
      .slice(0, 3)
      .map((item) => ({
        id: item.record.id,
        label: item.record.label,
        excerpt: item.record.excerpt,
        score: Math.round(item.score * 100),
      }));
    return {
      requirement,
      importance,
      support,
      confidence: support === 'gap' ? Math.round((1 - (top?.score ?? 0)) * 100) : Math.round((top?.score ?? 0) * 100),
      evidence,
    };
  });
}
