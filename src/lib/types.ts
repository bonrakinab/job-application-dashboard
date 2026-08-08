export type Recommendation = 'exceptional' | 'strong' | 'reasonable' | 'stretch' | 'skip';
export type ApplicationStatus = 'discovered' | 'reviewing' | 'approved' | 'applied' | 'interview' | 'rejected' | 'offer' | 'withdrawn';
export type SourceKind = 'greenhouse' | 'lever' | 'ashby';

export interface Job {
  id?: string;
  externalId: string;
  source: SourceKind | string;
  sourceKey: string;
  url: string;
  applyUrl?: string;
  title: string;
  company: string;
  location?: string;
  description: string;
  postedAt?: string;
  discoveredAt?: string;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  salaryText?: string;
  employmentType?: string;
  remote?: boolean;
  workplaceType?: string;
  department?: string;
  raw?: unknown;
}

export interface ExperienceItem {
  organization: string;
  title: string;
  start?: string;
  end?: string;
  bullets: string[];
  skills?: string[];
}

export interface ProjectItem {
  name: string;
  description: string;
  bullets?: string[];
  skills?: string[];
}

export interface EducationItem {
  institution: string;
  degree: string;
  field?: string;
  end?: string;
}

export interface CandidateProfile {
  name: string;
  email?: string;
  phone?: string;
  location?: string;
  headline?: string;
  summary?: string;
  targetTitles: string[];
  preferredLocations: string[];
  skills: string[];
  yearsExperience?: number;
  degrees?: EducationItem[];
  experience?: ExperienceItem[];
  projects?: ProjectItem[];
  certifications?: string[];
  workAuthorization?: string[];
  links?: Record<string, string>;
  excludedKeywords?: string[];
}

export interface MatchScore {
  id?: string;
  jobId?: string;
  overall: number;
  skills: number;
  experience: number;
  education: number;
  domain: number;
  location: number;
  recommendation: Recommendation;
  blockers: string[];
  strengths: string[];
  gaps: string[];
  mustHave: string[];
  preferred: string[];
  matchedSkills: string[];
  missingSkills: string[];
  explanation: string;
  analyzedAt?: string;
  model?: string;
}

export interface JobWithMatch extends Job {
  match?: MatchScore;
  application?: ApplicationRecord;
}

export interface ApplicationRecord {
  id?: string;
  jobId: string;
  status: ApplicationStatus;
  appliedAt?: string;
  responseAt?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApplicationPack {
  summary: string;
  resumeHeadline: string;
  resumeSummary: string;
  skills: string[];
  experience: Array<{
    organization: string;
    title: string;
    bullets: string[];
  }>;
  projects: Array<{
    name: string;
    bullets: string[];
  }>;
  coverLetter: string;
  outreachMessage: string;
  interviewThemes: string[];
  claimsAudit: Array<{
    claim: string;
    evidence: string;
  }>;
}

export interface DashboardStats {
  discovered: number;
  recommended: number;
  applied: number;
  interviews: number;
  offers: number;
}

export interface AtsSource {
  kind: SourceKind;
  key: string;
  company: string;
  enabled?: boolean;
}

export interface CompanyIntelligence {
  company: string;
  summary: string;
  recentSignals: string[];
  interviewThemes: string[];
  contacts: Array<{
    name: string;
    title: string;
    publicProfileUrl: string;
    whyRelevant: string;
  }>;
  sources: Array<{ title: string; url: string }>;
  researchedAt?: string;
  model?: string;
}
