import type { ApplicationPack, CandidateProfile, Job, MatchScore } from './types';
import { normalizeText } from './utils';

export interface TailoredEducationItem {
  institution: string;
  degree: string;
  field?: string;
  coursework: string[];
}

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'into', 'is', 'it', 'of', 'on', 'or',
  'the', 'their', 'this', 'to', 'with', 'work', 'working', 'role', 'team', 'experience', 'required', 'preferred',
  'skills', 'skill', 'using', 'use', 'candidate', 'position', 'responsibilities', 'requirements', 'knowledge',
]);

const COURSE_ALIASES: Record<string, string[]> = {
  'statistical learning': ['machine learning', 'data science', 'predictive modeling', 'statistics', 'analytics'],
  'intro artificial intelligence': ['artificial intelligence', 'ai', 'machine learning'],
  'introduction artificial intelligence': ['artificial intelligence', 'ai', 'machine learning'],
  'neural networks and deep learning': ['neural networks', 'deep learning', 'machine learning', 'tensorflow', 'computer vision', 'nlp'],
  'topics applied artificial intelligence': ['applied ai', 'artificial intelligence', 'ai', 'machine learning'],
  'software eng distributed sys': ['software engineering', 'distributed systems', 'backend', 'system design', 'microservices', 'scalability', 'concurrency'],
  'software engineering distributed systems': ['software engineering', 'distributed systems', 'backend', 'system design', 'microservices', 'scalability', 'concurrency'],
  'data structures and algorithms': ['algorithms', 'data structures', 'coding', 'software engineering', 'problem solving'],
  'database management systems': ['database', 'sql', 'postgresql', 'postgres', 'data management', 'backend'],
  'operating systems': ['operating systems', 'linux', 'systems', 'concurrency', 'processes', 'infrastructure'],
  'network and communication': ['networking', 'network', 'tcp', 'ip', 'infrastructure', 'systems'],
  'principles of cloud computing': ['cloud', 'aws', 'azure', 'gcp', 'oci', 'devops', 'infrastructure'],
  'cyber security': ['cybersecurity', 'security', 'information security'],
  'information security management': ['information security', 'security', 'iso 27001', 'risk management', 'governance'],
  'information security analysis and audit': ['information security', 'security audit', 'audit', 'iso 27001', 'risk'],
  'java programming': ['java', 'backend', 'object oriented programming', 'software development'],
  'internet and web programming': ['web development', 'frontend', 'backend', 'full stack', 'javascript', 'web applications', 'rest api'],
  'parallel and distributed computing': ['parallel computing', 'distributed computing', 'distributed systems', 'concurrency'],
  'statistics for engineers': ['statistics', 'data analysis', 'analytics', 'machine learning', 'data science'],
  'applied linear algebra': ['linear algebra', 'machine learning', 'deep learning', 'data science'],
  'artificial intelligence': ['artificial intelligence', 'ai', 'machine learning'],
  'human computer interaction': ['human computer interaction', 'hci', 'ux', 'ui', 'user experience'],
  'internet of things': ['internet of things', 'iot', 'embedded', 'sensors'],
  'blockchain and cryptocurrency technologies': ['blockchain', 'cryptocurrency', 'distributed ledger'],
  'theory of computation and compiler design': ['compiler', 'theory of computation', 'algorithms', 'formal languages'],
  'computer architecture and organization': ['computer architecture', 'systems', 'hardware', 'low level'],
  'digital logic and design': ['digital logic', 'hardware', 'computer architecture'],
  'microprocessor and interfacing': ['microprocessor', 'embedded', 'hardware', 'assembly'],
  'web mining': ['web mining', 'data mining', 'analytics', 'machine learning'],
  'problem solving and object oriented programming': ['object oriented programming', 'oop', 'software development', 'programming'],
  'problem solving and programming': ['programming', 'problem solving', 'software development'],
};

function words(value: string) {
  return normalizeText(value)
    .split(/\s+/)
    .map((token) => token.replace(/^[-/.]+|[-/.]+$/g, ''))
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

function stem(token: string) {
  if (token.length > 6 && token.endsWith('ing')) return token.slice(0, -3);
  if (token.length > 5 && token.endsWith('ed')) return token.slice(0, -2);
  if (token.length > 5 && token.endsWith('es')) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith('s')) return token.slice(0, -1);
  return token;
}

function context(job: Job, match?: MatchScore) {
  return [
    job.title,
    job.department,
    job.description,
    ...(match?.mustHave ?? []),
    ...(match?.preferred ?? []),
    ...(match?.matchedSkills ?? []),
    ...(match?.strengths ?? []),
  ].filter(Boolean).join(' ');
}

function aliasesFor(course: string) {
  const normalized = normalizeText(course)
    .replace(/\bintro\b/g, 'introduction')
    .replace(/\bappl\b/g, 'applied')
    .replace(/\bartificial intel\b/g, 'artificial intelligence')
    .replace(/\bdeep learn\b/g, 'deep learning');
  const direct = COURSE_ALIASES[normalized] ?? [];
  const fuzzy = Object.entries(COURSE_ALIASES)
    .filter(([key]) => normalized.includes(key) || key.includes(normalized))
    .flatMap(([, values]) => values);
  return [...new Set([course, ...direct, ...fuzzy])];
}

function courseScore(course: string, jobContext: string) {
  const normalizedContext = normalizeText(jobContext);
  const contextStems = new Set(words(jobContext).map(stem));
  let score = 0;

  for (const phrase of aliasesFor(course)) {
    const normalizedPhrase = normalizeText(phrase);
    if (!normalizedPhrase) continue;
    if (normalizedContext.includes(normalizedPhrase)) score += normalizedPhrase.includes(' ') ? 14 : 8;
    const phraseStems = [...new Set(words(phrase).map(stem))];
    const hits = phraseStems.filter((token) => contextStems.has(token)).length;
    score += hits * 2.5;
    if (phraseStems.length > 1 && hits === phraseStems.length) score += 4;
  }

  return score;
}

export function tailorRelevantCoursework(job: Job, profile: CandidateProfile, match?: MatchScore): TailoredEducationItem[] {
  const jobContext = context(job, match);
  let remaining = 5;
  const result: TailoredEducationItem[] = [];

  for (const degree of profile.degrees ?? []) {
    if (remaining <= 0) break;
    const available = [...new Set((degree.coursework ?? []).filter(Boolean))];
    if (!available.length) continue;
    const ranked = available
      .map((course, index) => ({ course, index, score: courseScore(course, jobContext) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, Math.min(3, remaining));
    if (!ranked.length) continue;
    result.push({
      institution: degree.institution,
      degree: degree.degree,
      field: degree.field,
      coursework: ranked.map((item) => item.course),
    });
    remaining -= ranked.length;
  }

  return result;
}

export function profileWithTailoredCourseworkForResume(profile: CandidateProfile, pack: ApplicationPack): CandidateProfile {
  const selected = new Map((pack.education ?? []).map((item) => [
    `${normalizeText(item.institution)}|${normalizeText(item.degree)}`,
    item.coursework,
  ]));

  return {
    ...profile,
    degrees: (profile.degrees ?? []).map((degree) => {
      const key = `${normalizeText(degree.institution)}|${normalizeText(degree.degree)}`;
      const courses = (selected.get(key) ?? []).slice(0, 2);
      return {
        ...degree,
        field: /artificial intelligence specialization/i.test(degree.field ?? '') ? 'AI Specialization' : degree.field,
        coursework: courses,
      };
    }),
  };
}
