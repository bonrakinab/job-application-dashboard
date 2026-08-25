import type { ApplicationPack, CandidateProfile, CompanyIntelligence, Job, MatchScore, ProjectItem } from './types';
import { normalizeText } from './utils';

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'into', 'is', 'it', 'of', 'on', 'or',
  'our', 'the', 'their', 'this', 'to', 'we', 'with', 'you', 'your', 'will', 'work', 'working', 'role', 'team',
  'experience', 'skills', 'using', 'use', 'including', 'strong', 'preferred', 'required', 'requirements', 'responsibilities',
  'candidate', 'position', 'company', 'ability', 'knowledge', 'support', 'develop', 'development', 'environment',
]);

const INTERNAL_OR_AWKWARD_PHRASES = [
  /what stands out to me in the posting is its emphasis on/i,
  /my most relevant technical strengths for (?:these needs|this role) include/i,
  /my selected project work for this opportunity includes/i,
  /my project work has been selected specifically/i,
  /with unrelated projects omitted from the application/i,
  /evidence-backed experience/i,
  /maps directly to the technical priorities described/i,
  /together, this work gives me practical evidence/i,
  /the technical priorities described in the job posting/i,
];

function terms(value = '') {
  return normalizeText(value)
    .split(/\s+/)
    .map((token) => token.replace(/^[-/.]+|[-/.]+$/g, ''))
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function overlapScore(value: string, context: string) {
  const contextTerms = new Set(terms(context));
  let score = 0;
  for (const token of new Set(terms(value))) {
    if (contextTerms.has(token)) score += token.length >= 7 ? 2 : 1;
  }
  return score;
}

export function cleanCompanyName(value: string) {
  const cleaned = value
    .replace(/\s*[-–—]\s*confidential\s*$/i, '')
    .replace(/\s*\(confidential\)\s*$/i, '')
    .trim();
  return cleaned || value.trim();
}

export function hasUsableJobDescription(job: Pick<Job, 'description'>) {
  const description = (job.description ?? '').replace(/\s+/g, ' ').trim();
  if (description.length < 80) return false;
  const alphaWords = description.match(/[A-Za-z][A-Za-z0-9+.#/-]{2,}/g) ?? [];
  if (alphaWords.length < 12) return false;
  const digits = (description.match(/\d/g) ?? []).length;
  if (digits > description.length * 0.45) return false;
  return true;
}

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export function coverLetterQualityIssues(letter: string, job: Pick<Job, 'title' | 'company' | 'description'>) {
  const text = letter.trim();
  const issues: string[] = [];
  const words = wordCount(text);
  if (words < 150) issues.push('too-short');
  if (words > 430) issues.push('too-long');
  if (!/^dear\b/im.test(text)) issues.push('missing-greeting');
  if (!/\b(sincerely|best regards|kind regards),?/i.test(text)) issues.push('missing-signoff');
  if (!normalizeText(text).includes(normalizeText(cleanCompanyName(job.company)))) issues.push('missing-company');
  if (!normalizeText(text).includes(normalizeText(job.title))) issues.push('missing-role');
  if (INTERNAL_OR_AWKWARD_PHRASES.some((pattern) => pattern.test(text))) issues.push('internal-or-template-language');

  const paragraphs = text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  if (paragraphs.length < 5) issues.push('weak-structure');

  if (!hasUsableJobDescription(job)) {
    const raw = (job.description ?? '').trim();
    if (raw.length >= 4 && text.includes(raw)) issues.push('exposes-sparse-jd-token');
  }

  return [...new Set(issues)];
}

function selectedProjectSources(profile: CandidateProfile, pack: ApplicationPack) {
  const source = new Map((profile.projects ?? []).map((project) => [normalizeText(project.name), project]));
  return (pack.projects ?? []).map((selected) => ({
    selected,
    source: source.get(normalizeText(selected.name)),
  }));
}

function projectRelevance(project: ProjectItem | undefined, selectedBullets: string[], job: Job, match?: MatchScore) {
  const context = [
    job.title,
    job.department,
    hasUsableJobDescription(job) ? job.description : '',
    ...(match?.mustHave ?? []),
    ...(match?.preferred ?? []),
    ...(match?.matchedSkills ?? []),
  ].filter(Boolean).join(' ');
  const text = [project?.name, project?.description, ...(project?.skills ?? []), ...selectedBullets].filter(Boolean).join(' ');
  return overlapScore(text, context);
}

function topRelevantProjects(profile: CandidateProfile, pack: ApplicationPack, job: Job, match?: MatchScore) {
  return selectedProjectSources(profile, pack)
    .map((entry, index) => ({ ...entry, index, score: projectRelevance(entry.source, entry.selected.bullets ?? [], job, match) }))
    .filter((entry) => entry.score > 0 || !hasUsableJobDescription(job))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 1);
}

function bestExperienceEvidence(pack: ApplicationPack, job: Job, match?: MatchScore) {
  const context = [
    job.title,
    job.department,
    hasUsableJobDescription(job) ? job.description : '',
    ...(match?.mustHave ?? []),
    ...(match?.preferred ?? []),
    ...(match?.matchedSkills ?? []),
  ].filter(Boolean).join(' ');

  const candidates = (pack.experience ?? []).flatMap((item) => (item.bullets ?? []).map((bullet, bulletIndex) => ({
    organization: item.organization,
    title: item.title,
    bullet,
    bulletIndex,
    score: overlapScore(bullet, context),
  })));
  return candidates.sort((a, b) => b.score - a.score || a.bulletIndex - b.bulletIndex)[0];
}

function expectedGraduationSentence(profile: CandidateProfile) {
  const degree = (profile.degrees ?? []).find((item) => /expected|present|current/i.test(item.end ?? ''));
  if (!degree) return '';
  const monthYear = degree.end?.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{4}/i)?.[0];
  return monthYear
    ? `I am an MSc Computer Science (AI) candidate at the University of Windsor, graduating in ${monthYear}.`
    : 'I am currently completing an MSc in Computer Science with an Artificial Intelligence specialization at the University of Windsor.';
}

function firstPersonEvidence(value: string) {
  const text = value.trim().replace(/[.]$/, '');
  if (!text) return '';
  if (/^I\b/i.test(text)) return text;
  if (/^responsible for\b/i.test(text)) return `I was ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
  return `I ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}

function focusTerms(job: Job, match?: MatchScore) {
  if (!hasUsableJobDescription(job)) return [];
  return [...(match?.matchedSkills ?? [])]
    .map((value) => value.trim().replace(/^[-•\s]+/, '').replace(/[.;:,]+$/, ''))
    .filter((value) => /[A-Za-z]{3}/.test(value) && value.length >= 3 && value.length <= 70 && !/^\d+$/.test(value))
    .filter((value, index, list) => list.findIndex((candidate) => normalizeText(candidate) === normalizeText(value)) === index)
    .slice(0, 2);
}

function fallbackProjectParagraph(entry: ReturnType<typeof topRelevantProjects>[number] | undefined, focus: string[]) {
  if (!entry) return '';
  const evidence = entry.selected.bullets?.[0] || entry.source?.description || '';
  const skills = (entry.source?.skills ?? []).slice(0, 3);
  const evidenceSentence = evidence ? firstPersonEvidence(evidence) : `I developed ${entry.selected.name} as a hands-on technical project`;
  const evidenceNormalized = normalizeText(evidence);
  const missingSkillMentions = skills.filter((skill) => !evidenceNormalized.includes(normalizeText(skill)));
  const skillClause = missingSkillMentions.length ? ` The work also gave me practical experience with ${missingSkillMentions.join(', ')}.` : '';
  const relevanceClause = focus.length ? ` That experience is relevant to the role's focus on ${focus.join(' as well as ')}.` : '';
  return `Alongside my professional experience, ${evidenceSentence}.${skillClause}${relevanceClause}`.replace(/\.\./g, '.');
}

export function buildProfessionalFallbackCoverLetter(
  pack: ApplicationPack,
  profile: CandidateProfile,
  job: Job,
  match?: MatchScore,
  _research?: CompanyIntelligence | null,
) {
  const company = cleanCompanyName(job.company);
  const graduation = expectedGraduationSentence(profile);
  const experience = bestExperienceEvidence(pack, job, match);
  const project = topRelevantProjects(profile, pack, job, match)[0];
  const focus = focusTerms(job, match);

  const opening = [
    `I am writing to apply for the ${job.title} position at ${company}.`,
    graduation,
    focus.length
      ? `The role aligns well with my background in ${focus.join(' as well as ')}, supported by both professional and project work.`
      : 'The role is a strong fit for my background across enterprise IT, software development, data, and applied AI.',
  ].filter(Boolean).join(' ');

  const experienceParagraph = experience
    ? `In my professional experience at ${experience.organization}, ${firstPersonEvidence(experience.bullet)}. This work strengthened my ability to solve operational and technical problems carefully, communicate across stakeholders, and deliver maintainable solutions. It also required me to balance implementation detail with the business context behind each request, which is an approach I would bring to this position.`.replace(/\.\./g, '.')
    : 'My professional background has required me to work across technical systems, business requirements, documentation, and cross-functional problem solving while keeping implementation details accurate and maintainable. I have learned to approach technical work with attention to both the immediate issue and the broader process it supports.';

  const projectParagraph = fallbackProjectParagraph(project, focus)
    || 'My graduate and independent project work has also given me hands-on practice translating requirements into working software, validating results, and iterating on technical decisions. That work complements my professional experience by keeping me close to implementation, testing, and practical problem solving.';

  const closing = `I would be glad to discuss how my experience and current graduate work could contribute to ${company} in this role. I am looking for an opportunity where I can apply my technical foundation while continuing to learn from a strong team and take ownership of useful, well-structured work. Thank you for considering my application.`;

  return [
    'Dear Hiring Manager,',
    opening,
    experienceParagraph,
    projectParagraph,
    closing,
    `Sincerely,\n${profile.name}`,
  ].join('\n\n');
}

export function withProfessionalCoverLetterQualityGate(
  pack: ApplicationPack,
  profile: CandidateProfile,
  job: Job,
  match?: MatchScore,
  research?: CompanyIntelligence | null,
): ApplicationPack {
  const issues = coverLetterQualityIssues(pack.coverLetter ?? '', job);
  if (!issues.length) return pack;
  return {
    ...pack,
    coverLetter: buildProfessionalFallbackCoverLetter(pack, profile, job, match, research),
  };
}

// Compatibility aliases for existing imports/tests. These now use the professional fallback/quality-gate behavior.
export const buildJdProjectAlignedCoverLetter = buildProfessionalFallbackCoverLetter;
export const withJdProjectAlignedCoverLetter = withProfessionalCoverLetterQualityGate;
