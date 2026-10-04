export const ATS_LLM_MODELS = [
  {
    id: 'google/gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    provider: 'Google',
    description: 'Balanced speed and quality for a complete ATS review.',
  },
  {
    id: 'google/gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro Preview',
    provider: 'Google',
    description: 'Deeper analysis for nuanced roles and longer résumés.',
  },
  {
    id: 'alibaba/qwen3.8-flash',
    name: 'Qwen 3.8 Flash',
    provider: 'Alibaba',
    description: 'Fast, economical scoring with structured output.',
  },
  {
    id: 'alibaba/qwen3.8-max-prime',
    name: 'Qwen 3.8 Max Prime',
    provider: 'Alibaba',
    description: 'Higher-capability Qwen model for detailed evidence matching.',
  },
  {
    id: 'nvidia/nemotron-3-super-120b-a12b',
    name: 'Nemotron 3 Super',
    provider: 'NVIDIA',
    description: 'Strong reasoning model for requirements and gap analysis.',
  },
  {
    id: 'nvidia/nemotron-3-ultra-550b-a55b',
    name: 'Nemotron 3 Ultra',
    provider: 'NVIDIA',
    description: 'Largest Nemotron option for the most thorough comparison.',
  },
] as const;

export type AtsLlmModelId = (typeof ATS_LLM_MODELS)[number]['id'];

export const DEFAULT_ATS_LLM_MODEL: AtsLlmModelId = 'google/gemini-3.8-flash';

export function isAtsLlmModelId(value: string): value is AtsLlmModelId {
  return ATS_LLM_MODELS.some((model) => model.id === value);
}

export function atsLlmModelName(value: string) {
  return ATS_LLM_MODELS.find((model) => model.id === value)?.name ?? value;
}

