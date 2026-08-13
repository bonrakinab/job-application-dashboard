import type { ApplicationPack, CandidateProfile } from './types';
import { normalizeText } from './utils';

/**
 * These are durable technical strengths the candidate wants visible across
 * employer-facing resumes, even when the current JD is outside AI/ML.
 * Values are only included when the exact skill exists in the master profile,
 * so the policy cannot invent technologies.
 */
export const PERSISTENT_APPLICATION_SKILLS = [
  'Python',
  'Machine Learning',
  'Deep Learning',
  'Computer Vision',
  'NLP',
  'BERT',
  'CLIP',
  'HNSW',
  'FAISS',
  'scikit-learn',
  'TensorFlow',
  'Multimodal Retrieval',
  'Vector Search',
] as const;

function exactProfileSkills(profile: CandidateProfile, requested: readonly string[]) {
  const available = new Map(profile.skills.map((skill) => [normalizeText(skill), skill]));
  return requested
    .map((skill) => available.get(normalizeText(skill)))
    .filter((skill): skill is string => Boolean(skill));
}

export function withPersistentApplicationSkills(
  pack: ApplicationPack,
  profile: CandidateProfile,
): ApplicationPack {
  const persistent = exactProfileSkills(profile, PERSISTENT_APPLICATION_SKILLS);
  const seen = new Set<string>();
  const skills = [...pack.skills, ...persistent].filter((skill) => {
    const normalized = normalizeText(skill);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });

  return { ...pack, skills };
}
