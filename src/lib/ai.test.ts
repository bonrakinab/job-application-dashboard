import assert from 'node:assert/strict';
import test from 'node:test';
import { aiProviderConfigured, aiStatus, deterministicApplicationPack, selectedAIProvider } from './ai';
import {
  aiGatewayRuntimeConfigured,
  gatewayFallbackModelChain,
  geminiDirectModelChain,
  outputText as geminiOutputText,
} from './gemini';
import type { CandidateProfile, Job, MatchScore } from './types';

function env(values: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return { NODE_ENV: 'test', ...values } as NodeJS.ProcessEnv;
}

test('Gemini is the default provider', () => {
  assert.equal(selectedAIProvider(env()), 'gemini');
});

test('OpenAI is used only when explicitly selected', () => {
  assert.equal(selectedAIProvider(env({ AI_PROVIDER: 'openai' })), 'openai');
  assert.equal(selectedAIProvider(env({ AI_PROVIDER: 'OPENAI' })), 'openai');
  assert.equal(selectedAIProvider(env({ AI_PROVIDER: 'gemini' })), 'gemini');
});

test('selected provider must have its own key', () => {
  assert.equal(aiProviderConfigured(env({ OPENAI_API_KEY: 'present' })), false);
  assert.equal(aiProviderConfigured(env({ GEMINI_API_KEY: 'present' })), true);
  assert.equal(aiProviderConfigured(env({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'present' })), true);
  assert.equal(aiProviderConfigured(env({ AI_PROVIDER: 'openai', GEMINI_API_KEY: 'present' })), false);
});

test('AI status reports provider and key presence without values', () => {
  assert.deepEqual(
    aiStatus(env({ GEMINI_API_KEY: 'gemini-secret', OPENAI_API_KEY: 'openai-secret' })),
    { provider: 'gemini', configured: true, gateway: false, gemini: true, openai: true },
  );
});

test('running on Vercel alone does not imply AI Gateway authentication', () => {
  assert.equal(aiGatewayRuntimeConfigured(env({ VERCEL: '1' })), false);
  assert.equal(aiGatewayRuntimeConfigured(env({ VERCEL_OIDC_TOKEN: 'oidc-token' })), true);
  assert.equal(aiGatewayRuntimeConfigured(env({ AI_GATEWAY_API_KEY: 'gateway-key' })), true);
});

test('multi-model router uses current Gemini, Qwen, and NVIDIA fallbacks', () => {
  assert.deepEqual(geminiDirectModelChain().slice(0, 3), [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
  ]);
  const fallbacks = gatewayFallbackModelChain();
  assert.ok(fallbacks.includes('alibaba/qwen3.8-flash'));
  assert.ok(fallbacks.includes('alibaba/qwen3.8-max'));
  assert.ok(fallbacks.includes('nvidia/nemotron-3-super-120b-a12b'));
});

test('Gemini structured output concatenates split JSON text chunks', () => {
  const text = geminiOutputText({
    steps: [{
      type: 'model_output',
      content: [
        { type: 'text', text: '{"resumeSummary":"JD-tail' },
        { type: 'text', text: 'ored summary","skills":["Python"]}' },
      ],
    }],
  });
  assert.equal(text, '{"resumeSummary":"JD-tailored summary","skills":["Python"]}');
  assert.deepEqual(JSON.parse(text), { resumeSummary: 'JD-tailored summary', skills: ['Python'] });
});

test('deterministic application pack uses only verified profile evidence', () => {
  const profile: CandidateProfile = {
    name: 'Candidate',
    targetTitles: ['Software Engineer'],
    preferredLocations: ['Canada'],
    skills: ['TypeScript', 'PostgreSQL'],
    degrees: [{ institution: 'University', degree: 'Master of Science in Computer Science', end: 'Aug 2026 (Expected)' }],
    experience: [{ organization: 'Example', title: 'Developer Intern', bullets: ['Built TypeScript APIs backed by PostgreSQL.'], skills: ['TypeScript', 'PostgreSQL'] }],
    projects: [{ name: 'API Project', description: 'Typed API project', bullets: ['Built a TypeScript service with PostgreSQL.'], skills: ['TypeScript', 'PostgreSQL'] }],
  };
  const job: Job = {
    externalId: '1', source: 'test', sourceKey: 'test', url: 'https://example.com', title: 'Software Engineer', company: 'Acme', description: 'Build TypeScript services with PostgreSQL.',
  };
  const match: MatchScore = {
    overall: 80, skills: 90, experience: 70, education: 90, domain: 80, location: 100,
    recommendation: 'strong', blockers: [], strengths: ['TypeScript'], gaps: [], mustHave: ['TypeScript'], preferred: ['PostgreSQL'], matchedSkills: ['TypeScript', 'PostgreSQL'], missingSkills: [], explanation: 'fit',
  };
  const pack = deterministicApplicationPack(job, profile, match);
  assert.ok(pack.skills.includes('TypeScript'));
  assert.ok(pack.experience[0].bullets[0].includes('TypeScript'));
  assert.doesNotMatch(JSON.stringify(pack), /Java|Kubernetes|AWS/);
});
