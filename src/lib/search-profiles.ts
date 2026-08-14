import type { CandidateProfile, JobWithMatch, SearchProfile } from './types';
import { normalizeText } from './utils';

export function profileForSearch(profile: CandidateProfile, searchProfile?: SearchProfile | null): CandidateProfile {
  if (!searchProfile) return profile;
  return {
    ...profile,
    targetTitles: searchProfile.targetTitles.length ? searchProfile.targetTitles : profile.targetTitles,
  };
}

function keywordMatches(text: string, keyword: string) {
  if (keyword.length <= 3 && !keyword.includes(' ')) return ` ${text} `.includes(` ${keyword} `);
  return text.includes(keyword);
}

export function filterJobsForSearchProfile(jobs: JobWithMatch[], searchProfile?: SearchProfile | null) {
  if (!searchProfile?.includeKeywords.length) return jobs;
  const keywords = searchProfile.includeKeywords.map(normalizeText).filter(Boolean);
  return jobs.filter((job) => {
    const text = normalizeText(`${job.title} ${job.description}`);
    return keywords.some((keyword) => keywordMatches(text, keyword));
  });
}
