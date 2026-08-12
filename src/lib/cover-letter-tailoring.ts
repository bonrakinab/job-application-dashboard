import type { ApplicationPack, CandidateProfile, Job, MatchScore, ProjectItem } from './types';
import { normalizeText } from './utils';

const COVER_LETTER_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'into', 'is', 'it', 'of', 'on', 'or',
  'our', 'the', 'their', 'this', 'to', 'we', 'with', 'you', 'your', 'will', 'work', 'working', 'role', 'team',
  'experience', 'skills', 'using', 'use', 'including', 'strong', 'preferred', 'required', 'requirements', 'responsibilities',
  'candidate', 'position', 'company', 'ability', 'knowledge', 'support', 'develop', 'development', 'environment',
]);

function terms(value = '') {
  return normalizeText(value)
    .split(/\s+/)
    .map((token) => token.replace(/^[-/.]+|[-/.]+$/g, ''))
    .filter((token) => token.length >= 3 && !COVER_LETTER_STOP_WORDS.has(token));
}

function overlapScore(value: string, context: string) {
  const contextTerms = new Set(terms(context));
  let score = 0;
  for (const token of new Set(terms(value))) {
    if (contextTerms.has(token)) score += token.length >= 7 ? 2 : 1;
  }
  return score;
}

function compactRequirement(value: string) {
  return value
    .replace(/^[-•\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.;:,]+$/, '')
    .slice(0, 110);
}

function jdRequirementLabels(job: Job, match?: MatchScore) {
  const explicit = [...(match?.mustHave ?? []), ...(match?.preferred ?? [])]
    .map(compactRequirement)
    .filter((value) => value.length >= 4);
  if (explicit.length) return [...new Set(explicit)].slice(0, 3);

  const skillCandidates = [...(match?.matchedSkills ?? [])]
    .map(compactRequirement)
    .filter((value) => value.length >= 2);
  if (skillCandidates.length) return [...new Set(skillCandidates)].slice(0, 3);

  const descriptionTerms = terms(job.description ?? '');
  return [...new Set(descriptionTerms)]
    .filter((term) => term.length >= 5)
    .slice(0, 3)
    .map((term) => term.replace(/\b\w/g, (char) => char.toUpperCase()));
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
    job.description,
    ...(match?.mustHave ?? []),
    ...(match?.preferred ?? []),
    ...(match?.matchedSkills ?? []),
  ].filter(Boolean).join(' ');
  const text = [
    project?.name,
    project?.description,
    ...(project?.skills ?? []),
    ...selectedBullets,
  ].filter(Boolean).join(' ');
  return overlapScore(text, context);
}

function topRelevantProjects(profile: CandidateProfile, pack: ApplicationPack, job: Job, match?: MatchScore) {
  return selectedProjectSources(profile, pack)
    .map((entry, index) => ({
      ...entry,
      index,
      score: projectRelevance(entry.source, entry.selected.bullets ?? [], job, match),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 2);
}

function topRelevantSkills(pack: ApplicationPack, job: Job, match?: MatchScore) {
  const context = [
    job.title,
    job.department,
    job.description,
    ...(match?.mustHave ?? []),
    ...(match?.preferred ?? []),
    ...(match?.matchedSkills ?? []),
  ].filter(Boolean).join(' ');
  return (pack.skills ?? [])
    .map((skill, index) => ({ skill, index, score: overlapScore(skill, context) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 6)
    .map((item) => item.skill);
}

function bestExperienceEvidence(pack: ApplicationPack, job: Job, match?: MatchScore) {
  const context = [
    job.title,
    job.department,
    job.description,
    ...(match?.mustHave ?? []),
    ...(match?.preferred ?? []),
  ].filter(Boolean).join(' ');

  return (pack.experience ?? [])
    .flatMap((item) => (item.bullets ?? []).map((bullet, bulletIndex) => ({
      organization: item.organization,
      title: item.title,
      bullet,
      bulletIndex,
      score: overlapScore(bullet, context),
    })))
    .sort((a, b) => b.score - a.score || a.bulletIndex - b.bulletIndex)
    .find((item) => item.score > 0);
}

function expectedGraduationSentence(profile: CandidateProfile) {
  const degree = (profile.degrees ?? []).find((item) => /expected|present|current/i.test(item.end ?? ''));
  if (!degree) return '';
  const monthYear = degree.end?.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{4}/i)?.[0];
  return monthYear
    ? `I am an MSc Computer Science (AI) candidate at the University of Windsor, graduating in ${monthYear}.`
    : 'I am currently completing an MSc in Computer Science with an Artificial Intelligence specialization at the University of Windsor.';
}

function projectSentence(entry: ReturnType<typeof topRelevantProjects>[number]) {
  const skills = (entry.source?.skills ?? []).slice(0, 5);
  const evidence = entry.selected.bullets?.[0] || entry.source?.description || '';
  const skillText = skills.length ? ` using ${skills.join(', ')}` : '';
  if (evidence) {
    return `In ${entry.selected.name}, I ${evidence.charAt(0).toLowerCase()}${evidence.slice(1).replace(/[.]$/, '')}${skillText}.`;
  }
  return `My ${entry.selected.name} project gave me hands-on experience${skillText}.`;
}

export function buildJdProjectAlignedCoverLetter(
  pack: ApplicationPack,
  profile: CandidateProfile,
  job: Job,
  match?: MatchScore,
) {
  const requirements = jdRequirementLabels(job, match);
  const skills = topRelevantSkills(pack, job, match);
  const projects = topRelevantProjects(profile, pack, job, match);
  const experience = bestExperienceEvidence(pack, job, match);
  const graduation = expectedGraduationSentence(profile);

  const requirementSentence = requirements.length
    ? `What stands out to me in the posting is its emphasis on ${requirements.join(', ')}.`
    : 'The responsibilities described for this role align closely with the technical work I have been building across graduate research, projects, and professional experience.';

  const skillSentence = skills.length
    ? `My most relevant technical strengths for these needs include ${skills.join(', ')}.`
    : '';

  const experienceSentence = experience
    ? `In my professional experience at ${experience.organization}, ${experience.bullet.charAt(0).toLowerCase()}${experience.bullet.slice(1)}`
    : '';

  const projectParagraph = projects.length
    ? `${projects.map(projectSentence).join(' ')} Together, this work gives me practical evidence that maps directly to the technical priorities described in the job posting.`
    : 'My project work has been selected specifically for the technical priorities described in this posting, with unrelated projects omitted from the application.';

  return [
    'Dear Hiring Manager,',
    `I am applying for the ${job.title} position at ${job.company}. ${graduation} ${requirementSentence}`.replace(/\s+/g, ' ').trim(),
    [skillSentence, experienceSentence].filter(Boolean).join(' '),
    projectParagraph,
    `I would welcome the opportunity to bring this combination of relevant project work, technical skills, and professional experience to ${job.company}. Thank you for your consideration.`,
    `Sincerely,\n${profile.name}`,
  ].filter(Boolean).join('\n\n');
}

export function withJdProjectAlignedCoverLetter(
  pack: ApplicationPack,
  profile: CandidateProfile,
  job: Job,
  match?: MatchScore,
): ApplicationPack {
  return {
    ...pack,
    coverLetter: buildJdProjectAlignedCoverLetter(pack, profile, job, match),
  };
}
