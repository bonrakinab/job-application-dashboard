import { containsTerm } from './resume-evidence-guards';
import { ATS_PASS_SCORE, type AtsReadinessScore } from './ats-score';
import { scoreTailoredResumeWithCoursework } from './ats-coursework';
import type { ApplicationPack, CandidateProfile, Job, MatchScore } from './types';
import { normalizeText } from './utils';

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'into', 'is', 'it', 'of', 'on', 'or',
  'the', 'their', 'this', 'to', 'with', 'work', 'working', 'role', 'team', 'experience', 'required', 'preferred',
  'skills', 'skill', 'using', 'use', 'candidate', 'position', 'responsibilities', 'requirements',
]);

function tokens(value: string) {
  return [...new Set(normalizeText(value)
    .split(/\s+/)
    .map((token) => token.replace(/^[-/.]+|[-/.]+$/g, ''))
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token)))];
}

function unique(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalizeText(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function context(job: Job, match?: MatchScore) {
  return [job.title, job.department, job.description, ...(match?.mustHave ?? []), ...(match?.preferred ?? []),
    ...(match?.matchedSkills ?? []), ...(match?.strengths ?? [])].filter(Boolean).join(' ');
}

function relevance(value: string, jobContext: string) {
  const target = new Set(tokens(jobContext));
  const valueTokens = tokens(value);
  if (!target.size || !valueTokens.length) return 0;
  let score = valueTokens.filter((token) => target.has(token)).length;
  const normalizedValue = normalizeText(value);
  const normalizedTarget = normalizeText(jobContext);
  for (const phrase of normalizedValue.split(/[,;|()]/).map((part) => part.trim()).filter((part) => part.length >= 5)) {
    if (containsTerm(normalizedTarget, phrase)) score += 3;
  }
  return score;
}

function evidenceQuality(text: string) {
  const numbers = text.match(/\b\d+(?:[.,]\d+)?(?:%|\+)?\b/g)?.length ?? 0;
  const resultVerb = /\b(?:reduced|increased|improved|consolidated|achieved|resolved|delivered|migrated|built|implemented|optimized|automated|supported)\b/i.test(text) ? 1.5 : 0;
  const compact = text.length <= 240 ? 0.5 : 0;
  return Math.min(5, numbers * 1.2 + resultVerb + compact);
}

function expectedDegreeLine(profile: CandidateProfile) {
  if (profile.profilePurpose === 'part-time') {
    const titles = [...new Set((profile.experience ?? []).map((item) => item.title).filter(Boolean))].slice(0, 2);
    return profile.headline?.trim() || (titles.length ? `Candidate with experience as ${titles.join(' and ')}` : 'Part-time job candidate');
  }
  const degree = (profile.degrees ?? []).find((item) => /master|msc/i.test(`${item.degree} ${item.field ?? ''}`));
  if (!degree) return 'Computer Science candidate';
  const expected = /expected|present|current/i.test(degree.end ?? '');
  const field = /artificial intelligence|\bai\b/i.test(degree.field ?? '') ? ' (AI)' : '';
  const timing = degree.end?.replace(/\s*\(Expected\)\s*/i, '').trim();
  if (expected) return `MSc Computer Science${field} candidate at ${degree.institution}${timing ? `, expected ${timing}` : ''}`;
  return `MSc Computer Science${field}`;
}

function supportedJobSkills(job: Job, profile: CandidateProfile, match?: MatchScore) {
  const jd = normalizeText(`${job.title} ${job.description}`);
  const allowed = new Map(profile.skills.map((skill) => [normalizeText(skill), skill]));
  const exact = profile.skills.filter((skill) => containsTerm(jd, skill));
  const matched = (match?.matchedSkills ?? []).map((skill) => allowed.get(normalizeText(skill))).filter((skill): skill is string => Boolean(skill));
  return unique([...matched, ...exact]);
}

function targetedSummary(job: Job, profile: CandidateProfile, skills: string[]) {
  if (profile.profilePurpose === 'part-time') {
    const first = `${expectedDegreeLine(profile)} with documented experience relevant to ${job.title}.`;
    const second = skills.length ? `Relevant verified strengths include ${skills.slice(0, 6).join(', ')}.`
      : 'The résumé presents only the experience and qualifications supplied in the separate part-time profile.';
    return `${first} ${second}`;
  }
  const first = `${expectedDegreeLine(profile)} with hands-on experience relevant to ${job.title}.`;
  const second = skills.length ? `Relevant verified strengths include ${skills.slice(0, 6).join(', ')} across professional, academic, and project work.`
    : 'Background spans enterprise IT, software development, data, and applied AI through verified professional and project work.';
  return `${first} ${second}`;
}

function targetedHeadline(job: Job, skills: string[]) {
  return [job.title, ...skills.slice(0, 3)].filter(Boolean).join(' | ').slice(0, 140);
}

function rankBullets(bullets: Array<{ text: string; evidenceIds: string[] }>, parentSkills: string[], jobContext: string, limit: number) {
  return bullets
    .map((item, index) => ({ ...item, index, score: relevance(`${item.text} ${parentSkills.join(' ')}`, jobContext) + evidenceQuality(item.text) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit);
}

function experienceKey(organization: string, title: string) {
  return `${normalizeText(organization)}|${normalizeText(title)}`;
}

function optimizedExperience(profile: CandidateProfile, pack: ApplicationPack, jobContext: string) {
  const sourceRoles = profile.profilePurpose === 'part-time'
    ? pack.experience.map((selected) => (profile.experience ?? []).find((source) => experienceKey(source.organization, source.title) === experienceKey(selected.organization, selected.title))).filter((role): role is NonNullable<typeof role> => Boolean(role))
    : (profile.experience ?? []).slice(0, 3);
  const selectedMap = new Map(pack.experience.map((item) => [experienceKey(item.organization, item.title), item]));
  const profileRoles = profile.experience ?? [];

  return sourceRoles.slice(0, 3).map((source, roleIndex) => {
    const sourceIndex = profileRoles.findIndex((item) => experienceKey(item.organization, item.title) === experienceKey(source.organization, source.title));
    const selected = selectedMap.get(experienceKey(source.organization, source.title));
    const rewrites = new Map((selected?.bulletEvidence ?? []).flatMap((ids, index) => ids.length === 1 ? [[ids[0], selected.bullets[index]] as const] : []));
    const candidates = source.bullets.map((text, bulletIndex) => {
      const evidenceId = `EXP:${sourceIndex}:${bulletIndex}`;
      return { text: rewrites.get(evidenceId) ?? text, evidenceIds: [evidenceId] };
    });
    // Match the reference density: 3 bullets for the primary role, up to 2 for
    // the second, and 1 for the third. Quantified achievements receive a small
    // quality boost so the strongest accomplishment cannot vanish on retuning.
    const limit = profile.profilePurpose === 'part-time' ? 2 : roleIndex === 0 ? 3 : roleIndex === 1 ? 2 : 1;
    const bullets = rankBullets(candidates, source.skills ?? [], jobContext, limit);
    return {
      organization: source.organization,
      title: source.title,
      bullets: bullets.map((item) => item.text),
      bulletEvidence: bullets.map((item) => item.evidenceIds),
    };
  }).filter((item) => item.bullets.length > 0);
}

function optimizedProjects(profile: CandidateProfile, pack: ApplicationPack, jobContext: string) {
  const selectedByName = new Map(pack.projects.map((project) => [normalizeText(project.name), project]));
  const ranked = (profile.projects ?? []).map((project, index) => ({
    project,
    index,
    score: relevance([project.name, project.description, ...(project.skills ?? []), ...(project.bullets ?? [])].join(' '), jobContext) + evidenceQuality((project.bullets ?? []).join(' ')),
    thesis: /msc thesis|thesis/i.test(project.name),
  })).sort((a, b) => {
    if (profile.profilePurpose === 'part-time') return b.score - a.score || a.index - b.index;
    if (a.thesis !== b.thesis && /\b(?:machine learning|\bai\b|artificial intelligence|data scientist|computer vision|nlp)\b/i.test(jobContext)) return a.thesis ? -1 : 1;
    return b.score - a.score || a.index - b.index;
  });

  return ranked.slice(0, 3).flatMap(({ project, index }) => {
    const selected = selectedByName.get(normalizeText(project.name));
    const rewrites = new Map((selected?.bulletEvidence ?? []).flatMap((ids, bulletIndex) => ids.length === 1 ? [[ids[0], selected!.bullets[bulletIndex]] as const] : []));
    const candidates = (project.bullets ?? []).map((text, bulletIndex) => {
      const evidenceId = `PROJ:${index}:${bulletIndex}`;
      return { text: rewrites.get(evidenceId) ?? text, evidenceIds: [evidenceId] };
    });
    const bullets = rankBullets(candidates, project.skills ?? [], jobContext, 1);
    if (!bullets.length) return [];
    return [{ name: project.name, bullets: [bullets[0].text], bulletEvidence: [bullets[0].evidenceIds] }];
  });
}

function retunePack(job: Job, profile: CandidateProfile, pack: ApplicationPack, match: MatchScore | undefined, attempt: number): ApplicationPack {
  const jobContext = context(job, match);
  const jdSkills = supportedJobSkills(job, profile, match);
  const allowed = new Set(profile.skills.map(normalizeText));
  const skills = unique([...jdSkills, ...pack.skills.filter((skill) => allowed.has(normalizeText(skill)))])
    .slice(0, attempt >= 2 ? 24 : 20);
  return {
    ...pack,
    resumeHeadline: targetedHeadline(job, skills),
    resumeSummary: targetedSummary(job, profile, jdSkills),
    skills,
    experience: optimizedExperience(profile, pack, jobContext),
    projects: optimizedProjects(profile, pack, jobContext),
  };
}

function optimizationNotes(score: AtsReadinessScore) {
  if (score.targetReached) return ['Internal ATS optimization target reached using only verified candidate evidence.'];
  if (score.hardBlockers.length) return score.hardBlockers.slice(0, 4);
  if (score.unsupportedMustHaves.length) return score.unsupportedMustHaves.slice(0, 4).map((item) => `Unsupported mandatory requirement: ${item}`);
  if (score.missingKeywords.length) return score.missingKeywords.slice(0, 6).map((item) => `Remaining truthful gap: ${item}`);
  return ['The verified evidence was fully re-ranked and retargeted, but the internal 90-point optimization target was not reached.'];
}

export function optimizeApplicationPackForAts(job: Job, profile: CandidateProfile, initialPack: ApplicationPack, match?: MatchScore): { pack: ApplicationPack; score: AtsReadinessScore } {
  const initialScore = scoreTailoredResumeWithCoursework(job, profile, initialPack, match);

  // Structural curation is mandatory, not conditional on the ATS score. v11
  // skipped this entire pass when a raw AI pack happened to score well enough,
  // which allowed verbose imported bullets and inconsistent layouts to survive.
  let bestPack = retunePack(job, profile, initialPack, match, 1);
  let bestScore = scoreTailoredResumeWithCoursework(job, profile, bestPack, match);
  let attempts = 1;

  if (!bestScore.eligibleToApply) {
    for (let attempt = 2; attempt <= 3; attempt += 1) {
      attempts = attempt;
      const candidate = retunePack(job, profile, bestPack, match, attempt);
      const candidateScore = scoreTailoredResumeWithCoursework(job, profile, candidate, match);
      if (candidateScore.overall >= bestScore.overall) { bestPack = candidate; bestScore = candidateScore; }
      if (bestScore.eligibleToApply) break;
    }
  }

  const truthfulCeilingReached = !bestScore.eligibleToApply && attempts >= 3;
  const pack: ApplicationPack = {
    ...bestPack,
    atsOptimization: {
      passScore: ATS_PASS_SCORE,
      initialScore: initialScore.overall,
      finalScore: bestScore.overall,
      attempts,
      status: bestScore.status,
      truthfulCeilingReached,
      notes: optimizationNotes(bestScore),
    },
  };
  return { pack, score: scoreTailoredResumeWithCoursework(job, profile, pack, match) };
}
