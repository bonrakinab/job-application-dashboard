import type { CandidateProfile, JobWithMatch, SearchProfile } from './types';
import { normalizeText } from './utils';

export function profileForSearch(profile: CandidateProfile, searchProfile?: SearchProfile | null): CandidateProfile {
  if (!searchProfile) return profile;
  return {
    ...profile,
    targetTitles: searchProfile.targetTitles.length ? searchProfile.targetTitles : profile.targetTitles,
  };
}

export function filterJobsForSearchProfile(jobs: JobWithMatch[], searchProfile?: SearchProfile | null) {
  if (!searchProfile?.includeKeywords.length) return jobs;
  const keywords = searchProfile.includeKeywords.map(normalizeText).filter(Boolean);
  return jobs.filter((job) => {
    const text = normalizeText(`${job.title} ${job.description}`);
    return keywords.some((keyword) => text.includes(keyword));
  });
}
