import type { CandidateProfile } from './types';
import { normalizeText } from './utils';

export type ResumeSkillGroup = { label: string; skills: string[] };

type SkillCategory = {
  label: string;
  patterns: RegExp[];
  sourceLabels?: RegExp[];
};

/**
 * Stable, readable taxonomy for employer-facing resumes.
 *
 * The application pack still decides which verified skills belong on a given
 * resume. This layer only arranges those selected skills so a front-end job,
 * ERP job, data job, etc. does not inherit whichever ad-hoc grouping happened
 * to exist in an imported profile.
 */
const SKILL_CATEGORIES: SkillCategory[] = [
  {
    label: 'Languages',
    patterns: [
      /^(python|r|sql|matlab|c|c\+\+|c#|java|javascript|typescript|php|ruby|go|golang|rust|bash|shell|powershell)$/,
    ],
    sourceLabels: [/language/, /programming/],
  },
  {
    label: 'Frontend & Full-Stack',
    patterns: [
      /\b(next\.?js|react|angular|tailwind|html|css|sass|scss|vite|framer motion|pwa|progressive web|responsive web|html5 canvas|web design)\b/,
    ],
    sourceLabels: [/front.?end/, /full.?stack/, /web/],
  },
  {
    label: 'Backend, APIs & Data',
    patterns: [
      /\b(node\.?js|express|rest api|api development|graphql|flask|fastapi|django|spring|postgres|postgresql|mysql|sqlite|mongodb|supabase|prisma|neon|database|data modeling|zod|websocket|webrtc|peerjs)\b/,
    ],
    sourceLabels: [/backend/, /api/, /database/, /data & backend/],
  },
  {
    label: 'AI & ML',
    patterns: [
      /\b(machine learning|deep learning|artificial intelligence|ai\/ml|llm|large language|bert|distilbert|tinybert|clip|hnsw|faiss|computer vision|nlp|natural language|tensorflow|pytorch|scikit|random forest|svm|adaboost|pca|smote|yolo|rag|retrieval augmented|neural network)\b/,
    ],
    sourceLabels: [/ai/, /machine learning/, /data & ai/, /applied ai/],
  },
  {
    label: 'Cloud & DevOps',
    patterns: [
      /\b(oracle cloud|oci|aws|azure|gcp|google cloud|docker|kubernetes|vercel|github actions|ci\/cd|continuous integration|devops|cloud|data flow|api gateway)\b/,
    ],
    sourceLabels: [/cloud/, /devops/],
  },
  {
    label: 'Enterprise & ERP',
    patterns: [
      /\b(oracle fusion|erp|enterprise resource|financials|accounts payable|accounts receivable|general ledger|procurement|bi publisher|visual builder|edms|arcmate|tax rules|tax engine|vat|wht|whv)\b/,
    ],
    sourceLabels: [/enterprise/, /erp/],
  },
  {
    label: 'Business Analysis & Delivery',
    patterns: [
      /\b(agile|scrum|jira|confluence|requirements gathering|requirements analysis|business analysis|process mapping|process improvement|stakeholder|project management|change management|documentation|technical documentation|workflow analysis)\b/,
    ],
    sourceLabels: [/project management/, /business analysis/, /delivery/],
  },
  {
    label: 'Security & Systems',
    patterns: [
      /\b(iso 27001|cybersecurity|security|access management|access control|risk assessment|risk management|incident management|iam|linux|windows|server|systems administration|backup)\b/,
    ],
    sourceLabels: [/security/, /cyber/, /systems?/],
  },
  {
    label: 'Tools & Platforms',
    patterns: [
      /\b(git|github|postman|jupyter|jupyterlab|streamlit|n8n|qdrant|pinecone)\b/,
    ],
    sourceLabels: [/tool/, /platform/, /additional/, /development tools/],
  },
];

function uniqueSkills(skills: string[]) {
  const seen = new Set<string>();
  return skills.filter((skill) => {
    const key = normalizeText(skill);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sourceLabelForSkill(profile: CandidateProfile, skill: string) {
  const key = normalizeText(skill);
  for (const group of profile.skillGroups ?? []) {
    if (group.skills.some((candidate) => normalizeText(candidate) === key)) return group.label;
  }
  return '';
}

function categoryFor(profile: CandidateProfile, skill: string) {
  const normalized = normalizeText(skill);
  const direct = SKILL_CATEGORIES.find((category) => category.patterns.some((pattern) => pattern.test(normalized)));
  if (direct) return direct.label;

  const sourceLabel = normalizeText(sourceLabelForSkill(profile, skill));
  const fromSource = SKILL_CATEGORIES.find((category) => category.sourceLabels?.some((pattern) => pattern.test(sourceLabel)));
  return fromSource?.label ?? 'Tools & Platforms';
}

/**
 * Arrange only the already-selected application-pack skills. The ordering of
 * skills inside each category follows the pack, which is already JD-ranked.
 * Empty categories disappear and the vague "Additional" / "Role-Aligned"
 * buckets are never exposed to employers.
 */
export function organizedResumeSkillGroups(profile: CandidateProfile, selectedSkills: string[]): ResumeSkillGroup[] {
  const groups = new Map(SKILL_CATEGORIES.map((category) => [category.label, [] as string[]]));
  for (const skill of uniqueSkills(selectedSkills)) groups.get(categoryFor(profile, skill))!.push(skill);

  return SKILL_CATEGORIES
    .map((category) => ({ label: category.label, skills: groups.get(category.label)! }))
    .filter((group) => group.skills.length > 0);
}
