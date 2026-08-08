import { discoverJobs } from '@/connectors/registry';
import { analyzeJobWithAI } from './ai';
import { deterministicScore, locationMatchesPreference, titleMatchesTarget } from './scoring';
import { getCandidateProfile, listUnanalyzedJobs, logActivity, saveDiscoveredJobs, saveMatch } from './store';
import type { CandidateProfile, Job } from './types';
import { daysSince } from './utils';

function relevant(job: Job, profile: CandidateProfile) {
  const titleHit = titleMatchesTarget(job.title, profile.targetTitles);
  const locationHit = locationMatchesPreference(job, profile);
  const maxAge = Number(process.env.DISCOVERY_MAX_AGE_DAYS || 14);
  const fresh = !job.postedAt || daysSince(job.postedAt) <= maxAge;
  return titleHit && locationHit && fresh;
}

async function analyzeOne(job: Job, profile: CandidateProfile) {
  if (!job.id) return null;
  const pre = deterministicScore(job, profile);
  const match = pre.blockers.length ? pre : await analyzeJobWithAI(job, profile);
  await saveMatch(job.id, match);
  return { id: job.id, score: match.overall, recommendation: match.recommendation };
}

export async function runDiscoveryAndAnalysis() {
  const profile = await getCandidateProfile();
  const discovery = await discoverJobs();
  const relevantJobs = discovery.jobs.filter((job) => relevant(job, profile));
  await saveDiscoveredJobs(relevantJobs);
  await logActivity('discovery.completed', undefined, { fetched: discovery.jobs.length, relevant: relevantJobs.length, errors: discovery.errors });

  const maxAnalyses = Math.max(1, Math.min(40, Number(process.env.MAX_ANALYSES_PER_RUN || 12)));
  const concurrency = Math.max(1, Math.min(5, Number(process.env.ANALYSIS_CONCURRENCY || 3)));
  const pending = (await listUnanalyzedJobs(maxAnalyses)).slice(0, maxAnalyses);
  const analyzed: Array<{ id: string; score: number; recommendation: string }> = [];

  for (let index = 0; index < pending.length; index += concurrency) {
    const batch = pending.slice(index, index + concurrency);
    const results = await Promise.all(batch.map((job) => analyzeOne(job, profile)));
    analyzed.push(...results.filter((result): result is NonNullable<typeof result> => Boolean(result)));
  }

  await logActivity('analysis.completed', undefined, { analyzed: analyzed.length });
  return { fetched: discovery.jobs.length, relevant: relevantJobs.length, sources: discovery.sources, errors: discovery.errors, analyzed };
}
