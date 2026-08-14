import type { ApplicationPack, CandidateProfile, CompanyIntelligence, Job, MatchScore } from './types';
import { analyzeJobWithGemini, createApplicationPackWithGemini } from './gemini';
import {
  analyzeJobWithAI as analyzeJobWithOpenAI,
  createApplicationPack as createApplicationPackWithOpenAI,
  researchCompanyAndHiringTeam as researchCompanyAndHiringTeamWithOpenAI,
} from './openai';
import { deterministicTailoringPlan, materializeApplicationPack } from './resume-tailoring';
import { deterministicScore } from './scoring';

export type AIProvider = 'gemini' | 'openai';

export function selectedAIProvider(env: NodeJS.ProcessEnv = process.env): AIProvider {
  return env.AI_PROVIDER?.trim().toLowerCase() === 'openai' ? 'openai' : 'gemini';
}

export function aiProviderConfigured(env: NodeJS.ProcessEnv = process.env) {
  return selectedAIProvider(env) === 'gemini'
    ? Boolean(env.GEMINI_API_KEY)
    : Boolean(env.OPENAI_API_KEY);
}

export function aiStatus(env: NodeJS.ProcessEnv = process.env) {
  const provider = selectedAIProvider(env);
  return {
    provider,
    configured: aiProviderConfigured(env),
    gemini: Boolean(env.GEMINI_API_KEY),
    openai: Boolean(env.OPENAI_API_KEY),
  };
}

export async function analyzeJobWithAI(job: Job, profile: CandidateProfile): Promise<MatchScore> {
  const provider = selectedAIProvider();
  if (!aiProviderConfigured()) return deterministicScore(job, profile);
  return provider === 'gemini'
    ? analyzeJobWithGemini(job, profile)
    : analyzeJobWithOpenAI(job, profile);
}

export function deterministicApplicationPack(job: Job, profile: CandidateProfile, match?: MatchScore): ApplicationPack {
  return materializeApplicationPack(deterministicTailoringPlan(job, profile, match), profile, job, match);
}

export async function createApplicationPack(
  job: Job,
  profile: CandidateProfile,
  match?: MatchScore,
): Promise<{ pack: ApplicationPack; model: string; providerUsed: AIProvider; fallbackReason?: string }> {
  if (match?.blockers.length || match?.recommendation === 'skip') {
    throw new Error('Application pack generation is disabled for blocked/skip jobs.');
  }

  const primary = selectedAIProvider();
  const secondary: AIProvider = primary === 'gemini' ? 'openai' : 'gemini';
  const configured = {
    gemini: Boolean(process.env.GEMINI_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
  };
  const failures: string[] = [];

  const run = async (provider: AIProvider) => provider === 'gemini'
    ? createApplicationPackWithGemini(job, profile, match)
    : createApplicationPackWithOpenAI(job, profile, match);

  for (const provider of [primary, secondary] as const) {
    if (!configured[provider]) continue;
    try {
      const result = await run(provider);
      return {
        ...result,
        providerUsed: provider,
        fallbackReason: failures.length ? failures.join(' | ') : undefined,
      };
    } catch (error) {
      failures.push(`${provider}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    pack: deterministicApplicationPack(job, profile, match),
    model: 'deterministic-tailoring-v1',
    providerUsed: primary,
    fallbackReason: failures.length
      ? failures.join(' | ')
      : 'No configured AI provider was available; generated from verified candidate evidence deterministically.',
  };
}

export async function researchCompanyAndHiringTeam(job: Job): Promise<{ research: CompanyIntelligence; model: string }> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI must be configured for grounded company web research.');
  }
  return researchCompanyAndHiringTeamWithOpenAI(job);
}
