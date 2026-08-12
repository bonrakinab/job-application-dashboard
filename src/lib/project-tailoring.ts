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

const DEFAULT_THESIS_PROJECT = 'MSc Thesis - Color-Aware Composed Image Retrieval';

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

function isDefaultThesisProject(project: ProjectItem) {
  const name = normalizeText(project.name);
  const canonical = normalizeText(DEFAULT_THESIS_PROJECT);
  return name === canonical
    || name.includes('color-aware composed image retrieval')
    || name.includes('color aware composed image retrieval');
}

export function inferProjectRoleFamilies(job: Pick<Job, 'title' | 'description' | 'department'>): ProjectRoleFamily[] {
  const title = normalizeText(`${job.title} ${job.department ?? ''}`);
  const description = normalizeText(job.description ?? '');
  const titleFamilies = new Set<ProjectRoleFamily>();
  addTitleFamilies(title, titleFamilies);

  // Explicit AI/ML titles are dominant even when words such as platform,
  // software, APIs, or cloud also appear in the posting.
  if (titleFamilies.has('ai-ml')) {
    const dominant = new Set<ProjectRoleFamily>(['ai-ml']);
    if (titleFamilies.has('cybersecurity')) dominant.add('cybersecurity');
    return [...dominant];
  }

  const explicitErpTitle = /\b(oracle fusion|oracle erp|erp|sap|enterprise applications?|financial systems?)\b/.test(title);
  const businessSystemsTitle = /\bbusiness systems?\b/.test(title);
  if (explicitErpTitle && !businessSystemsTitle) return ['erp-enterprise'];

  // When the title already identifies a role family, keep that family strict.
  // Only business/IT roles may add ERP because enterprise-system context changes
  // the actual work domain rather than merely sharing generic technologies.
  if (titleFamilies.size) {
    const families = new Set<ProjectRoleFamily>(titleFamilies);
    if (businessSystemsTitle) families.add('business-analysis');
    if ((families.has('business-analysis') || families.has('it-systems'))
      && /\b(oracle|erp|sap|enterprise application)/.test(description)) {
      families.add('erp-enterprise');
    }
    return [...families];
  }

  // Ambiguous titles can fall back to the JD body, but only with several signals.
  const inferred = new Set<ProjectRoleFamily>();
  for (const family of Object.keys(DESCRIPTION_SIGNALS) as ProjectRoleFamily[]) {
    if (descriptionHits(description, family) >= 3) inferred.add(family);
  }
  return [...inferred];
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
  const limit = Math.max(0, maxProjects);
  if (!limit) return [];

  const projects = profile.projects ?? [];
  const defaultThesis = projects.find(isDefaultThesisProject);
  const families = new Set(inferProjectRoleFamilies(job));
  const remainingSlots = Math.max(0, limit - (defaultThesis ? 1 : 0));

  const relevant = families.size && remainingSlots
    ? projects
      .filter((project) => project !== defaultThesis)
      .map((project, index) => {
        const projectFamilies = (project as TaggedProject).roleFamilies ?? [];
        const familyHits = projectFamilies.filter((family) => families.has(family)).length;
        const lexical = lexicalProjectScore(project, job);
        return { project, index, familyHits, lexical, score: familyHits * 100 + lexical };
      })
      .filter((item) => item.familyHits > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, remainingSlots)
      .map((item) => item.project)
    : [];

  return defaultThesis ? [defaultThesis, ...relevant] : relevant;
}

function mergeSelectedProjectSkills(profile: CandidateProfile, projects: ProjectItem[]) {
  const skills = [...profile.skills];
  const seen = new Set(skills.map(normalizeText));
  for (const project of projects) {
    for (const skill of project.skills ?? []) {
      const normalized = normalizeText(skill);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      skills.push(skill);
    }
  }
  return skills;
}

export function projectTailoredApplicationProfile(profile: CandidateProfile, job: Job): CandidateProfile {
  const projects = selectProjectsForJob(profile, job, 3);
  return {
    ...profile,
    skills: mergeSelectedProjectSkills(profile, projects),
    projects,
  };
}
