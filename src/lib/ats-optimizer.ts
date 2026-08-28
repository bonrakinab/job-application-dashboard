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

function relevance(value: string, jobContext: string) {
  const target = new Set(tokens(jobContext));
  const valueTokens = tokens(value);
  if (!target.size || !valueTokens.length) return 0;
  let score = valueTokens.filter((token) => target.has(token)).length;
  const normalizedValue = normalizeText(value);
  const normalizedTarget = normalizeText(jobContext);
  for (const phrase of normalizedValue.split(/[,;|()]/).map((part) => part.trim()).filter((part) => part.length >= 5)) {
    if (normalizedTarget.includes(phrase)) score += 3;
  }
  return score;
}

function expectedDegreeLine(profile: CandidateProfile) {
  const degree = (profile.degrees ?? []).find((item) => /master|msc/i.test(`${item.degree} ${item.field ?? ''}`));
  if (!degree) return 'Computer Science candidate';
  const expected = /expected|present|current/i.test(degree.end ?? '');
  const field = /artificial intelligence|\bai\b/i.test(degree.field ?? '') ? ' (AI)' : '';
  const timing = degree.end?.replace(/\s*\(Expected\)\s*/i, '').trim();
  if (expected) {
    return `MSc Computer Science${field} candidate at ${degree.institution}${timing ? `, expected ${timing}` : ''}`;
  }
  return `MSc Computer Science${field}`;
}

function supportedJobSkills(job: Job, profile: CandidateProfile, match?: MatchScore) {
  const jd = normalizeText(`${job.title} ${job.description}`);
  const allowed = new Map(profile.skills.map((skill) => [normalizeText(skill), skill]));
  const exact = profile.skills.filter((skill) => jd.includes(normalizeText(skill)));
  const matched = (match?.matchedSkills ?? [])
    .map((skill) => allowed.get(normalizeText(skill)))
    .filter((skill): skill is string => Boolean(skill));
  return unique([...matched, ...exact]);
}

function targetedSummary(job: Job, profile: CandidateProfile, skills: string[]) {
  const first = `${expectedDegreeLine(profile)} with hands-on experience relevant to ${job.title}.`;
  const second = skills.length
    ? `Relevant verified strengths include ${skills.slice(0, 6).join(', ')} across professional, academic, and project work.`
    : 'Background spans enterprise IT, software development, data, and applied AI through verified professional and project work.';
  return `${first} ${second}`;
}

function targetedHeadline(job: Job, skills: string[]) {
  return [job.title, ...skills.slice(0, 3)].filter(Boolean).join(' | ').slice(0, 140);
}

function rankBullets(bullets: string[], parentSkills: string[], jobContext: string, limit: number) {
  return bullets
    .map((text, index) => ({ text, index, score: relevance(`${text} ${parentSkills.join(' ')}`, jobContext) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((item) => item.text);
}

function experienceKey(organization: string, title: string) {
  return `${normalizeText(organization)}|${normalizeText(title)}`;
}

function optimizedExperience(profile: CandidateProfile, pack: ApplicationPack, jobContext: string, attempt: number) {
  const limit = attempt >= 2 ? 3 : 2;
  const sources = new Map((profile.experience ?? []).map((item, sourceIndex) => [
    experienceKey(item.organization, item.title),
    { item, sourceIndex },
  ]));

  return pack.experience
    .map((selected, selectedIndex) => {
      const source = sources.get(experienceKey(selected.organization, selected.title));
      const sourceBullets = source?.item.bullets ?? selected.bullets;
      const sourceSkills = source?.item.skills ?? [];
      const bullets = rankBullets(sourceBullets, sourceSkills, jobContext, limit);
      const score = relevance([
        selected.organization,
        selected.title,
        ...sourceSkills,
        ...bullets,
      ].join(' '), jobContext);
      return {
        organization: selected.organization,
        title: selected.title,
        bullets,
        score,
        selectedIndex,
        sourceIndex: source?.sourceIndex ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .filter((item) => item.bullets.length > 0)
    .sort((a, b) => b.score - a.score || a.selectedIndex - b.selectedIndex)
    .slice(0, 3)
    .sort((a, b) => a.sourceIndex - b.sourceIndex || a.selectedIndex - b.selectedIndex)
    .map(({ organization, title, bullets }) => ({ organization, title, bullets }));
}

function optimizedProjects(profile: CandidateProfile, jobContext: string, attempt: number) {
  const ranked = (profile.projects ?? []).map((project, index) => ({
    project,
    index,
    score: relevance([project.name, project.description, ...(project.skills ?? []), ...(project.bullets ?? [])].join(' '), jobContext),
    thesis: /msc thesis|thesis/i.test(project.name),
  })).sort((a, b) => {
    if (a.thesis !== b.thesis) return a.thesis ? -1 : 1;
    return b.score - a.score || a.index - b.index;
  });

  const maxProjects = attempt >= 2 ? 3 : 2;
  return ranked.slice(0, maxProjects).flatMap(({ project }) => {
    const bullets = rankBullets(project.bullets ?? [], project.skills ?? [], jobContext, 2);
    if (!bullets.length) return [];
    return [{ name: project.name, bullets }];
  });
}

function retunePack(job: Job, profile: CandidateProfile, pack: ApplicationPack, match: MatchScore | undefined, attempt: number): ApplicationPack {
  const jobContext = context(job, match);
  const jdSkills = supportedJobSkills(job, profile, match);
  const allowed = new Set(profile.skills.map(normalizeText));
  const skills = unique([
    ...jdSkills,
    ...pack.skills.filter((skill) => allowed.has(normalizeText(skill))),
  ]).slice(0, attempt >= 2 ? 26 : 22);

  return {
    ...pack,
    resumeHeadline: targetedHeadline(job, skills),
    resumeSummary: targetedSummary(job, profile, jdSkills),
    skills,
    // ATS retuning may improve bullet order, but it must never replace the
    // evidence shortlist with every role in the master LinkedIn history.
    experience: optimizedExperience(profile, pack, jobContext, attempt),
    projects: optimizedProjects(profile, jobContext, attempt),
  };
}

function optimizationNotes(score: AtsReadinessScore) {
  if (score.eligibleToApply) return ['ATS pass standard reached using only verified candidate evidence.'];
  if (score.hardBlockers.length) return score.hardBlockers.slice(0, 4);
  if (score.unsupportedMustHaves.length) {
    return score.unsupportedMustHaves.slice(0, 4).map((item) => `Unsupported mandatory requirement: ${item}`);
  }
  if (score.missingKeywords.length) {
    return score.missingKeywords.slice(0, 6).map((item) => `Remaining truthful gap: ${item}`);
  }
  return ['The verified evidence was fully re-ranked and retargeted, but the internal 90-point ATS threshold was not reached.'];
}

export function optimizeApplicationPackForAts(
  job: Job,
  profile: CandidateProfile,
  initialPack: ApplicationPack,
  match?: MatchScore,
): { pack: ApplicationPack; score: AtsReadinessScore } {
  const initialScore = scoreTailoredResumeWithCoursework(job, profile, initialPack, match);
  let bestPack = initialPack;
  let bestScore = initialScore;
  let attempts = 0;

  if (!bestScore.eligibleToApply) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      attempts = attempt;
      const candidate = retunePack(job, profile, bestPack, match, attempt);
      const candidateScore = scoreTailoredResumeWithCoursework(job, profile, candidate, match);
      if (candidateScore.overall >= bestScore.overall) {
        bestPack = candidate;
        bestScore = candidateScore;
      }
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
