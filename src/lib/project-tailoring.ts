import type { CandidateProfile, Job, ProjectItem } from './types';
import { normalizeText } from './utils';

export type ProjectRoleFamily =
  | 'ai-ml'
  | 'data-analytics'
  | 'software'
  | 'erp-enterprise'
  | 'it-systems'
  | 'cloud-devops'
  | 'cybersecurity'
  | 'systems-algorithms'
  | 'business-analysis';

type TaggedProject = ProjectItem & {
  roleFamilies?: ProjectRoleFamily[];
};

const TITLE_SIGNALS: Array<[ProjectRoleFamily, RegExp[]]> = [
  ['ai-ml', [
    /\bmachine learning\b/, /\bml engineer/, /\bml(?:\s+\w+){0,2}\s+engineer\b/,
    /\bai engineer/, /\bai(?:\s+\w+){0,2}\s+engineer\b/, /\bartificial intelligence\b/,
    /\bdata scientist\b/, /\bcomputer vision\b/, /\bnlp\b/, /\bllm/, /\bgenerative ai\b/, /\bgenai\b/,
  ]],
  ['data-analytics', [
    /\bdata analyst\b/, /\bdata analytics\b/, /\banalytics engineer\b/, /\bdata engineer\b/,
    /\bbusiness intelligence\b/, /\bbi analyst\b/, /\breporting analyst\b/, /\bpower bi\b/, /\btableau\b/,
  ]],
  ['software', [
    /\bsoftware engineer/, /\bsoftware developer/, /\bapplication developer/, /\bfull[- ]?stack\b/,
    /\bbackend\b/, /\bfront[- ]?end\b/, /\bfrontend\b/, /\bweb developer\b/, /\bmobile developer\b/,
  ]],
  ['erp-enterprise', [
    /\berp\b/, /\boracle fusion\b/, /\boracle erp\b/, /\bsap\b/, /\benterprise applications?\b/,
    /\bbusiness systems?\b/, /\bfinancial systems?\b/,
  ]],
  ['it-systems', [
    /\bit analyst\b/, /\bit systems?\b/, /\bsystems analyst\b/, /\bapplication support\b/,
    /\btechnical support\b/, /\binfrastructure\b/, /\bsystems? administrator\b/, /\bhelp desk\b/,
  ]],
  ['cloud-devops', [
    /\bcloud engineer\b/, /\bcloud analyst\b/, /\bdevops\b/, /\bsite reliability\b/, /\bsre\b/,
    /\bplatform engineer\b/, /\bsolutions? engineer\b/, /\bcloud intern\b/,
  ]],
  ['cybersecurity', [
    /\bcybersecurity\b/, /\bcyber security\b/, /\bsecurity engineer\b/, /\bsecurity analyst\b/,
    /\bsoc analyst\b/, /\binformation security\b/, /\biam\b/, /\bphishing\b/,
  ]],
  ['systems-algorithms', [
    /\bsystems programmer\b/, /\bembedded\b/, /\boperating systems?\b/, /\bparallel computing\b/,
    /\bassembly\b/, /\bmicroprocessor\b/, /\balgorithm/, /\bc\+\+\b/,
  ]],
  ['business-analysis', [
    /\bbusiness analyst\b/, /\btechnical consultant\b/, /\bimplementation consultant\b/,
    /\bfunctional analyst\b/, /\bsolutions? consultant\b/, /\bprocess analyst\b/,
  ]],
];

const DESCRIPTION_SIGNALS: Record<ProjectRoleFamily, string[]> = {
  'ai-ml': ['machine learning', 'deep learning', 'artificial intelligence', 'computer vision', 'nlp', 'bert', 'llm', 'pytorch', 'tensorflow', 'scikit-learn'],
  'data-analytics': ['data analysis', 'analytics', 'sql', 'power bi', 'tableau', 'pandas', 'reporting', 'visualization', 'business intelligence'],
  software: ['software development', 'react', 'next.js', 'typescript', 'javascript', 'java', 'python', 'api', 'full stack', 'backend', 'frontend'],
  'erp-enterprise': ['oracle fusion', 'oracle erp', 'erp', 'sap', 'procurement', 'financials', 'accounts payable', 'accounts receivable', 'enterprise applications'],
  'it-systems': ['application support', 'infrastructure', 'windows server', 'linux', 'iis', 'edms', 'system administration', 'technical support'],
  'cloud-devops': ['aws', 'azure', 'oci', 'cloud', 'devops', 'kubernetes', 'docker', 'terraform', 'ci/cd', 'vercel', 'serverless'],
  cybersecurity: ['cybersecurity', 'security', 'phishing', 'iam', 'soc', 'threat', 'vulnerability'],
  'systems-algorithms': ['c++', 'operating system', 'file system', 'parallel', 'assembly', 'microprocessor', 'algorithm', 'kmp'],
  'business-analysis': ['requirements', 'stakeholder', 'business process', 'process improvement', 'implementation', 'functional requirements', 'workflow'],
};

function addTitleFamilies(text: string, families: Set<ProjectRoleFamily>) {
  for (const [family, patterns] of TITLE_SIGNALS) {
    if (patterns.some((pattern) => pattern.test(text))) families.add(family);
  }
}

function descriptionHits(text: string, family: ProjectRoleFamily) {
  return DESCRIPTION_SIGNALS[family].filter((signal) => text.includes(signal)).length;
}

function addStrongDescriptionFamily(text: string, families: Set<ProjectRoleFamily>, family: ProjectRoleFamily, minHits = 3) {
  if (descriptionHits(text, family) >= minHits) families.add(family);
}

export function inferProjectRoleFamilies(job: Pick<Job, 'title' | 'description' | 'department'>): ProjectRoleFamily[] {
  const title = normalizeText(`${job.title} ${job.department ?? ''}`);
  const description = normalizeText(job.description ?? '');
  const titleFamilies = new Set<ProjectRoleFamily>();
  addTitleFamilies(title, titleFamilies);

  // Title family is the primary guard. This prevents a Machine Learning Engineer
  // JD from admitting generic software projects merely because it also mentions
  // Python, APIs, or software-development practices.
  const families = new Set<ProjectRoleFamily>(titleFamilies);

  if (!titleFamilies.size) {
    for (const family of Object.keys(DESCRIPTION_SIGNALS) as ProjectRoleFamily[]) {
      if (descriptionHits(description, family) >= 3) families.add(family);
    }
  } else {
    if (titleFamilies.has('erp-enterprise')) families.add('business-analysis');
    if (titleFamilies.has('business-analysis') && /\b(oracle|erp|sap|enterprise application)/.test(description)) families.add('erp-enterprise');
    if (titleFamilies.has('it-systems') && /\b(oracle|erp|sap|enterprise application)/.test(description)) families.add('erp-enterprise');

    // General software/cloud/security roles can legitimately specialize in an
    // adjacent technical domain, but require strong repeated evidence from the JD.
    if (titleFamilies.has('software')) {
      addStrongDescriptionFamily(description, families, 'ai-ml');
      addStrongDescriptionFamily(description, families, 'data-analytics');
      addStrongDescriptionFamily(description, families, 'cloud-devops');
      addStrongDescriptionFamily(description, families, 'cybersecurity');
    }
    if (titleFamilies.has('cloud-devops')) {
      addStrongDescriptionFamily(description, families, 'software');
      addStrongDescriptionFamily(description, families, 'cybersecurity');
    }
    if (titleFamilies.has('cybersecurity')) addStrongDescriptionFamily(description, families, 'ai-ml');
    if (titleFamilies.has('data-analytics')) addStrongDescriptionFamily(description, families, 'ai-ml');
  }

  return [...families];
}

function tokenSet(value: string) {
  return new Set(normalizeText(value).split(/\s+/).filter((token) => token.length >= 3));
}

function lexicalProjectScore(project: ProjectItem, job: Job) {
  const jobText = normalizeText(`${job.title} ${job.department ?? ''} ${job.description}`);
  const projectText = [project.name, project.description, ...(project.skills ?? []), ...(project.bullets ?? [])].join(' ');
  const tokens = tokenSet(projectText);
  let score = 0;
  for (const token of tokens) {
    if (jobText.includes(token)) score += token.length >= 7 ? 2 : 1;
  }
  for (const skill of project.skills ?? []) {
    const normalizedSkill = normalizeText(skill);
    if (normalizedSkill.length >= 2 && jobText.includes(normalizedSkill)) score += 8;
  }
  return score;
}

export function selectProjectsForJob(profile: CandidateProfile, job: Job, maxProjects = 3): ProjectItem[] {
  const families = new Set(inferProjectRoleFamilies(job));
  if (!families.size) return [];

  return (profile.projects ?? [])
    .map((project, index) => {
      const projectFamilies = (project as TaggedProject).roleFamilies ?? [];
      const familyHits = projectFamilies.filter((family) => families.has(family)).length;
      const lexical = lexicalProjectScore(project, job);
      return { project, index, familyHits, lexical, score: familyHits * 100 + lexical };
    })
    // The production master profile is explicitly tagged. Untagged projects are
    // excluded instead of being used as resume padding based on accidental words.
    .filter((item) => item.familyHits > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(0, maxProjects))
    .map((item) => item.project);
}

export function projectTailoredApplicationProfile(profile: CandidateProfile, job: Job): CandidateProfile {
  return {
    ...profile,
    projects: selectProjectsForJob(profile, job, 3),
  };
}
