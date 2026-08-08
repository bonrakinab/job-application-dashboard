export interface CompanyGroup {
  id: string;
  label: string;
  description: string;
  companies: string[];
  category: 'prestige' | 'services' | 'technology' | 'canada';
}

function key(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export const COMPANY_GROUPS: CompanyGroup[] = [
  {
    id: 'mang',
    label: 'MANG',
    description: 'Meta, Amazon, Netflix and Google.',
    category: 'prestige',
    companies: ['Meta', 'Amazon', 'Netflix', 'Google'],
  },
  {
    id: 'faang-maang',
    label: 'FAANG / MAANG',
    description: 'Meta/Facebook, Amazon, Apple, Netflix and Google/Alphabet.',
    category: 'prestige',
    companies: ['Meta', 'Amazon', 'Apple', 'Netflix', 'Google'],
  },
  {
    id: 'magnificent-seven',
    label: 'Magnificent Seven',
    description: 'The large U.S. technology leaders commonly grouped as Alphabet, Amazon, Apple, Meta, Microsoft, NVIDIA and Tesla.',
    category: 'prestige',
    companies: ['Google', 'Amazon', 'Apple', 'Meta', 'Microsoft', 'NVIDIA', 'Tesla'],
  },
  {
    id: 'fortune-5-2026',
    label: 'Fortune 5 · 2026',
    description: 'The top five companies in the 2026 U.S. Fortune 500 by revenue: Amazon, Walmart, UnitedHealth Group, Apple and Alphabet/Google.',
    category: 'prestige',
    companies: ['Amazon', 'Walmart', 'UnitedHealth Group', 'Apple', 'Google'],
  },
  {
    id: 'big-four',
    label: 'Big Four',
    description: 'The four largest global professional-services networks.',
    category: 'services',
    companies: ['Deloitte', 'PwC', 'EY', 'KPMG'],
  },
  {
    id: 'global-it-services',
    label: 'Global IT / Service-Based',
    description: 'Large IT services, systems integration and technology-consulting employers.',
    category: 'services',
    companies: ['Accenture', 'Capgemini', 'TCS', 'Infosys', 'Cognizant', 'Wipro', 'HCLTech', 'Tech Mahindra', 'NTT DATA', 'CGI', 'IBM', 'Avanade'],
  },
  {
    id: 'consulting-advisory',
    label: 'Consulting & Advisory',
    description: 'Professional-services and advisory firms with technology, data, ERP and transformation practices.',
    category: 'services',
    companies: ['Deloitte', 'PwC', 'EY', 'KPMG', 'Accenture', 'Capgemini', 'CGI', 'Slalom', 'MNP', 'IBM'],
  },
  {
    id: 'enterprise-cloud',
    label: 'Enterprise Software & Cloud',
    description: 'Large enterprise software, cloud, data and developer-platform employers.',
    category: 'technology',
    companies: ['Microsoft', 'Oracle', 'SAP', 'Salesforce', 'Salesforce Canada', 'ServiceNow', 'Workday', 'Adobe', 'Atlassian', 'Snowflake', 'Databricks', 'MongoDB', 'OpenText', 'GitHub', 'GitLab', 'Cisco', 'Cloudflare'],
  },
  {
    id: 'ai-leaders',
    label: 'AI & ML Leaders',
    description: 'Frontier AI, foundation-model, semiconductor and applied-AI companies in the watchlist.',
    category: 'technology',
    companies: ['OpenAI', 'Anthropic', 'Cohere', 'Google', 'Microsoft', 'Meta', 'Amazon', 'NVIDIA', 'AMD', 'Databricks', 'Waabi', 'Coveo', 'Ada', 'BenchSci'],
  },
  {
    id: 'canadian-banks',
    label: 'Canadian Banks',
    description: 'Major Canadian banks and financial institutions.',
    category: 'canada',
    companies: ['RBC', 'TD', 'BMO', 'CIBC', 'Scotiabank', 'National Bank of Canada', 'Bank of Canada'],
  },
  {
    id: 'canadian-telecom',
    label: 'Canadian Telecom',
    description: 'Major Canadian telecommunications employers.',
    category: 'canada',
    companies: ['Bell', 'Rogers', 'TELUS', 'SaskTel', 'Videotron'],
  },
  {
    id: 'canadian-tech',
    label: 'Canadian Tech & SaaS',
    description: 'Canada-connected technology, SaaS, AI, fintech and growth companies.',
    category: 'canada',
    companies: ['Shopify', 'OpenText', 'BlackBerry', 'PointClickCare', 'Kinaxis', 'Geotab', 'Clio', 'StackAdapt', 'Wealthsimple', 'Faire', 'Hootsuite', '1Password', 'Ada', 'Waabi', 'Coveo', 'Lightspeed', 'Nuvei', 'Questrade', 'Neo Financial', 'KOHO', 'Float', 'Vena Solutions', 'Loopio', 'BenchSci', 'League', 'FreshBooks', 'ApplyBoard', 'D2L', 'Docebo', 'Jane App', 'TouchBistro', 'Hopper', 'Plusgrade', 'Thinkific', 'Arctic Wolf', 'Magnet Forensics', 'Axonify', 'Wattpad', 'SSENSE'],
  },
  {
    id: 'insurance-financial',
    label: 'Insurance & Financial Services',
    description: 'Insurance, pension, investment-management and financial-services employers.',
    category: 'canada',
    companies: ['Manulife', 'Sun Life', 'Intact', 'Canada Life', 'Desjardins', 'Co-operators', 'Definity', 'Munich Re Canada', 'CPP Investments', 'OMERS', "Ontario Teachers' Pension Plan", 'Equitable Bank'],
  },
  {
    id: 'industrial-automotive',
    label: 'Industrial & Automotive',
    description: 'Industrial technology, manufacturing and automotive employers, including Windsor/Ontario-relevant companies.',
    category: 'canada',
    companies: ['Stellantis', 'Ford', 'General Motors', 'Magna International', 'Linamar', 'Toyota Canada', 'Honda Canada', 'Siemens', 'Schneider Electric', 'Honeywell', 'ABB', 'Bosch', '3M'],
  },
];

const membership = new Map<string, string[]>();
for (const group of COMPANY_GROUPS) {
  for (const company of group.companies) {
    const normalized = key(company);
    membership.set(normalized, [...(membership.get(normalized) ?? []), group.id]);
  }
}

export function companyGroupIds(company: string) {
  return membership.get(key(company)) ?? [];
}

export function companyGroups(company: string) {
  const ids = new Set(companyGroupIds(company));
  return COMPANY_GROUPS.filter((group) => ids.has(group.id));
}
