import { containsTerm, groundedRewriteIssue } from './resume-evidence-guards';
import type { ApplicationPack, CandidateProfile, Job, MatchScore, RequirementEvidence } from './types';
import { normalizeText } from './utils';

type ClaimResult = {
  claim: string;
  status: 'verified' | 'review';
  confidence: number;
  reason: string;
  evidence: string;
};

type EvidenceChunk = { id?: string; label: string; text: string; sourceText?: string; localSkills?: string[] };

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
    ...profile.skills.map((skill) => ({ label: `Verified skill: ${skill}`, text: skill, sourceText: skill })),
    ...(profile.experience ?? []).flatMap((item, experienceIndex) => item.bullets.map((bullet, bulletIndex) => ({
      id: `EXP:${experienceIndex}:${bulletIndex}`,
      label: `${item.title} · ${item.organization}`,
      text: [item.title, item.organization, bullet, ...(item.skills ?? [])].join(' '),
      sourceText: bullet,
      localSkills: item.skills ?? [],
    }))),
    ...(profile.projects ?? []).flatMap((project, projectIndex) => (project.bullets?.length ? project.bullets : [project.description]).filter(Boolean).map((text, bulletIndex) => ({
      id: `PROJ:${projectIndex}:${bulletIndex}`,
      label: project.name,
      text: [project.name, text, ...(project.skills ?? [])].join(' '),
      sourceText: text,
      localSkills: project.skills ?? [],
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

function supportedRequirementTerms(requirementEvidence: RequirementEvidence[] | undefined) {
  return (requirementEvidence ?? [])
    .filter((item) => item.support === 'supported' && item.evidence.length > 0)
    .flatMap((item) => [item.requirement, ...(item.exactTerms ?? [])])
    .map((term) => normalizeText(term))
    .filter(Boolean);
}

function unsupportedSkillClaim(
  claim: string,
  profile: CandidateProfile,
  match?: MatchScore,
  requirementEvidence?: RequirementEvidence[],
) {
  if (!POSSESSION_LANGUAGE.test(claim)) return null;
  const normalizedClaim = normalizeText(claim);
  const supported = new Set(profile.skills.map(normalizeText));
  const evidenceBacked = supportedRequirementTerms(requirementEvidence);
  const missing = [...new Set([...(match?.missingSkills ?? []), ...(match?.gaps ?? [])])]
    .map((skill) => ({ raw: skill, normalized: normalizeText(skill) }))
    .filter((skill) => skill.normalized.length >= 2 && skill.normalized.length <= 80)
    .filter((skill) => !supported.has(skill.normalized));
  return missing.find((skill) => {
    if (!containsTerm(normalizedClaim, skill.normalized)) return false;
    // A term that the requirement-to-evidence matrix independently proved is
    // not an unsupported skill merely because an earlier match pass called it
    // missing. This is how truthful JD aliases such as stakeholder management
    // survive the final verification pass.
    const groundedAlias = evidenceBacked.some((term) => containsTerm(term, skill.normalized) || containsTerm(skill.normalized, term));
    return !groundedAlias;
  })?.raw ?? null;
}

function unsupportedNumbers(claim: string, profile: CandidateProfile, job: Job, chunks: EvidenceChunk[]) {
  let factual = claim;
  if (/apply|applying|interested|relevant to|position|role/i.test(claim)) {
    factual = factual.replaceAll(job.title, '').replaceAll(job.company, '');
  }
  if (/\b(candidate|expected|graduating|completing|degree|education)\b/i.test(factual)) {
    for (const degree of profile.degrees ?? []) {
      for (const year of degree.end?.match(/\b(?:19|20)\d{2}\b/g) ?? []) factual = factual.replace(new RegExp(`\\b${year}\\b`, 'g'), '');
    }
  }
  const numbers = factual.match(/\b\d+(?:[.,]\d+)?%?/g) ?? [];
  if (!numbers.length) return [];
  const normalized = normalizeText(claim.replace(/^I /i, ''));
  return chunks.some((chunk) => (chunk.sourceText ?? chunk.text).split(/(?<=[.!?])\s+/)
    .some((source) => /\d/.test(source) && (normalizeText(source).includes(normalized) || normalized.includes(normalizeText(source))))) ? [] : numbers;
}

function completedDegreeContradiction(claim: string, profile: CandidateProfile) {
  const hasCurrentDegree = (profile.degrees ?? []).some((degree) => /expected|present|current/i.test(degree.end ?? ''));
  if (!hasCurrentDegree) return false;
  return /\b(i (?:hold|earned|completed)|my completed|graduate with|master(?:'s)? degree holder)\b/i.test(claim);
}

function evaluateClaim(
  claim: string,
  profile: CandidateProfile,
  job: Job,
  match: MatchScore | undefined,
  chunks: EvidenceChunk[],
  requirementEvidence?: RequirementEvidence[],
): ClaimResult {
  const applicationOpening = `I am writing to apply for the ${job.title} position at ${job.company}.`;
  if (claim === applicationOpening || claim === `I am applying for the ${job.title} role at ${job.company}.`) return { claim, status: 'verified', confidence: 100, reason: 'Application intent only.', evidence: 'No candidate accomplishment asserted.' };
  const missingSkill = unsupportedSkillClaim(claim, profile, match, requirementEvidence);
  if (missingSkill) return {
    claim,
    status: 'review',
    confidence: 98,
    reason: `Unsupported skill claim: ${missingSkill}`,
    evidence: 'No verified profile evidence found.',
  };

  const numbers = unsupportedNumbers(claim, profile, job, chunks);
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

  const personal = POSSESSION_LANGUAGE.test(claim) || FACTUAL_ACTIONS.test(claim) || /\b(expert|certified|specialist|professional|degree|graduate|years?)\b/i.test(claim);
  if (!personal) return {
    claim,
    status: 'verified',
    confidence: 96,
    reason: 'No candidate factual claim detected.',
    evidence: 'Job context or non-factual application language.',
  };

  const best = bestEvidence(claim, chunks);
  const profileSkills = profile.skills.filter((skill) => containsTerm(claim, skill));
  const factual = FACTUAL_ACTIONS.test(claim) || profileSkills.length > 0 || /\b(degree|msc|master|bachelor|certif|years?)\b/i.test(claim);
  if (factual && !(profileSkills.length && !FACTUAL_ACTIONS.test(claim.replace(/supported by both professional and project work/i, ''))) && (!best || (best.score < 0.19 && best.hits.length < 2))) return {
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
    reason: factual ? 'Source wording matched; review this interpretation before applying.' : 'General professional language without a new factual assertion.',
    evidence: best?.chunk.label ?? 'Verified profile',
  };
}

function verifyText(
  value: string,
  profile: CandidateProfile,
  job: Job,
  match: MatchScore | undefined,
  chunks: EvidenceChunk[],
  requirementEvidence?: RequirementEvidence[],
) {
  const results = sentences(value).map((claim) => evaluateClaim(claim, profile, job, match, chunks, requirementEvidence));
  return { results, safe: results.every((result) => result.status === 'verified') };
}

function groundPackBullets(pack: ApplicationPack, profile: CandidateProfile, _job: Job, _match: MatchScore | undefined, chunks: EvidenceChunk[]) {
  const warnings: string[] = [];
  let replacedBullets = 0;
  const results: ClaimResult[] = [];
  const ground = <T extends { bullets: string[]; bulletEvidence?: string[][] }>(item: T, prefix: string): T => {
    const local = prefix ? chunks.filter((chunk) => chunk.id?.startsWith(prefix)) : [];
    const evidence: string[][] = [];
    const bullets = item.bullets.map((bullet, index) => {
      const ids = item.bulletEvidence?.[index];
      const exact = local.find((chunk) => normalizeText(chunk.sourceText) === normalizeText(bullet));
      const linked = ids?.length === 1 ? local.find((chunk) => chunk.id === ids[0]) : undefined;
      const source = linked ?? exact;
      const issue = !source ? 'Evidence does not belong to this job or project.'
        : groundedRewriteIssue(bullet, source.sourceText ?? source.text, source.localSkills);
      const fallback = source ?? local[0];
      const finalText = issue && fallback ? fallback.sourceText ?? fallback.text : bullet;
      if (issue) {
        warnings.push(issue);
        if (fallback) replacedBullets += 1;
      }
      evidence.push(fallback?.id ? [fallback.id] : []);
      results.push({
        claim: finalText, status: fallback ? 'verified' : 'review', confidence: fallback ? 100 : 0,
        reason: issue && fallback ? 'Original source evidence restored.' : issue ?? 'Wording checked against the linked source record.',
        evidence: fallback?.label ?? 'No source record for this job or project.',
      });
      return finalText;
    });
    return { ...item, bullets, bulletEvidence: evidence };
  };
  return {
    pack: {
      ...pack,
      experience: pack.experience.map((item) => {
        const index = (profile.experience ?? []).findIndex((source) => normalizeText(source.organization) === normalizeText(item.organization) && normalizeText(source.title) === normalizeText(item.title));
        return ground(item, index >= 0 ? `EXP:${index}:` : '');
      }),
      projects: pack.projects.map((item) => {
        const index = (profile.projects ?? []).findIndex((source) => normalizeText(source.name) === normalizeText(item.name));
        return ground(item, index >= 0 ? `PROJ:${index}:` : '');
      }),
    },
    results, warnings, replacedBullets,
  };
}

export function verifyApplicationPackClaims(
  pack: ApplicationPack,
  safeFallback: Pick<ApplicationPack, 'resumeSummary' | 'coverLetter' | 'outreachMessage'>,
  profile: CandidateProfile,
  job: Job,
  match?: MatchScore,
  requirementEvidence?: RequirementEvidence[],
): ApplicationPack {
  const chunks = evidenceChunks(profile, job);
  const grounded = groundPackBullets(pack, profile, job, match, chunks);
  const matrix = requirementEvidence ?? pack.requirementEvidence;
  const initial = {
    resumeSummary: verifyText(grounded.pack.resumeSummary, profile, job, match, chunks, matrix),
    coverLetter: verifyText(grounded.pack.coverLetter, profile, job, match, chunks, matrix),
    outreachMessage: verifyText(grounded.pack.outreachMessage, profile, job, match, chunks, matrix),
  };
  const replacedFields = (Object.keys(initial) as Array<keyof typeof initial>).filter((field) => !initial[field].safe);
  const corrected: ApplicationPack = {
    ...grounded.pack,
    resumeSummary: initial.resumeSummary.safe ? grounded.pack.resumeSummary : safeFallback.resumeSummary,
    coverLetter: initial.coverLetter.safe ? grounded.pack.coverLetter : safeFallback.coverLetter,
    outreachMessage: initial.outreachMessage.safe ? grounded.pack.outreachMessage : safeFallback.outreachMessage,
  };
  const finalResults = [
    ...grounded.results,
    ...[
      ...corrected.skills.map((claim) => ({ claim, source: profile.skills, label: 'skill' })),
      ...(corrected.certifications ?? []).map((claim) => ({ claim, source: profile.certifications ?? [], label: 'certification' })),
      ...(corrected.publications ?? []).map((claim) => ({ claim, source: profile.publications ?? [], label: 'publication' })),
    ].map(({ claim, source, label }): ClaimResult => ({
      claim, status: source.some((value) => normalizeText(value) === normalizeText(claim)) ? 'verified' : 'review',
      confidence: 100, reason: `Exact ${label} source check.`, evidence: `Profile ${label} records`,
    })),
    ...verifyText(corrected.resumeSummary, profile, job, match, chunks, matrix).results,
    ...verifyText(corrected.coverLetter, profile, job, match, chunks, matrix).results,
    ...verifyText(corrected.outreachMessage, profile, job, match, chunks, matrix).results,
  ];
  const warnings = [...grounded.warnings, ...Object.values(initial)
    .flatMap((field) => field.results)
    .filter((result) => result.status === 'review')
    .map((result) => result.reason)]
    .filter((reason, index, list) => list.indexOf(reason) === index)
    .slice(0, 6);
  const finalSafe = finalResults.every((result) => result.status === 'verified');

  return {
    ...corrected,
    claimsAudit: finalResults.map((result) => ({
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
      replacedBullets: grounded.replacedBullets,
      warnings,
    },
  };
}
