import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyApplicationPackClaims } from './claim-verification';
import type { ApplicationPack, CandidateProfile, Job, MatchScore } from './types';

const profile: CandidateProfile = {
  name: 'Candidate', targetTitles: ['Developer'], preferredLocations: ['Ontario'], skills: ['Python', 'SQL'],
  experience: [{ organization: 'Example Corp', title: 'Analyst', bullets: ['Built Python automation for finance reporting.'] }],
};
const job: Job = {
  externalId: 'job-1', source: 'greenhouse', sourceKey: 'example', url: 'https://example.com/job',
  title: 'Python Developer', company: 'Example', description: 'Build Python services. Kubernetes preferred.',
};
const match: MatchScore = {
  overall: 70, skills: 70, experience: 70, education: 70, domain: 70, location: 70,
  recommendation: 'reasonable', blockers: [], strengths: ['Python'], gaps: ['Kubernetes'], mustHave: ['Python'],
  preferred: ['Kubernetes'], matchedSkills: ['Python'], missingSkills: ['Kubernetes'], explanation: 'Reasonable fit.',
};

function pack(resumeSummary: string): ApplicationPack {
  return {
    summary: 'Pack', resumeHeadline: 'Python Developer', resumeSummary, skills: ['Python'],
    experience: [{ organization: 'Example Corp', title: 'Analyst', bullets: ['Built Python automation for finance reporting.'] }],
    projects: [],
    coverLetter: 'Dear Hiring Manager. I am applying for the Python Developer role at Example. I built Python automation for finance reporting. Sincerely, Candidate.',
    outreachMessage: 'I am interested in the Python Developer role at Example.', interviewThemes: [], claimsAudit: [],
  };
}

const fallback = {
  resumeSummary: 'Python developer with verified automation experience.',
  coverLetter: 'Dear Hiring Manager. I am applying for the Python Developer role at Example. I built Python automation for finance reporting. Sincerely, Candidate.',
  outreachMessage: 'I am interested in the Python Developer role at Example.',
};

test('claim verification preserves supported candidate claims', () => {
  const original = pack('I built Python automation for finance reporting.');
  const verified = verifyApplicationPackClaims(original, fallback, profile, job, match);
  assert.equal(verified.resumeSummary, original.resumeSummary);
  assert.equal(verified.claimVerification?.status, 'pass');
  assert.deepEqual(verified.claimVerification?.replacedFields, []);
});

test('claim verification replaces unsupported metrics and missing skills', () => {
  const verified = verifyApplicationPackClaims(
    pack('I reduced costs by 45% by deploying Kubernetes in production.'),
    fallback,
    profile,
    job,
    match,
  );
  assert.equal(verified.resumeSummary, fallback.resumeSummary);
  assert.deepEqual(verified.claimVerification?.replacedFields, ['resumeSummary']);
  assert.ok(verified.claimVerification?.warnings.some((warning) => /Unsupported/i.test(warning)));
  assert.equal(verified.claimVerification?.status, 'pass');
});

test('claim verification audits rewritten bullets against their exact evidence IDs', () => {
  const original = pack('I built Python automation for finance reporting.');
  original.experience[0] = {
    ...original.experience[0],
    bullets: ['Built SQL automation for finance reporting and improved accuracy by 45%.'],
    bulletEvidence: [['EXP:0:0']],
  };
  const verified = verifyApplicationPackClaims(original, fallback, profile, job, match);
  assert.equal(verified.experience[0].bullets[0], 'Built Python automation for finance reporting.');
  assert.equal(verified.claimVerification?.replacedBullets, 1);
  assert.ok(verified.claimVerification?.warnings.some((warning) => /numeric|specific evidence/i.test(warning)));
  assert.equal(verified.claimVerification?.status, 'pass');
});

test('evidence IDs from another employer cannot move achievements between roles', () => {
  const candidate = { ...profile, experience: [...profile.experience!, { organization: 'Other Employer', title: 'Engineer', bullets: ['Managed Kubernetes deployments for enterprise customers.'] }] };
  const original = pack('I built Python automation for finance reporting.');
  original.experience[0].bullets = ['Managed Kubernetes deployments for enterprise customers.'];
  original.experience[0].bulletEvidence = [['EXP:1:0']];
  const verified = verifyApplicationPackClaims(original, fallback, candidate, job, match);
  assert.equal(verified.experience[0].bullets[0], profile.experience![0].bullets[0]);
  assert.deepEqual(verified.experience[0].bulletEvidence, [['EXP:0:0']]);
});

test('an invented employer and unsupported credential remain review failures', () => {
  const original = pack('I built Python automation for finance reporting.');
  original.experience[0].organization = 'Invented Company';
  original.certifications = ['AWS Certified Solutions Architect'];
  const verified = verifyApplicationPackClaims(original, fallback, profile, job, match);
  assert.equal(verified.claimVerification?.status, 'review');
});
