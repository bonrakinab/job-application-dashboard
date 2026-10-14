import type { Job } from './types';

export type JobRoleFilter =
  | 'all'
  | 'analyst'
  | 'software-engineering'
  | 'ai-ml'
  | 'data-analytics'
  | 'it-support'
  | 'cloud-devops'
  | 'erp-enterprise'
  | 'cybersecurity'
  | 'qa-testing'
  | 'clerical-transcription'
  | 'other';

export const JOB_ROLE_OPTIONS: Array<{ value: JobRoleFilter; label: string }> = [
  { value: 'all', label: 'All role families' },
  { value: 'analyst', label: 'Analyst' },
  { value: 'software-engineering', label: 'Software Engineering' },
  { value: 'ai-ml', label: 'AI / ML' },
  { value: 'data-analytics', label: 'Data & Analytics' },
  { value: 'it-support', label: 'IT & Technical Support' },
  { value: 'cloud-devops', label: 'Cloud / DevOps / Platform' },
  { value: 'erp-enterprise', label: 'ERP & Enterprise Systems' },
  { value: 'cybersecurity', label: 'Cybersecurity' },
  { value: 'qa-testing', label: 'QA / Testing' },
  { value: 'clerical-transcription', label: 'Clerical / Transcription' },
  { value: 'other', label: 'Other' },
];

type RoleJob = Pick<Job, 'title' | 'description' | 'department'>;

function normalize(value = '') {
  return value.toLowerCase().replace(/[^a-z0-9+#./ -]/g, ' ').replace(/\s+/g, ' ').trim();
}

function roleText(job: RoleJob) {
  return normalize(`${job.title ?? ''} ${job.department ?? ''} ${job.description ?? ''}`);
}

function titleText(job: RoleJob) {
  return normalize(job.title ?? '');
}

const roleMatchers: Record<Exclude<JobRoleFilter, 'all' | 'other'>, (job: RoleJob) => boolean> = {
  analyst: (job) => /\banalyst\b/.test(titleText(job)),
  'software-engineering': (job) => /\b(software (engineer|developer)|software engineering|full[ -]?stack|front[ -]?end|back[ -]?end|frontend|backend|web developer|mobile developer|application developer|application engineer)\b/.test(titleText(job)),
  'ai-ml': (job) => /\b(machine learning|artificial intelligence|ai engineer|ml engineer|data scientist|computer vision|natural language processing|nlp|generative ai|genai|llm)\b/.test(roleText(job)),
  'data-analytics': (job) => /\b(data analyst|data engineer|analytics engineer|business intelligence|bi analyst|data analytics|database developer|etl developer|reporting analyst|reporting developer)\b/.test(roleText(job)),
  'it-support': (job) => /\b(it support|information technology|help[ -]?desk|service[ -]?desk|desktop support|technical support|application support|systems? administrator|network administrator|it analyst|it systems|support specialist|support technician)\b/.test(roleText(job)),
  'cloud-devops': (job) => /\b(cloud engineer|cloud analyst|cloud developer|devops|site reliability|sre|platform engineer|platform developer|infrastructure engineer)\b/.test(roleText(job)),
  'erp-enterprise': (job) => /\b(oracle fusion|oracle erp|oracle cloud|oracle applications|oracle financials|erp|sap|enterprise applications|enterprise systems|business systems|functional analyst|functional consultant)\b/.test(roleText(job)),
  cybersecurity: (job) => /\b(cybersecurity|cyber security|security analyst|security engineer|soc analyst|security operations|identity and access|iam analyst|iam engineer|information security)\b/.test(roleText(job)),
  'qa-testing': (job) => /\b(quality assurance|qa engineer|qa analyst|test engineer|test analyst|software tester|automation tester|test automation|sdet)\b/.test(roleText(job)),
  'clerical-transcription': (job) => /\b(transcriptionist|transcription|unit clerk|ward clerk|records? clerk|health records?|booking clerk|scheduling clerk|staffing clerk|administrative clerk|office clerk|data entry clerk|data input clerk|payroll clerk|revenue clerk|court clerk|filing clerk|referral clerk|medical imaging clerk|business clerk|clerical support)\b/.test(roleText(job)),
};

export function jobMatchesRole(job: RoleJob, filter: JobRoleFilter) {
  if (filter === 'all') return true;
  if (filter === 'other') {
    return !Object.values(roleMatchers).some((matches) => matches(job));
  }
  return roleMatchers[filter](job);
}

export function matchingJobRoles(job: RoleJob) {
  return JOB_ROLE_OPTIONS
    .filter((option) => option.value !== 'all' && option.value !== 'other')
    .filter((option) => jobMatchesRole(job, option.value))
    .map((option) => option.label);
}
