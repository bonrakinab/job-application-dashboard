import type { CandidateProfile, JobWithMatch } from './types';
import { roleFamily } from './recommendations';
import { normalizeText } from './utils';

interface SkillDefinition {
  name: string;
  aliases: string[];
}

const MARKET_SKILLS: SkillDefinition[] = [
  { name: 'Python', aliases: ['python'] },
  { name: 'SQL', aliases: ['sql'] },
  { name: 'Java', aliases: ['java'] },
  { name: 'JavaScript', aliases: ['javascript'] },
  { name: 'TypeScript', aliases: ['typescript'] },
  { name: 'React', aliases: ['react', 'react.js', 'reactjs'] },
  { name: 'Next.js', aliases: ['next.js', 'nextjs'] },
  { name: 'Node.js', aliases: ['node.js', 'nodejs'] },
  { name: 'REST APIs', aliases: ['rest api', 'restful api', 'rest apis'] },
  { name: 'API Integration', aliases: ['api integration', 'integrations', 'third party api'] },
  { name: 'Webhooks', aliases: ['webhook', 'webhooks'] },
  { name: 'n8n', aliases: ['n8n'] },
  { name: 'Workflow Automation', aliases: ['workflow automation', 'process automation', 'automation workflow'] },
  { name: 'PostgreSQL', aliases: ['postgresql', 'postgres'] },
  { name: 'MySQL', aliases: ['mysql'] },
  { name: 'Supabase', aliases: ['supabase'] },
  { name: 'Docker', aliases: ['docker', 'containerization', 'containers'] },
  { name: 'Kubernetes', aliases: ['kubernetes', 'k8s'] },
  { name: 'AWS', aliases: ['aws', 'amazon web services'] },
  { name: 'Azure', aliases: ['azure', 'microsoft azure'] },
  { name: 'GCP', aliases: ['gcp', 'google cloud platform', 'google cloud'] },
  { name: 'Terraform', aliases: ['terraform', 'infrastructure as code'] },
  { name: 'Linux', aliases: ['linux'] },
  { name: 'PowerShell', aliases: ['powershell'] },
  { name: 'Bash', aliases: ['bash', 'shell scripting'] },
  { name: 'Git', aliases: ['git', 'github', 'gitlab'] },
  { name: 'CI/CD', aliases: ['ci/cd', 'continuous integration', 'continuous deployment'] },
  { name: 'Jira', aliases: ['jira'] },
  { name: 'Agile', aliases: ['agile', 'scrum'] },
  { name: 'ITIL', aliases: ['itil'] },
  { name: 'ServiceNow', aliases: ['servicenow'] },
  { name: 'Power BI', aliases: ['power bi', 'powerbi'] },
  { name: 'Tableau', aliases: ['tableau'] },
  { name: 'Excel', aliases: ['excel', 'microsoft excel'] },
  { name: 'Snowflake', aliases: ['snowflake'] },
  { name: 'Databricks', aliases: ['databricks'] },
  { name: 'Spark', aliases: ['apache spark', 'pyspark'] },
  { name: 'Pandas', aliases: ['pandas'] },
  { name: 'scikit-learn', aliases: ['scikit-learn', 'sklearn'] },
  { name: 'TensorFlow', aliases: ['tensorflow'] },
  { name: 'PyTorch', aliases: ['pytorch'] },
  { name: 'Machine Learning', aliases: ['machine learning'] },
  { name: 'Deep Learning', aliases: ['deep learning'] },
  { name: 'NLP', aliases: ['natural language processing', 'nlp'] },
  { name: 'Computer Vision', aliases: ['computer vision'] },
  { name: 'LLMs', aliases: ['large language model', 'large language models', 'llm', 'llms'] },
  { name: 'RAG', aliases: ['retrieval augmented generation', 'rag'] },
  { name: 'Vector Search', aliases: ['vector search', 'vector database', 'vector db'] },
  { name: 'Oracle Fusion', aliases: ['oracle fusion', 'fusion cloud'] },
  { name: 'Oracle ERP', aliases: ['oracle erp', 'oracle cloud erp'] },
  { name: 'Oracle Financials', aliases: ['oracle financials', 'oracle fusion financials', 'financials cloud'] },
  { name: 'Oracle Procurement', aliases: ['oracle procurement', 'oracle fusion procurement', 'procurement cloud'] },
  { name: 'ERP', aliases: ['enterprise resource planning', ' erp '] },
  { name: 'Business Analysis', aliases: ['business analysis', 'business analyst'] },
];

function textContainsAlias(text: string, alias: string) {
  const normalizedAlias = normalizeText(alias);
  if (!normalizedAlias) return false;
  if (normalizedAlias.length <= 3) return new RegExp(`(^|\\s)${normalizedAlias.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}(\\s|$)`).test(` ${text} `);
  return text.includes(normalizedAlias);
}

function profileHasSkill(profile: CandidateProfile, definition: SkillDefinition) {
  const evidence = [
    ...profile.skills,
    ...(profile.skillGroups ?? []).flatMap((group) => group.skills),
    ...(profile.experience ?? []).flatMap((item) => item.skills ?? []),
    ...(profile.projects ?? []).flatMap((item) => item.skills ?? []),
  ].map(normalizeText);
  return evidence.some((skill) => definition.aliases.some((alias) => {
    const normalizedAlias = normalizeText(alias);
    return skill === normalizedAlias || skill.includes(normalizedAlias) || normalizedAlias.includes(skill);
  }));
}

export interface SkillDemandRow {
  skill: string;
  count: number;
  percentage: number;
  owned: boolean;
  gapOpportunity: number;
}

export interface MarketInsights {
  analyzedJobs: number;
  skills: SkillDemandRow[];
  gaps: SkillDemandRow[];
  roleFamilies: Array<{ family: string; count: number; percentage: number }>;
  erpJobs: number;
  erpStrongMatches: number;
}

export function buildMarketInsights(jobs: JobWithMatch[], profile: CandidateProfile): MarketInsights {
  const eligible = jobs.filter((job) => !['closed', 'likely_closed'].includes(job.validityStatus ?? 'unknown'));
  const counts = new Map<string, number>();
  for (const job of eligible) {
    const text = normalizeText(`${job.title} ${job.description}`);
    for (const definition of MARKET_SKILLS) {
      if (definition.aliases.some((alias) => textContainsAlias(text, alias))) counts.set(definition.name, (counts.get(definition.name) ?? 0) + 1);
    }
  }

  const total = eligible.length || 1;
  const skills = MARKET_SKILLS
    .map((definition) => {
      const count = counts.get(definition.name) ?? 0;
      const owned = profileHasSkill(profile, definition);
      const percentage = Math.round((count / total) * 100);
      return { skill: definition.name, count, percentage, owned, gapOpportunity: owned ? 0 : percentage };
    })
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || a.skill.localeCompare(b.skill));

  const familyCounts = new Map<string, number>();
  for (const job of eligible) {
    const family = roleFamily(job);
    if (family === 'Other') continue;
    familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1);
  }
  const roleFamilies = [...familyCounts.entries()]
    .map(([family, count]) => ({ family, count, percentage: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);

  const erp = eligible.filter((job) => roleFamily(job) === 'ERP & enterprise systems');
  return {
    analyzedJobs: eligible.length,
    skills,
    gaps: skills.filter((row) => !row.owned).sort((a, b) => b.gapOpportunity - a.gapOpportunity || b.count - a.count).slice(0, 12),
    roleFamilies,
    erpJobs: erp.length,
    erpStrongMatches: erp.filter((job) => job.match && ['exceptional', 'strong'].includes(job.match.recommendation)).length,
  };
}
