import type { CandidateProfile, Job, JobMatch } from './types';

const normalize = (value: string) => value.trim().toLowerCase();
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function classify(score: number, eligible: boolean): JobMatch['recommendation'] {
  if (!eligible || score < 60) return 'skip';
  if (score >= 90) return 'exceptional';
  if (score >= 80) return 'strong';
  if (score >= 70) return 'reasonable';
  return 'stretch';
}

export function scoreJob(profile: CandidateProfile, job: Job): JobMatch {
  const candidateSkills = new Set(profile.skills.map(normalize));
  const required = job.requiredSkills.map(normalize);
  const matchedSkills = required.filter((skill) => candidateSkills.has(skill));
  const missingSkills = required.filter((skill) => !candidateSkills.has(skill));

  const skillsScore = required.length === 0 ? 70 : clamp((matchedSkills.length / required.length) * 100);

  let experienceScore = 80;
  const blockers: string[] = [];
  if (job.requiredYears != null && profile.minimumYears != null) {
    const ratio = profile.minimumYears / Math.max(1, job.requiredYears);
    experienceScore = clamp(Math.min(1, ratio) * 100);
    if (job.requiredYears >= profile.minimumYears + 5) {
      blockers.push(`Requires ${job.requiredYears}+ years; profile baseline is ${profile.minimumYears}.`);
    }
  }

  const location = normalize(job.location);
  const locationScore = profile.preferredLocations.some((item) => location.includes(normalize(item))) ? 100 : 60;

  for (const requirement of job.hardRequirements ?? []) {
    const r = normalize(requirement);
    if (r.includes('security clearance') || r.includes('citizen only')) blockers.push(requirement);
  }

  const hardEligible = blockers.length === 0;
  const overallScore = clamp(skillsScore * 0.55 + experienceScore * 0.30 + locationScore * 0.15);

  return {
    hardEligible,
    blockers,
    overallScore: hardEligible ? overallScore : Math.min(overallScore, 49),
    skillsScore,
    experienceScore,
    locationScore,
    matchedSkills,
    missingSkills,
    recommendation: classify(overallScore, hardEligible),
  };
}
