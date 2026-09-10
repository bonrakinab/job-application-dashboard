import type { CandidateProfile } from './types';
import { normalizeText } from './utils';

export type ResumeSkillGroup = { label: string; skills: string[] };

type SkillCategory = {
  label: string;
  patterns: RegExp[];
  sourceLabels?: RegExp[];
};

/**
 * Employer-facing skills use the same five stable groups as Arnob's canonical
 * LaTeX resume. The application pack still decides which verified/JD-ranked
 * skills are selected; this layer only places them into a predictable visual
 * taxonomy so a resume never degenerates into sparse or ad-hoc buckets.
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
    label: 'Full-Stack & APIs',
    patterns: [
      /\b(next\.?js|react|angular|tailwind|html|css|sass|scss|vite|framer motion|pwa|progressive web|responsive web|html5 canvas|web design|node\.?js|express|rest api|api development|graphql|flask|fastapi|django|spring|auth\.?js|zod|capacitor|websocket|webrtc|peerjs)\b/,
    ],
    sourceLabels: [/front.?end/, /full.?stack/, /web/, /api/],
  },
  {
    label: 'Data & Backend',
    patterns: [
      /\b(postgres|postgresql|mysql|sqlite|mongodb|supabase|prisma|neon|database|data modeling|row-level security|rls|edge function|pg[_ ]?cron|qdrant|pinecone)\b/,
    ],
    sourceLabels: [/backend/, /database/, /data & backend/],
  },
  {
    label: 'Applied AI & ML',
    patterns: [
      /\b(machine learning|deep learning|artificial intelligence|ai\/ml|llm|large language|gemini|openai|bert|distilbert|tinybert|clip|hnsw|faiss|computer vision|nlp|natural language|tensorflow|pytorch|scikit|random forest|svm|adaboost|pca|smote|yolo|rag|retrieval augmented|neural network)\b/,
    ],
    sourceLabels: [/ai/, /machine learning/, /data & ai/, /applied ai/],
  },
  {
    label: 'Cloud, DevOps & Enterprise',
    patterns: [
      /\b(oracle cloud|oci|aws|azure|gcp|google cloud|docker|kubernetes|vercel|github actions|ci\/cd|continuous integration|devops|cloud|data flow|api gateway|oracle fusion|erp|enterprise resource|financials|accounts payable|accounts receivable|general ledger|procurement|bi publisher|visual builder|edms|arcmate|tax rules|tax engine|vat|wht|whv|agile|scrum|jira|confluence|requirements gathering|requirements analysis|business analysis|process mapping|process improvement|stakeholder|project management|change management|documentation|technical documentation|workflow analysis|iso 27001|cybersecurity|security|access management|access control|risk assessment|risk management|incident management|iam|linux|windows|server|systems administration|backup|git|github|postman|jupyter|jupyterlab|streamlit|n8n)\b/,
    ],
    sourceLabels: [/cloud/, /devops/, /enterprise/, /erp/, /project management/, /business analysis/, /delivery/, /security/, /cyber/, /systems?/, /tool/, /platform/, /additional/, /development tools/],
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
  return fromSource?.label ?? 'Cloud, DevOps & Enterprise';
}

/**
 * Arrange only the already-selected application-pack skills. Skills retain
 * their JD-ranked order inside a group. Empty groups disappear, but the label
 * set itself is fixed to the canonical template and there is never an
 * "Additional" or "Role-Aligned" catch-all section.
 */
export function organizedResumeSkillGroups(profile: CandidateProfile, selectedSkills: string[]): ResumeSkillGroup[] {
  const groups = new Map(SKILL_CATEGORIES.map((category) => [category.label, [] as string[]]));
  for (const skill of uniqueSkills(selectedSkills)) groups.get(categoryFor(profile, skill))!.push(skill);

  return SKILL_CATEGORIES
    .map((category) => ({ label: category.label, skills: groups.get(category.label)! }))
    .filter((group) => group.skills.length > 0);
}
