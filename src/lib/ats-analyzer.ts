import { scoreTailoredResume } from './ats-score';
import { verifyApplicationPackClaims } from './claim-verification';
import { buildRequirementEvidenceMatrix } from './requirement-evidence';
import type {
  ApplicationPack,
  CandidateProfile,
  Job,
  MatchScore,
  RequirementEvidence,
} from './types';
import type { ResumeFileInspection } from './resume-file-text';

export interface AtsCheckerMetric {
  label: string;
  score: number;
}

export interface AtsCheckerResult {
  id: 'readiness' | 'match' | 'requirements' | 'keywords' | 'format' | 'integrity';
  name: string;
  score: number;
  summary: string;
  metrics: AtsCheckerMetric[];
  good: string[];
  needsWork: string[];
  improvements: string[];
}

export interface AtsAnalyzerResult {
  combinedScore: number;
  targetScore: number;
  label: string;
  job: { title: string; company: string; location?: string };
  resume: { name: string; format: string; pages?: number };
  models: { selected: string; profileExtraction: string; jobAnalysis: string };
  checkers: AtsCheckerResult[];
  matchedKeywords: string[];
  missingKeywords: string[];
  requirements: RequirementEvidence[];
  analyzedAt: string;
  disclaimer: string;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function unique(values: Array<string | undefined | null>, limit = 12) {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const item = value?.trim();
    if (!item || seen.has(item.toLowerCase())) return [];
    seen.add(item.toLowerCase());
    return [item];
  }).slice(0, limit);
}

function scoreLabel(score: number) {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Strong';
  if (score >= 70) return 'Competitive';
  if (score >= 60) return 'Needs tailoring';
  return 'Major gaps';
}

function scoreFromClaims(pack: ApplicationPack) {
  const checked = pack.claimVerification?.checkedClaims ?? pack.claimsAudit.length;
  const verified = pack.claimVerification?.verifiedClaims
    ?? pack.claimsAudit.filter((claim) => claim.status !== 'review').length;
  return checked ? clamp((verified / checked) * 100) : 100;
}

function supportScore(requirements: RequirementEvidence[], fallback: number) {
  if (!requirements.length) return fallback;
  let points = 0;
  let weight = 0;
  for (const item of requirements) {
    const itemWeight = item.importance === 'must-have' ? 1 : 0.35;
    points += itemWeight * (item.support === 'supported' ? 1 : item.support === 'partial' ? 0.55 : 0);
    weight += itemWeight;
  }
  return clamp((points / weight) * 100);
}

export function uploadedResumePack(profile: CandidateProfile, requirements: RequirementEvidence[]): ApplicationPack {
  const resumeSummary = profile.summary?.trim() ?? '';
  return {
    summary: resumeSummary,
    resumeHeadline: profile.headline?.trim() || profile.experience?.[0]?.title || '',
    resumeSummary,
    skills: [...profile.skills],
    experience: (profile.experience ?? []).map((item, experienceIndex) => ({
      organization: item.organization,
      title: item.title,
      bullets: [...item.bullets],
      bulletEvidence: item.bullets.map((_, bulletIndex) => [`EXP:${experienceIndex}:${bulletIndex}`]),
    })),
    projects: (profile.projects ?? []).map((item, projectIndex) => ({
      name: item.name,
      bullets: [...(item.bullets?.length ? item.bullets : [item.description].filter(Boolean))],
      bulletEvidence: (item.bullets?.length ? item.bullets : [item.description].filter(Boolean))
        .map((_, bulletIndex) => [`PROJ:${projectIndex}:${bulletIndex}`]),
    })),
    education: (profile.degrees ?? []).map((item) => ({
      institution: item.institution,
      degree: item.degree,
      field: item.field,
      coursework: [...(item.coursework ?? [])],
    })),
    certifications: [...(profile.certifications ?? [])],
    publications: [...(profile.publications ?? [])],
    awards: [...(profile.awards ?? [])],
    coverLetter: '',
    outreachMessage: '',
    interviewThemes: [],
    claimsAudit: [],
    requirementEvidence: requirements,
  };
}

function lowMetricSuggestions(metrics: AtsCheckerMetric[]) {
  const suggestions: string[] = [];
  for (const metric of metrics) {
    if (metric.score >= 75) continue;
    if (metric.label === 'Requirement support') suggestions.push('Address the highest-priority unsupported requirements with truthful evidence, or treat them as genuine gaps.');
    if (metric.label === 'Skill coverage') suggestions.push('Add relevant skills already demonstrated in your work or projects, using the job description’s exact terminology.');
    if (metric.label === 'Exact keywords') suggestions.push('Mirror important job-description terms where they accurately describe your existing experience.');
    if (metric.label === 'Evidence relevance') suggestions.push('Rewrite the strongest bullets so the action, tool, context, and result are obvious.');
    if (metric.label === 'Format hygiene') suggestions.push('Use standard headings, simple dates, concise bullets, and a single-column layout.');
    if (metric.label === 'Keyword placement') suggestions.push('Move the most relevant supported keywords into the summary, skills section, and most recent experience.');
    if (metric.label === 'Role positioning') suggestions.push('Align the headline and summary with the target role without changing your actual title or seniority.');
  }
  return unique(suggestions, 8);
}

export function analyzeUploadedResume(options: {
  job: Job;
  profile: CandidateProfile;
  match: MatchScore;
  inspection: ResumeFileInspection;
  resumeFileName: string;
  profileExtractionModel: string;
  selectedModel: string;
}): AtsAnalyzerResult {
  const { job, profile, match, inspection } = options;
  const requirements = buildRequirementEvidenceMatrix(job, profile, match, inspection.text);
  const sourcePack = uploadedResumePack(profile, requirements);
  const verifiedPack = verifyApplicationPackClaims(sourcePack, {
    resumeSummary: sourcePack.resumeSummary,
    coverLetter: '',
    outreachMessage: '',
  }, profile, job, match);
  const readiness = scoreTailoredResume(job, profile, verifiedPack, match, inspection.text);
  const requirementsScore = supportScore(requirements, readiness.requirementCoverage);
  const keywordScore = clamp(
    readiness.exactKeywordCoverage * 0.55
    + readiness.skillCoverage * 0.25
    + readiness.keywordPlacement * 0.20,
  );
  const formatScore = clamp(readiness.formatHygiene * 0.60 + inspection.parseabilityScore * 0.40);
  const integrityScore = scoreFromClaims(verifiedPack);

  const readinessMetrics: AtsCheckerMetric[] = [
    { label: 'Requirement support', score: readiness.requirementCoverage },
    { label: 'Skill coverage', score: readiness.skillCoverage },
    { label: 'Exact keywords', score: readiness.exactKeywordCoverage },
    { label: 'Evidence relevance', score: readiness.evidenceRelevance },
    { label: 'Format hygiene', score: readiness.formatHygiene },
    { label: 'Keyword placement', score: readiness.keywordPlacement },
    { label: 'Role positioning', score: readiness.rolePositioning },
  ];
  const supported = requirements.filter((item) => item.support === 'supported');
  const partial = requirements.filter((item) => item.support === 'partial');
  const gaps = requirements.filter((item) => item.support === 'gap');
  const claimWarnings = verifiedPack.claimVerification?.warnings ?? [];
  const checkedClaims = verifiedPack.claimVerification?.checkedClaims ?? verifiedPack.claimsAudit.length;
  const verifiedClaims = verifiedPack.claimVerification?.verifiedClaims
    ?? verifiedPack.claimsAudit.filter((claim) => claim.status !== 'review').length;

  const checkers: AtsCheckerResult[] = [
    {
      id: 'readiness',
      name: 'System ATS readiness',
      score: readiness.overall,
      summary: 'The dashboard’s full internal ATS estimate across requirements, keywords, evidence, positioning, and format.',
      metrics: readinessMetrics,
      good: unique(readinessMetrics.filter((metric) => metric.score >= 80).map((metric) => `${metric.label}: ${metric.score}/100`)),
      needsWork: unique([
        ...readiness.hardBlockers,
        ...readiness.unsupportedMustHaves.map((item) => `Unsupported must-have: ${item}`),
        ...(readiness.analysisIncomplete ? ['The job description did not yield a complete detailed requirement analysis.'] : []),
        ...readinessMetrics.filter((metric) => metric.score < 65).map((metric) => `${metric.label} is ${metric.score}/100.`),
      ]),
      improvements: lowMetricSuggestions(readinessMetrics),
    },
    {
      id: 'match',
      name: 'Resume–job match',
      score: match.overall,
      summary: 'Fit based on skills, experience, education, domain alignment, location, and hard eligibility requirements.',
      metrics: [
        { label: 'Skills', score: match.skills },
        { label: 'Experience', score: match.experience },
        { label: 'Education', score: match.education },
        { label: 'Domain', score: match.domain },
        { label: 'Location', score: match.location },
      ],
      good: unique([...match.strengths, ...match.matchedSkills.map((item) => `Matched skill: ${item}`)]),
      needsWork: unique([...match.blockers, ...match.gaps, ...match.missingSkills.map((item) => `Missing or unverified: ${item}`)]),
      improvements: unique([
        match.missingSkills.length ? 'Add only missing skills you can support with real experience, coursework, or projects.' : '',
        match.gaps.length ? 'Use the most relevant existing bullets to answer each gap directly.' : '',
        match.blockers.length ? 'Treat hard eligibility blockers as decision points; wording changes cannot fix a missing credential or authorization.' : '',
        'Prioritize the two or three strongest role-specific accomplishments near the top of the résumé.',
      ]),
    },
    {
      id: 'requirements',
      name: 'Requirement evidence',
      score: requirementsScore,
      summary: 'Checks whether must-have and preferred requirements are backed by explicit résumé evidence—not just keyword mentions.',
      metrics: [
        { label: 'Supported', score: requirements.length ? clamp((supported.length / requirements.length) * 100) : requirementsScore },
        { label: 'Must-have support', score: supportScore(requirements.filter((item) => item.importance === 'must-have'), requirementsScore) },
        { label: 'Preferred support', score: supportScore(requirements.filter((item) => item.importance === 'preferred'), requirementsScore) },
      ],
      good: unique(supported.map((item) => `${item.requirement}${item.evidence[0] ? ` — ${item.evidence[0].excerpt}` : ''}`)),
      needsWork: unique([
        ...gaps.map((item) => `Gap: ${item.requirement}`),
        ...partial.map((item) => `Partial evidence: ${item.requirement}`),
        ...(!requirements.length ? ['No detailed requirement list was available from the job analysis.'] : []),
      ]),
      improvements: unique([
        gaps.length ? 'For each gap, either add truthful evidence from your background or leave it visible as a genuine limitation.' : '',
        partial.length ? 'Strengthen partial matches with a concrete action, context, tool, and result.' : '',
        'Place proof for must-have requirements before optional or general qualifications.',
      ]),
    },
    {
      id: 'keywords',
      name: 'Keywords and placement',
      score: keywordScore,
      summary: 'Measures exact supported terminology, skill coverage, repetition, and whether important terms appear in high-value sections.',
      metrics: [
        { label: 'Exact keywords', score: readiness.exactKeywordCoverage },
        { label: 'Skill coverage', score: readiness.skillCoverage },
        { label: 'Keyword placement', score: readiness.keywordPlacement },
      ],
      good: unique(readiness.matchedKeywords.map((item) => `Matched: ${item}`)),
      needsWork: unique([
        ...readiness.missingKeywords.map((item) => `Missing: ${item}`),
        ...readiness.repeatedKeywords.map((item) => `Repeated too often: ${item}`),
      ]),
      improvements: unique([
        readiness.improvableKeywords.length ? `Use supported terms naturally: ${readiness.improvableKeywords.slice(0, 6).join(', ')}.` : '',
        readiness.repeatedKeywords.length ? 'Reduce repeated terms and use them only where they add evidence.' : '',
        'Use the job description’s exact wording only when it is true of your background; never keyword-stuff unsupported skills.',
      ]),
    },
    {
      id: 'format',
      name: 'Formatting and parseability',
      score: formatScore,
      summary: `Combines résumé-content hygiene with structural inspection of the uploaded ${inspection.format} file.`,
      metrics: [
        { label: 'Content hygiene', score: readiness.formatHygiene },
        { label: 'File parseability', score: inspection.parseabilityScore },
      ],
      good: unique([
        inspection.structuralIssues.length ? '' : `${inspection.format} text parsed successfully without a detected reading-order risk.`,
        inspection.pageCount ? `Detected ${inspection.pageCount} page${inspection.pageCount === 1 ? '' : 's'}.` : '',
      ]),
      needsWork: unique([...readiness.formatIssues, ...inspection.structuralIssues]),
      improvements: unique([
        inspection.structuralIssues.length ? 'Use a single-column document with body text—not tables, headers, footers, drawings, or text boxes.' : '',
        readiness.formatIssues.length ? 'Keep standard section headings, concise bullets, contact details in the body, and consistent ATS-readable dates.' : '',
        inspection.pageCount && inspection.pageCount > 2 ? 'Shorten the résumé to the most relevant one or two pages for this role.' : '',
      ]),
    },
    {
      id: 'integrity',
      name: 'Claim integrity',
      score: integrityScore,
      summary: 'Checks whether résumé claims, skills, numbers, credentials, and bullets are grounded in extracted source evidence.',
      metrics: [
        { label: 'Verified claims', score: integrityScore },
      ],
      good: unique([
        `${verifiedClaims} of ${checkedClaims} checked claims were grounded in the uploaded résumé.`,
      ]),
      needsWork: unique(claimWarnings),
      improvements: unique([
        claimWarnings.length ? 'Remove or rewrite unsupported claims; preserve only facts that can be traced to the uploaded résumé.' : '',
        'Keep every metric, credential, skill, and level-of-expertise statement verifiable.',
      ]),
    },
  ];

  const combinedScore = clamp(
    readiness.overall * 0.35
    + match.overall * 0.20
    + requirementsScore * 0.15
    + keywordScore * 0.12
    + formatScore * 0.10
    + integrityScore * 0.08,
  );

  return {
    combinedScore,
    targetScore: readiness.targetScore,
    label: scoreLabel(combinedScore),
    job: { title: job.title, company: job.company, location: job.location },
    resume: { name: options.resumeFileName, format: inspection.format, pages: inspection.pageCount },
    models: {
      selected: options.selectedModel,
      profileExtraction: options.profileExtractionModel,
      jobAnalysis: match.model ?? 'deterministic-v3',
    },
    checkers,
    matchedKeywords: readiness.matchedKeywords,
    missingKeywords: readiness.missingKeywords,
    requirements,
    analyzedAt: new Date().toISOString(),
    disclaimer: 'These are internal estimates, not scores from Jobscan, Workday, Greenhouse, Taleo, or another employer ATS. No score can guarantee that a résumé will pass a proprietary screening system.',
  };
}
