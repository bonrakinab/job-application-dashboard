import assert from 'node:assert/strict';
import test from 'node:test';
import { aiProviderConfigured, aiStatus, selectedAIProvider } from './ai';

function env(values: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return { ...values };
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
    { provider: 'gemini', configured: true, gemini: true, openai: true },
  );
});
