export type JobSource = 'greenhouse' | 'lever' | 'ashby' | 'company' | 'apify' | 'manual';

export interface CandidateProfile {
  skills: string[];
  preferredLocations: string[];
  minimumYears?: number;
  degrees?: string[];
  workAuthorization?: string[];
  targetTitles: string[];
}

export interface Job {
  id: string;
  source: JobSource;
  externalId?: string;
  url: string;
  company: string;
  title: string;
  location: string;
  postedAt?: string;
  description: string;
  requiredSkills: string[];
  preferredSkills?: string[];
  requiredYears?: number;
  hardRequirements?: string[];
}

export interface JobMatch {
  hardEligible: boolean;
  blockers: string[];
  overallScore: number;
  skillsScore: number;
  experienceScore: number;
  locationScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  recommendation: 'exceptional' | 'strong' | 'reasonable' | 'stretch' | 'skip';
}
