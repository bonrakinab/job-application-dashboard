import assert from 'node:assert/strict';
import test from 'node:test';
import { ATS_LLM_MODELS, DEFAULT_ATS_LLM_MODEL, atsLlmModelName, isAtsLlmModelId } from './ats-models';

test('ATS model allowlist includes Gemini, Qwen, and Nemotron choices', () => {
  assert.ok(ATS_LLM_MODELS.some((model) => model.id.startsWith('google/gemini-')));
  assert.ok(ATS_LLM_MODELS.some((model) => model.id.startsWith('alibaba/qwen')));
  assert.ok(ATS_LLM_MODELS.some((model) => model.id.startsWith('nvidia/nemotron-')));
});

test('ATS model selection validates exact supported IDs', () => {
  assert.equal(isAtsLlmModelId(DEFAULT_ATS_LLM_MODEL), true);
  assert.equal(isAtsLlmModelId('random/default-model'), false);
  assert.equal(atsLlmModelName('alibaba/qwen3.8-flash'), 'Qwen 3.8 Flash');
});

