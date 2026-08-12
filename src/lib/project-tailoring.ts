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
    /\bmachine learning\b/, /\bml engineer/, /\bai engineer/, /\bartificial intelligence\b/,
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
  'systems-algorithms': ['c++', ' c ', 'operating system', 'file system', 'parallel', 'assembly', 'microprocessor', 'algorithm', 'kmp'],
  'business-analysis': ['requirements', 'stakeholder', 'business process', 'process improvement', 'implementation', 'functional requirements', 'workflow'],
};

function addTitleFamilies(text: string, families: Set<ProjectRoleFamily>) {
  for (const [family, patterns] of TITLE_SIGNALS) {
    if (patterns.some((pattern) => pattern.test(text))) families.add(family);
  }
}

function addDescriptionFamilies(text: string, families: Set<ProjectRoleFamily>) {
  for (const [family, signals] of Object.entries(DESCRIPTION_SIGNALS) as Array<[ProjectRoleFamily, string[]]>) {
    const hits = signals.filter((signal) => text.includes(signal)).length;
    if (hits >= 2) families.add(family);
  }
}

export function inferProjectRoleFamilies(job: Pick<Job, 'title' | 'description' | 'department'>): ProjectRoleFamily[] {
  const title = normalizeText(`${job.title} ${job.department ?? ''}`);
  const description = normalizeText(job.description ?? '');
  const families = new Set<ProjectRoleFamily>();
  addTitleFamilies(title, families);

  // Description signals can add a secondary family (for example an Oracle-focused
  // Business Analyst or an ML-heavy Software Engineer), but require multiple clues
  // so generic JD boilerplate does not make every project eligible.
  addDescriptionFamilies(description, families);

  if (families.has('erp-enterprise')) families.add('business-analysis');
  if (families.has('business-analysis') && /\b(oracle|erp|sap|enterprise application)/.test(description)) families.add('erp-enterprise');
  if (families.has('cloud-devops') && /\b(api|software|typescript|python|java|react|backend)/.test(description)) families.add('software');
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
      const tagged = project as TaggedProject;
      const projectFamilies = tagged.roleFamilies ?? [];
      const familyHits = projectFamilies.filter((family) => families.has(family)).length;
      const lexical = lexicalProjectScore(project, job);
      return { project, index, familyHits, lexical, score: familyHits * 100 + lexical };
    })
    // Explicit family metadata is the primary guard. A legacy project without tags
    // can still qualify only when it has unusually strong direct JD overlap.
    .filter((item) => item.familyHits > 0 || (item.lexical >= 24 && !(item.project as TaggedProject).roleFamilies?.length))
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
