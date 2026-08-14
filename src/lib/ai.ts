import type { ApplicationPack, CandidateProfile, CompanyIntelligence, Job, MatchScore } from './types';
import { analyzeJobWithGemini, createApplicationPackWithGemini } from './gemini';
import {
  analyzeJobWithAI as analyzeJobWithOpenAI,
  createApplicationPack as createApplicationPackWithOpenAI,
  researchCompanyAndHiringTeam as researchCompanyAndHiringTeamWithOpenAI,
} from './openai';
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

export async function createApplicationPack(job: Job, profile: CandidateProfile, match?: MatchScore): Promise<{ pack: ApplicationPack; model: string }> {
  const provider = selectedAIProvider();
  if (!aiProviderConfigured()) throw new Error(`${provider === 'gemini' ? 'Gemini' : 'OpenAI'} is not configured.`);
  return provider === 'gemini'
    ? createApplicationPackWithGemini(job, profile, match)
    : createApplicationPackWithOpenAI(job, profile, match);
}

export async function researchCompanyAndHiringTeam(job: Job): Promise<{ research: CompanyIntelligence; model: string }> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI must be configured for grounded company web research.');
  }
  return researchCompanyAndHiringTeamWithOpenAI(job);
}
