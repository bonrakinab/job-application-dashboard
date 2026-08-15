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

const HIGH_SELECTIVITY_COMPANY_PATTERNS = [
  /\bgoogle\b/, /\balphabet\b/, /\bamazon\b/, /\baws\b/, /\bapple\b/, /\bmeta\b/, /\bfacebook\b/,
  /\bmicrosoft\b/, /\bnetflix\b/, /\bnvidia\b/, /\bopenai\b/, /\banthropic\b/, /\btesla\b/,
  /\buber\b/, /\bairbnb\b/, /\bstripe\b/, /\bdatabricks\b/, /\bsnowflake\b/, /\bsalesforce\b/,
  /\badobe\b/, /\boracle\b/, /\bibm\b/, /\bintel\b/, /\bamd\b/, /\bcisco\b/, /\bpalantir\b/,
  /\bbytedance\b/, /\btik ?tok\b/, /\bshopify\b/, /\bservice ?now\b/, /\bwalmart\b/,
  /\bunitedhealth\b/, /\boptum\b/, /\bcvs health\b/, /\bjpmorgan(?: chase)?\b/, /\bberkshire hathaway\b/,
];

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

function projectRoleFamilies(project: ProjectItem) {
  return (project as TaggedProject).roleFamilies ?? [];
}

function isAiMlProject(project: ProjectItem) {
  return projectRoleFamilies(project).includes('ai-ml');
}

export function isHighSelectivityTargetCompany(company: string) {
  const normalized = normalizeText(company);
  return HIGH_SELECTIVITY_COMPANY_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function inferProjectRoleFamilies(job: Pick<Job, 'title' | 'description' | 'department'>): ProjectRoleFamily[] {
  const title = normalizeText(`${job.title} ${job.department ?? ''}`);
  const description = normalizeText(job.description ?? '');
  const titleFamilies = new Set<ProjectRoleFamily>();
  addTitleFamilies(title, titleFamilies);

  if (titleFamilies.has('ai-ml')) {
    const dominant = new Set<ProjectRoleFamily>(['ai-ml']);
    if (titleFamilies.has('cybersecurity')) dominant.add('cybersecurity');
    return [...dominant];
  }

  const explicitErpTitle = /\b(oracle fusion|oracle erp|erp|sap|enterprise applications?|financial systems?)\b/.test(title);
  const businessSystemsTitle = /\bbusiness systems?\b/.test(title);
  if (explicitErpTitle && !businessSystemsTitle) return ['erp-enterprise'];

  if (titleFamilies.size) {
    const families = new Set<ProjectRoleFamily>(titleFamilies);
    if (businessSystemsTitle) families.add('business-analysis');
    if ((families.has('business-analysis') || families.has('it-systems'))
      && /\b(oracle|erp|sap|enterprise application)/.test(description)) {
      families.add('erp-enterprise');
    }
    return [...families];
  }

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

function evidenceStrength(project: ProjectItem) {
  const bullets = project.bullets ?? [];
  const metrics = bullets.join(' ').match(/\b\d+(?:[.,]\d+)?(?:%|\+)?\b/g)?.length ?? 0;
  return bullets.length * 2 + metrics * 3 + (project.skills?.length ?? 0) * 0.25;
}

function rankProjects(projects: ProjectItem[], job: Job, families?: Set<ProjectRoleFamily>) {
  return projects
    .map((project, index) => {
      const tagged = projectRoleFamilies(project);
      const familyHits = families?.size ? tagged.filter((family) => families.has(family)).length : 0;
      const lexical = lexicalProjectScore(project, job);
      return { project, index, familyHits, lexical, score: familyHits * 100 + lexical * 2 + evidenceStrength(project) };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);
}

function selectForHighSelectivityCompany(projects: ProjectItem[], job: Job, families: Set<ProjectRoleFamily>, limit: number) {
  const selected: ProjectItem[] = [];
  const defaultThesis = projects.find(isDefaultThesisProject);
  if (defaultThesis) selected.push(defaultThesis);

  const availableMl = projects.filter(isAiMlProject);
  const minimumMl = Math.min(2, limit, availableMl.length);
  const rankedMl = rankProjects(availableMl.filter((project) => project !== defaultThesis), job);
  for (const item of rankedMl) {
    if (selected.filter(isAiMlProject).length >= minimumMl || selected.length >= limit) break;
    if (!selected.includes(item.project)) selected.push(item.project);
  }

  if (selected.length < limit && families.size) {
    const relevant = rankProjects(projects.filter((project) => !selected.includes(project)), job, families)
      .filter((item) => item.familyHits > 0);
    for (const item of relevant) {
      if (selected.length >= limit) break;
      selected.push(item.project);
    }
  }

  if (selected.length < limit) {
    for (const item of rankProjects(projects.filter((project) => !selected.includes(project)), job)) {
      if (selected.length >= limit) break;
      if (isAiMlProject(item.project)) selected.push(item.project);
    }
  }

  return selected.slice(0, limit);
}

export function selectProjectsForJob(profile: CandidateProfile, job: Job, maxProjects = 3): ProjectItem[] {
  const limit = Math.max(0, maxProjects);
  if (!limit) return [];

  const projects = profile.projects ?? [];
  const defaultThesis = projects.find(isDefaultThesisProject);
  const families = new Set(inferProjectRoleFamilies(job));

  if (isHighSelectivityTargetCompany(job.company)) {
    return selectForHighSelectivityCompany(projects, job, families, limit);
  }

  const remainingSlots = Math.max(0, limit - (defaultThesis ? 1 : 0));
  const relevant = families.size && remainingSlots
    ? rankProjects(projects.filter((project) => project !== defaultThesis), job, families)
      .filter((item) => item.familyHits > 0)
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
