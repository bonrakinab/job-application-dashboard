import type { ApplicationPack, InterviewPrep, JobWithMatch } from './types';
import { normalizeText } from './utils';

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function requirementTopics(job: JobWithMatch, pack?: ApplicationPack | null) {
  const match = job.match;
  const fromRequirements = [...(match?.mustHave ?? []), ...(match?.preferred ?? []), ...(match?.matchedSkills ?? []), ...(pack?.interviewThemes ?? [])];
  const text = normalizeText(`${job.title} ${job.description}`);
  const inferred: string[] = [];
  if (/\boracle fusion\b/.test(text)) inferred.push('Oracle Fusion');
  if (/\boracle (cloud )?erp\b/.test(text) || /\berp\b/.test(text)) inferred.push('ERP processes');
  if (/\bfinancials?\b/.test(text)) inferred.push('Financial systems');
  if (/\bprocurement\b/.test(text)) inferred.push('Procurement systems');
  if (/\bsql\b/.test(text)) inferred.push('SQL');
  if (/\bpython\b/.test(text)) inferred.push('Python');
  if (/\bapi|integration|webhook\b/.test(text)) inferred.push('API and integration design');
  if (/\bcloud|aws|azure|gcp\b/.test(text)) inferred.push('Cloud architecture');
  if (/\bdocker|kubernetes|container\b/.test(text)) inferred.push('Containers and deployment');
  if (/\bmachine learning|artificial intelligence|\bml\b|\bai\b/.test(text)) inferred.push('Applied AI / machine learning');
  return unique([...fromRequirements, ...inferred]).slice(0, 10);
}

export function buildInterviewPrep(job: JobWithMatch, pack?: ApplicationPack | null): InterviewPrep {
  const topics = requirementTopics(job, pack);
  const likelyQuestions = topics.slice(0, 6).map((topic) => `Tell me about a time you used or worked around ${topic}. What was the problem, what did you do, and what changed?`);
  if (job.match?.gaps.length) likelyQuestions.push(`This role mentions ${job.match.gaps[0]}. How would you close that gap quickly while still contributing from day one?`);
  likelyQuestions.push(`Why are you interested in ${job.company} and this ${job.title} role specifically?`);
  likelyQuestions.push('Walk me through a technical problem that required you to coordinate across people, systems, or competing constraints.');

  const evidence = [
    ...(pack?.experience ?? []).slice(0, 3).map((item) => ({ label: `${item.organization} — ${item.title}`, detail: item.bullets[0] ?? 'Use the strongest role-relevant example from this experience.' })),
    ...(pack?.projects ?? []).slice(0, 3).map((item) => ({ label: item.name, detail: item.bullets[0] ?? 'Use the strongest role-relevant project result.' })),
  ].slice(0, 5);

  const starPrompts = evidence.slice(0, 4).map((item) => `Prepare a STAR story for “${item.label}”: situation/context → your specific task → actions you personally took → measurable or observable result.`);
  if (!starPrompts.length) starPrompts.push('Prepare one STAR story for a technical problem, one for stakeholder collaboration, and one for learning a new tool quickly.');

  const questionsToAsk = [
    `What would strong performance in the first 90 days look like for this ${job.title} role?`,
    `Which systems, tools, or business processes would I work with most often on this team?`,
    `What are the biggest technical or operational problems the team wants this hire to solve?`,
    `How does ${job.company} support learning and progression for someone growing in this role family?`,
  ];

  return {
    topics,
    likelyQuestions: unique(likelyQuestions).slice(0, 9),
    evidence,
    starPrompts,
    questionsToAsk,
  };
}
