export type Recommendation = 'exceptional' | 'strong' | 'reasonable' | 'stretch' | 'skip';

export interface Job {
  id?: string;
  externalId?: string;
  source: string;
  url: string;
  title: string;
  company: string;
  location?: string;
  description: string;
  postedAt?: string;
  discoveredAt?: string;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  employmentType?: string;
  remote?: boolean;
}

export interface CandidateProfile {
  name: string;
  headline?: string;
  location?: string;
  targetTitles: string[];
  preferredLocations: string[];
  skills: string[];
  minimumYears?: number;
  degrees?: string[];
  workAuthorization?: string[];
}

export interface MatchScore {
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
  explanation: string;
}
