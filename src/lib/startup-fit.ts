import type { CandidateProfile, Job } from './types';
import { clamp, normalizeText } from './utils';

const BUILDING_SIGNALS = ['built', 'developed', 'implemented', 'designed', 'deployed', 'launched', 'created'];
const OWNERSHIP_SIGNALS = ['led', 'owned', 'end to end', 'end-to-end', 'team lead', 'stakeholder', 'initiative'];
const STARTUP_ROLE_SIGNALS = ['founding', 'first engineer', 'product engineer', 'wear many hats', 'high ownership', 'autonomy', 'fast paced', 'fast-paced', 'zero to one', '0 to 1'];
const BREADTH_SIGNALS = ['full stack', 'full-stack', 'api', 'automation', 'integration', 'frontend', 'backend', 'cloud', 'data', 'machine learning', 'ai'];

function signalCount(text: string, signals: string[]) {
  return signals.filter((signal) => text.includes(signal)).length;
}

export function isYcJob(job: Pick<Job, 'source' | 'sourceKey' | 'yc'>) {
  return job.source === 'ycombinator' || job.sourceKey === 'yc-startup-jobs' || Boolean(job.yc);
}

export function calculateStartupFit(job: Job, profile: CandidateProfile) {
  if (!isYcJob(job)) return undefined;
  const candidate = normalizeText(JSON.stringify({
    skills: profile.skills,
    experience: profile.experience,
    projects: profile.projects,
  }));
  const role = normalizeText(`${job.title} ${job.description} ${job.department ?? ''}`);
  const matchedSkills = profile.skills.filter((skill) => role.includes(normalizeText(skill))).length;
  const builder = Math.min(18, signalCount(candidate, BUILDING_SIGNALS) * 4);
  const ownership = Math.min(16, signalCount(candidate, OWNERSHIP_SIGNALS) * 4);
  const breadth = Math.min(16, signalCount(candidate, BREADTH_SIGNALS) * 2);
  const roleAlignment = Math.min(22, matchedSkills * 4);
  const startupDemand = Math.min(13, signalCount(role, STARTUP_ROLE_SIGNALS) * 3);
  const projectEvidence = Math.min(10, (profile.projects ?? []).length * 2);
  const earlyCareerAccessibility = /\b(intern|internship|new grad|junior|entry.level|engineer i)\b/.test(role) ? 5 : 0;
  return clamp(15 + builder + ownership + breadth + roleAlignment + startupDemand + projectEvidence + earlyCareerAccessibility);
}
