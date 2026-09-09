import type { CandidateProfile, CandidateProfileId, Job } from './types';
import { jobMatchesType } from './job-type';
import { normalizeText } from './utils';

export const DEFAULT_PROFILE_ID: CandidateProfileId = 'default';
export const PART_TIME_PROFILE_ID: CandidateProfileId = 'part-time';

const WINDSOR_ESSEX_PLACES = [
  'windsor',
  'tecumseh',
  'lasalle',
  'la salle',
  'oldcastle',
  'lakeshore',
  'essex',
  'amherstburg',
  'kingsville',
  'leamington',
];

// Employment type does not decide which resume should be used. A part-time AI,
// software, data, ERP, cloud, systems, or analyst role still belongs to the
// career track and should use the full technical profile rather than the
// separate Windsor retail/service resume.
const CAREER_TRACK_TITLE = /\b(?:machine learning|artificial intelligence|ai engineer|ai systems?|ai evaluation|ml engineer|ml engineering|software|developer|engineer|data analyst|data analytics|data engineer|data scientist|data reporting|reporting analyst|analyst|analytics|oracle|erp|cloud|devops|cybersecurity|security analyst|systems? analyst|systems? engineer|systems? administrator|technical analyst|technical consultant|technical support|technical engineer|solutions? engineer|solutions? consultant|business analyst|implementation consultant|functional analyst)\b/i;

function rawProfileId(raw: unknown): CandidateProfileId | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const record = raw as Record<string, unknown>;
  const listing = record.listing && typeof record.listing === 'object'
    ? record.listing as Record<string, unknown>
    : undefined;
  const value = record.profile_id ?? record.application_profile_id
    ?? listing?.profile_id ?? listing?.application_profile_id;
  return value === PART_TIME_PROFILE_ID ? PART_TIME_PROFILE_ID
    : value === DEFAULT_PROFILE_ID ? DEFAULT_PROFILE_ID
      : undefined;
}

export function candidateProfileId(value: string | null | undefined): CandidateProfileId {
  return value === PART_TIME_PROFILE_ID ? PART_TIME_PROFILE_ID : DEFAULT_PROFILE_ID;
}

export function isCareerTrackJob(job: Pick<Job, 'title'>) {
  return CAREER_TRACK_TITLE.test(job.title ?? '');
}

export function profileIdForJob(job: Pick<Job, 'applicationProfileId' | 'raw' | 'title' | 'location' | 'employmentType' | 'workplaceType' | 'remote'>): CandidateProfileId {
  // Correct legacy rows that were classified as part-time purely because their
  // employment type said Part Time. Career-track title evidence wins.
  if (isCareerTrackJob(job)) return DEFAULT_PROFILE_ID;
  return job.applicationProfileId
    ?? rawProfileId(job.raw)
    ?? (jobMatchesType(job, 'part-time') ? PART_TIME_PROFILE_ID : DEFAULT_PROFILE_ID);
}

export function isWindsorEssexJob(job: Pick<Job, 'location' | 'raw'>) {
  const record = job.raw && typeof job.raw === 'object' ? job.raw as Record<string, unknown> : undefined;
  const listing = record?.listing && typeof record.listing === 'object' ? record.listing as Record<string, unknown> : undefined;
  const rawLocation = typeof record?.location === 'string' ? record.location
    : typeof listing?.location === 'string' ? listing.location
      : '';
  const location = normalizeText(`${job.location ?? ''} ${rawLocation}`);
  return WINDSOR_ESSEX_PLACES.some((place) => new RegExp(`\\b${place.replace(' ', '\\s+')}\\b`, 'i').test(location));
}

export function isWindsorPartTimeJob(job: Pick<Job, 'applicationProfileId' | 'raw' | 'title' | 'location' | 'employmentType' | 'workplaceType' | 'remote'>) {
  return profileIdForJob(job) === PART_TIME_PROFILE_ID && isWindsorEssexJob(job);
}

export function isMainCareerJob(job: Pick<Job, 'applicationProfileId' | 'raw' | 'title' | 'location' | 'employmentType' | 'workplaceType' | 'remote'>) {
  return profileIdForJob(job) === DEFAULT_PROFILE_ID;
}

export function emptyPartTimeProfile(): CandidateProfile {
  return {
    profilePurpose: 'part-time',
    name: '',
    location: 'Windsor, Ontario, Canada',
    headline: 'Part-time job candidate',
    targetTitles: [
      'Retail Associate',
      'Customer Service Representative',
      'Food Service Team Member',
      'Warehouse Associate',
      'Manufacturing Associate',
      'General Labourer',
      'Administrative Assistant',
    ],
    preferredLocations: ['Windsor, Ontario', 'Tecumseh, Ontario', 'LaSalle, Ontario'],
    skills: [],
    experience: [],
    degrees: [],
    projects: [],
    certifications: [],
    languages: [],
    courses: [],
    awards: [],
    publications: [],
    workAuthorization: [],
    links: {},
    excludedKeywords: [],
  };
}
