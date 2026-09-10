import type { CandidateProfile } from './types';
import { normalizeText } from './utils';

export type ResumeSkillGroup = { label: string; skills: string[] };

type SkillCategory = {
  label: string;
  patterns: RegExp[];
  sourceLabels?: RegExp[];
};

/**
 * Canonical employer-facing taxonomy from Arnob's uploaded LaTeX resume.
 * The application pack decides which verified/JD-ranked skills are selected;
 * this layer only places those selected skills into the same stable buckets
 * and order as the reference template.
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
    label: 'Enterprise & ERP',
    patterns: [
      /\b(oracle fusion|erp|enterprise resource|financials|accounts payable|accounts receivable|general ledger|procurement|tax rules|tax engine|vat|wht|whv|edms|arcmate)\b/,
      /^(ap|ar|gl)$/,
    ],
    sourceLabels: [/enterprise/, /erp/],
  },
  {
    label: 'Project Management',
    patterns: [
      /\b(agile|scrum|jira|confluence|project management|change management|delivery management|task coordination)\b/,
    ],
    sourceLabels: [/project management/, /delivery/],
  },
  {
    label: 'Cloud',
    patterns: [
      /\b(oracle cloud|oci|aws|azure|gcp|google cloud|compute|storage|iam|api gateway|data flow|cloud infrastructure|vercel|docker|kubernetes|devops|ci\/cd|continuous integration|github actions)\b/,
    ],
    sourceLabels: [/^cloud$/, /cloud infrastructure/, /devops/],
  },
  {
    label: 'Development Tools & API Platforms',
    patterns: [
      /\b(next\.?js|react|angular|tailwind|html|css|sass|scss|vite|framer motion|pwa|progressive web|responsive web|html5 canvas|web design|node\.?js|express|rest api|api development|graphql|flask|fastapi|django|spring|auth\.?js|zod|capacitor|websocket|webrtc|peerjs|visual builder|bi publisher|postman|git|github|jupyter|jupyterlab|streamlit|n8n)\b/,
    ],
    sourceLabels: [/front.?end/, /full.?stack/, /web/, /api/, /development tools/, /platform/, /tool/],
  },
  {
    label: 'Data & AI',
    patterns: [
      /\b(machine learning|deep learning|artificial intelligence|ai\/ml|llm|large language|gemini|openai|bert|distilbert|tinybert|clip|hnsw|faiss|computer vision|nlp|natural language|tensorflow|pytorch|scikit|random forest|svm|adaboost|pca|smote|yolo|rag|retrieval augmented|neural network|postgres|postgresql|mysql|sqlite|mongodb|supabase|prisma|neon|database|data modeling|row-level security|rls|qdrant|pinecone)\b/,
    ],
    sourceLabels: [/data/, /ai/, /machine learning/, /database/, /backend/],
  },
  {
    label: 'Business Analysis',
    patterns: [
      /\b(requirements gathering|requirements analysis|business analysis|process mapping|process improvement|stakeholder management|stakeholder|documentation|technical documentation|workflow analysis|workflow|business process)\b/,
    ],
    sourceLabels: [/business analysis/, /requirements/],
  },
  {
    label: 'Cybersecurity',
    patterns: [
      /\b(iso 27001|cybersecurity|security|access management|access control|risk assessment|risk management|incident management|linux|windows|server|systems administration|backup)\b/,
    ],
    sourceLabels: [/security/, /cyber/, /systems?/],
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
  return fromSource?.label ?? 'Development Tools & API Platforms';
}

/**
 * Arrange only already-selected application-pack skills. Skills retain their
 * JD-ranked order inside each bucket. Empty buckets disappear, while the
 * visible labels and bucket ordering stay identical to the reference resume.
 */
export function organizedResumeSkillGroups(profile: CandidateProfile, selectedSkills: string[]): ResumeSkillGroup[] {
  const groups = new Map(SKILL_CATEGORIES.map((category) => [category.label, [] as string[]]));
  for (const skill of uniqueSkills(selectedSkills)) groups.get(categoryFor(profile, skill))!.push(skill);

  return SKILL_CATEGORIES
    .map((category) => ({ label: category.label, skills: groups.get(category.label)! }))
    .filter((group) => group.skills.length > 0);
}
