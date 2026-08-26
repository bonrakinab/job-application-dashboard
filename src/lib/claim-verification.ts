import type { ApplicationPack, CandidateProfile, Job, MatchScore } from './types';
import { normalizeText } from './utils';

type ClaimResult = {
  claim: string;
  status: 'verified' | 'review';
  confidence: number;
  reason: string;
  evidence: string;
};

type EvidenceChunk = { label: string; text: string };

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'by', 'for', 'from', 'has', 'have', 'i', 'in', 'into',
  'is', 'it', 'me', 'my', 'of', 'on', 'or', 'our', 'the', 'their', 'this', 'to', 'using', 'was', 'were',
  'with', 'would', 'your', 'role', 'team', 'work', 'working', 'position', 'experience', 'background',
]);

const FACTUAL_ACTIONS = /\b(built|created|delivered|designed|developed|implemented|improved|increased|led|managed|migrated|reduced|supported|automated|deployed|integrated|optimized|owned|worked)\b/i;
const POSSESSION_LANGUAGE = /\b(i|my|me|background|experience|experienced|proficient|skilled|knowledge|built|developed|implemented|using|worked with|hands-on)\b/i;

function tokens(value: string) {
  return [...new Set(normalizeText(value)
    .split(/\s+/)
    .map((token) => token.replace(/^[-/.]+|[-/.]+$/g, ''))
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token)))];
}

function sentences(value: string) {
  return value
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 12)
    .filter((sentence) => !/^(dear hiring manager|sincerely,?|best regards,?|kind regards,?)$/i.test(sentence));
}

function evidenceChunks(profile: CandidateProfile, job: Job): EvidenceChunk[] {
  return [
    { label: 'Verified profile', text: [profile.headline, profile.summary, profile.yearsExperience == null ? '' : `${profile.yearsExperience} years of experience`].filter(Boolean).join(' ') },
    ...profile.skills.map((skill) => ({ label: `Verified skill: ${skill}`, text: skill })),
    ...(profile.experience ?? []).flatMap((item) => item.bullets.map((bullet) => ({
      label: `${item.title} · ${item.organization}`,
      text: [item.title, item.organization, bullet, ...(item.skills ?? [])].join(' '),
    }))),
    ...(profile.projects ?? []).flatMap((project) => [project.description, ...(project.bullets ?? [])].filter(Boolean).map((text) => ({
      label: project.name,
      text: [project.name, text, ...(project.skills ?? [])].join(' '),
    }))),
    ...(profile.degrees ?? []).map((degree) => ({
      label: degree.institution,
      text: [degree.degree, degree.field, degree.institution, degree.end, ...(degree.coursework ?? [])].filter(Boolean).join(' '),
    })),
    ...(profile.certifications ?? []).map((certification) => ({ label: 'Certification', text: certification })),
    ...(profile.languages ?? []).map((language) => ({ label: 'Language', text: language })),
    ...(profile.courses ?? []).map((course) => ({ label: 'Course', text: course })),
    ...(profile.awards ?? []).map((award) => ({ label: 'Honor or award', text: award })),
    ...(profile.publications ?? []).map((publication) => ({ label: 'Publication', text: publication })),
    ...(profile.profileSources?.linkedin?.headline ? [{ label: 'LinkedIn headline', text: profile.profileSources.linkedin.headline }] : []),
    ...(profile.profileSources?.linkedin?.summary ? [{ label: 'LinkedIn summary', text: profile.profileSources.linkedin.summary }] : []),
    ...(profile.workAuthorization ?? []).map((authorization) => ({ label: 'Work authorization', text: authorization })),
    { label: 'Job posting', text: [job.title, job.company, job.location, job.employmentType, job.department].filter(Boolean).join(' ') },
  ].filter((chunk) => chunk.text.trim());
}

function bestEvidence(claim: string, chunks: EvidenceChunk[]) {
  const claimTokens = tokens(claim);
  const ranked = chunks.map((chunk) => {
    const chunkTokens = new Set(tokens(chunk.text));
    const hits = claimTokens.filter((token) => chunkTokens.has(token));
    const distinctiveHits = hits.filter((token) => token.length >= 6);
    const score = claimTokens.length ? Math.min(1, (hits.length + distinctiveHits.length * 0.5) / Math.min(8, Math.max(3, claimTokens.length))) : 0;
    return { chunk, score, hits };
  }).sort((a, b) => b.score - a.score);
  return ranked[0];
}

function unsupportedSkillClaim(claim: string, profile: CandidateProfile, match?: MatchScore) {
  if (!POSSESSION_LANGUAGE.test(claim)) return null;
  const normalizedClaim = normalizeText(claim);
  const supported = new Set(profile.skills.map(normalizeText));
  const missing = [...new Set([...(match?.missingSkills ?? []), ...(match?.gaps ?? [])])]
    .map((skill) => ({ raw: skill, normalized: normalizeText(skill) }))
    .filter((skill) => skill.normalized.length >= 2 && skill.normalized.length <= 80)
    .filter((skill) => !supported.has(skill.normalized));
  return missing.find((skill) => normalizedClaim.includes(skill.normalized))?.raw ?? null;
}

function unsupportedNumbers(claim: string, profile: CandidateProfile, job: Job) {
  const numbers = claim.match(/\b\d+(?:[.,]\d+)?%?\b/g) ?? [];
  if (!numbers.length) return [];
  const source = normalizeText(JSON.stringify({ profile, title: job.title, company: job.company, location: job.location }));
  return numbers.filter((number) => !source.includes(normalizeText(number)));
}

function completedDegreeContradiction(claim: string, profile: CandidateProfile) {
  const hasCurrentDegree = (profile.degrees ?? []).some((degree) => /expected|present|current/i.test(degree.end ?? ''));
  if (!hasCurrentDegree) return false;
  return /\b(i (?:hold|earned|completed)|my completed|graduate with|master(?:'s)? degree holder)\b/i.test(claim);
}

function evaluateClaim(claim: string, profile: CandidateProfile, job: Job, match: MatchScore | undefined, chunks: EvidenceChunk[]): ClaimResult {
  const missingSkill = unsupportedSkillClaim(claim, profile, match);
  if (missingSkill) return {
    claim,
    status: 'review',
    confidence: 98,
    reason: `Unsupported skill claim: ${missingSkill}`,
    evidence: 'No verified profile evidence found.',
  };

  const numbers = unsupportedNumbers(claim, profile, job);
  if (numbers.length) return {
    claim,
    status: 'review',
    confidence: 99,
    reason: `Unsupported numeric claim: ${numbers.join(', ')}`,
    evidence: 'No matching number exists in the verified profile.',
  };

  if (completedDegreeContradiction(claim, profile)) return {
    claim,
    status: 'review',
    confidence: 99,
    reason: 'The claim describes an in-progress degree as completed.',
    evidence: 'Verified education record is marked expected/current.',
  };

  const personal = POSSESSION_LANGUAGE.test(claim);
  if (!personal) return {
    claim,
    status: 'verified',
    confidence: 96,
    reason: 'No candidate factual claim detected.',
    evidence: 'Job context or non-factual application language.',
  };

  const best = bestEvidence(claim, chunks);
  const profileSkills = profile.skills.filter((skill) => normalizeText(claim).includes(normalizeText(skill)));
  const factual = FACTUAL_ACTIONS.test(claim) || profileSkills.length > 0 || /\b(degree|msc|master|bachelor|certif|years?)\b/i.test(claim);
  if (factual && (!best || (best.score < 0.19 && best.hits.length < 2))) return {
    claim,
    status: 'review',
    confidence: 82,
    reason: 'The factual claim is not sufficiently grounded in a verified evidence record.',
    evidence: best?.chunk.label ?? 'No verified profile evidence found.',
  };

  return {
    claim,
    status: 'verified',
    confidence: Math.max(82, Math.min(99, Math.round(82 + (best?.score ?? 0.2) * 17))),
    reason: factual ? 'Claim is supported by verified profile evidence.' : 'General professional language without a new factual assertion.',
    evidence: best?.chunk.label ?? 'Verified profile',
  };
}

function verifyText(value: string, profile: CandidateProfile, job: Job, match: MatchScore | undefined, chunks: EvidenceChunk[]) {
  const results = sentences(value).map((claim) => evaluateClaim(claim, profile, job, match, chunks));
  return { results, safe: results.every((result) => result.status === 'verified') };
}

export function verifyApplicationPackClaims(
  pack: ApplicationPack,
  safeFallback: Pick<ApplicationPack, 'resumeSummary' | 'coverLetter' | 'outreachMessage'>,
  profile: CandidateProfile,
  job: Job,
  match?: MatchScore,
): ApplicationPack {
  const chunks = evidenceChunks(profile, job);
  const initial = {
    resumeSummary: verifyText(pack.resumeSummary, profile, job, match, chunks),
    coverLetter: verifyText(pack.coverLetter, profile, job, match, chunks),
    outreachMessage: verifyText(pack.outreachMessage, profile, job, match, chunks),
  };
  const replacedFields = (Object.keys(initial) as Array<keyof typeof initial>).filter((field) => !initial[field].safe);
  const corrected: ApplicationPack = {
    ...pack,
    resumeSummary: initial.resumeSummary.safe ? pack.resumeSummary : safeFallback.resumeSummary,
    coverLetter: initial.coverLetter.safe ? pack.coverLetter : safeFallback.coverLetter,
    outreachMessage: initial.outreachMessage.safe ? pack.outreachMessage : safeFallback.outreachMessage,
  };
  const finalResults = [
    ...verifyText(corrected.resumeSummary, profile, job, match, chunks).results,
    ...verifyText(corrected.coverLetter, profile, job, match, chunks).results,
    ...verifyText(corrected.outreachMessage, profile, job, match, chunks).results,
  ];
  const warnings = Object.values(initial)
    .flatMap((field) => field.results)
    .filter((result) => result.status === 'review')
    .map((result) => result.reason)
    .filter((reason, index, list) => list.indexOf(reason) === index)
    .slice(0, 6);
  const finalSafe = finalResults.every((result) => result.status === 'verified');

  return {
    ...corrected,
    claimsAudit: finalResults.slice(0, 24).map((result) => ({
      claim: result.claim,
      evidence: result.evidence,
      status: result.status,
      confidence: result.confidence,
      reason: result.reason,
    })),
    claimVerification: {
      status: finalSafe ? 'pass' : 'review',
      checkedClaims: finalResults.length,
      verifiedClaims: finalResults.filter((result) => result.status === 'verified').length,
      replacedFields,
      warnings,
    },
  };
}
