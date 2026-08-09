import assert from 'node:assert/strict';
import test from 'node:test';
import { aiProviderConfigured, aiStatus, selectedAIProvider } from './ai';
import { outputText as geminiOutputText } from './gemini';

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
    { provider: 'gemini', configured: true, gemini: true, openai: true },
  );
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
