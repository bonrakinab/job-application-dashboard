import type { ApplicationPack, CandidateProfile, CompanyIntelligence, Job, MatchScore, RequirementEvidence } from './types';
import { applicationPackEligibility } from './application-pack-eligibility';
import { aiGatewayRuntimeConfigured, analyzeJobWithGemini, createApplicationPackWithGemini, extractResumeProfileWithGemini } from './gemini';
import {
  analyzeJobWithAI as analyzeJobWithOpenAI,
  createApplicationPack as createApplicationPackWithOpenAI,
  researchCompanyAndHiringTeam as researchCompanyAndHiringTeamWithOpenAI,
  extractResumeProfileWithOpenAI,
} from './openai';
import { deterministicTailoringPlan, materializeApplicationPack } from './resume-tailoring';
import { deterministicScore } from './scoring';
import { calculateStartupFit } from './startup-fit';
import { employerFacingCandidateProfile } from './profile-curation';
import type { AtsLlmModelId } from './ats-models';

export type AIProvider = 'gemini' | 'openai';

export function selectedAIProvider(env: NodeJS.ProcessEnv = process.env): AIProvider {
  return env.AI_PROVIDER?.trim().toLowerCase() === 'openai' ? 'openai' : 'gemini';
}

export function aiProviderConfigured(env: NodeJS.ProcessEnv = process.env) {
  return selectedAIProvider(env) === 'gemini'
    ? Boolean(env.GEMINI_API_KEY) || aiGatewayRuntimeConfigured(env)
    : Boolean(env.OPENAI_API_KEY);
}

export function aiStatus(env: NodeJS.ProcessEnv = process.env) {
  const provider = selectedAIProvider(env);
  return {
    provider,
    configured: aiProviderConfigured(env),
    gateway: aiGatewayRuntimeConfigured(env),
    gemini: Boolean(env.GEMINI_API_KEY),
    openai: Boolean(env.OPENAI_API_KEY),
  };
}

export async function analyzeJobWithAI(job: Job, profile: CandidateProfile, selectedModel?: AtsLlmModelId): Promise<MatchScore> {
  const safeProfile = employerFacingCandidateProfile(profile);
  if (selectedModel) {
    const match = await analyzeJobWithGemini(job, safeProfile, selectedModel, true);
    return { ...match, startupFit: calculateStartupFit(job, safeProfile) };
  }
  const provider = selectedAIProvider();
  if (!aiProviderConfigured()) {
    const match = deterministicScore(job, safeProfile);
    return { ...match, startupFit: calculateStartupFit(job, safeProfile) };
  }
  const match = provider === 'gemini'
    ? analyzeJobWithGemini(job, safeProfile)
    : analyzeJobWithOpenAI(job, safeProfile);
  const resolved = await match;
  return { ...resolved, startupFit: calculateStartupFit(job, safeProfile) };
}

export function deterministicApplicationPack(job: Job, profile: CandidateProfile, match?: MatchScore): ApplicationPack {
  return materializeApplicationPack(deterministicTailoringPlan(job, profile, match), profile, job, match);
}

export async function createApplicationPack(
  job: Job,
  profile: CandidateProfile,
  match?: MatchScore,
  requirementEvidence?: RequirementEvidence[],
): Promise<{ pack: ApplicationPack; model: string; providerUsed: AIProvider; fallbackReason?: string }> {
  const eligibility = applicationPackEligibility(match);
  if (!eligibility.allowed) {
    const details = eligibility.blockers.length ? ` ${eligibility.blockers.join(' ')}` : '';
    throw new Error(`${eligibility.reason ?? 'Application-pack generation is unavailable for this job.'}${details}`);
  }

  const primary = selectedAIProvider();
  const secondary: AIProvider = primary === 'gemini' ? 'openai' : 'gemini';
  const configured = {
    gemini: Boolean(process.env.GEMINI_API_KEY) || aiGatewayRuntimeConfigured(),
    openai: Boolean(process.env.OPENAI_API_KEY),
  };
  const failures: string[] = [];

  const run = async (provider: AIProvider) => provider === 'gemini'
    ? createApplicationPackWithGemini(job, profile, match, requirementEvidence)
    : createApplicationPackWithOpenAI(job, profile, match, requirementEvidence);

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

export async function extractPartTimeResumeProfile(text: string, fileName: string, selectedModel?: AtsLlmModelId) {
  if (selectedModel) return extractResumeProfileWithGemini(text, fileName, selectedModel, true);
  if (!aiProviderConfigured()) throw new Error('Connect an AI provider before importing a résumé.');
  return selectedAIProvider() === 'gemini'
    ? extractResumeProfileWithGemini(text, fileName)
    : extractResumeProfileWithOpenAI(text, fileName);
}
