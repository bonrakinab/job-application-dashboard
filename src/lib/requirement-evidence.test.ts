import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRequirementEvidenceMatrix } from './requirement-evidence';
import type { CandidateProfile, Job, MatchScore } from './types';

const profile: CandidateProfile = {
  name: 'Candidate', targetTitles: ['Software Developer'], preferredLocations: ['Ontario'], skills: ['Python', 'SQL', 'Power BI'], yearsExperience: 2,
  experience: [{ organization: 'Example Corp', title: 'Systems Analyst', bullets: ['Built Python automation and SQL reports for finance stakeholders.'], skills: ['Python', 'SQL'] }],
  projects: [{ name: 'Analytics Dashboard', description: 'Created a reporting dashboard for operational analysis.', bullets: ['Developed Power BI dashboards for monthly reporting.'], skills: ['Power BI'] }],
};

const job: Job = { externalId: 'job-1', source: 'greenhouse', sourceKey: 'example', url: 'https://example.com/job', title: 'Python Developer', company: 'Example', description: 'Python, SQL, Kubernetes and five years of experience.' };

const match: MatchScore = {
  overall: 58, skills: 65, experience: 45, education: 70, domain: 60, location: 90, recommendation: 'stretch', blockers: [], strengths: ['Python'], gaps: ['Kubernetes', '5 years of experience'],
  mustHave: ['Python development', '5 years of experience', 'Kubernetes'], preferred: ['Power BI reporting'], matchedSkills: ['Python', 'Power BI'], missingSkills: ['Kubernetes'], explanation: 'Mixed fit.',
};

test('requirement matrix distinguishes supported evidence from real gaps', () => {
  const matrix = buildRequirementEvidenceMatrix(job, profile, match);
  assert.equal(matrix.find((item) => item.requirement === 'Python development')?.support, 'supported');
  assert.equal(matrix.find((item) => item.requirement === 'Power BI reporting')?.support, 'supported');
  assert.equal(matrix.find((item) => item.requirement === '5 years of experience')?.support, 'gap');
  assert.equal(matrix.find((item) => item.requirement === 'Kubernetes')?.support, 'gap');
  assert.equal(matrix.find((item) => item.requirement === '5 years of experience')?.category, 'experience');
  assert.equal(matrix.find((item) => item.requirement === 'Power BI reporting')?.category, 'tool');
  assert.deepEqual(matrix.find((item) => item.requirement === 'Power BI reporting')?.exactTerms, ['Power BI']);
  assert.match(matrix.find((item) => item.requirement === 'Python development')?.evidence[0]?.excerpt ?? '', /Python/i);
});

test('requirement matrix never attaches evidence to a gap', () => {
  const matrix = buildRequirementEvidenceMatrix(job, profile, match);
  assert.deepEqual(matrix.filter((item) => item.support === 'gap').flatMap((item) => item.evidence), []);
});

test('related tools, total tenure, and a lower degree cannot satisfy specific must-haves', () => {
  const candidate = { ...profile, skills: ['JavaScript', 'Docker', 'AWS'], yearsExperience: 8,
    degrees: [{ institution: 'Example University', degree: 'Bachelor of Science', field: 'Computer Science', end: '2020' }],
    experience: [{ organization: 'Example', title: 'Developer', bullets: ['Developed JavaScript applications using Docker.'], skills: ['JavaScript', 'Docker'] }],
  };
  const requirements = ['Java', 'Kubernetes container development', '5 years of Python experience', 'PhD degree in Computer Science', 'AWS certification'];
  const matrix = buildRequirementEvidenceMatrix(job, candidate, { ...match, mustHave: requirements, preferred: [], missingSkills: ['Java', 'Kubernetes', 'Python'] });
  assert.ok(matrix.every((item) => item.support !== 'supported'), JSON.stringify(matrix));
  assert.equal(matrix.find((item) => item.requirement === 'AWS certification')?.category, 'certification');
});

test('literal JD requirements are extracted when AI analysis has no requirements', () => {
  const candidate: CandidateProfile = { ...profile, skills: ['Oracle Fusion ERP Cloud', 'SQL'], experience: [{ organization: 'Example Corp', title: 'ERP Analyst', bullets: ['Coordinated with finance stakeholders and gathered business requirements for Oracle ERP changes.'], skills: ['Oracle Fusion ERP Cloud'] }] };
  const fallbackJob: Job = { ...job, source: 'himalayas', title: 'Oracle ERP Analyst', description: ['Requirements', '- Stakeholder management for financial systems and ERP changes.', '- Coordinate requirements gathering with finance teams.', '- Kubernetes administration for production workloads.', 'We are an equal opportunity employer.'].join('\n') };
  const deterministicMatch: MatchScore = { ...match, mustHave: [], preferred: [], matchedSkills: [], missingSkills: [], gaps: [], model: 'deterministic-v3' };
  const matrix = buildRequirementEvidenceMatrix(fallbackJob, candidate, deterministicMatch);
  assert.ok(matrix.length >= 3, JSON.stringify(matrix));
  assert.equal(matrix.find((item) => /stakeholder management/i.test(item.requirement))?.support, 'supported');
  assert.equal(matrix.find((item) => /requirements gathering/i.test(item.requirement))?.support, 'supported');
  assert.equal(matrix.find((item) => /kubernetes/i.test(item.requirement))?.support, 'gap');
  assert.ok(!matrix.some((item) => /equal opportunity/i.test(item.requirement)));
});

test('generic financial documentation cannot satisfy enterprise architecture or solution design', () => {
  const candidate: CandidateProfile = {
    ...profile,
    skills: ['Oracle Fusion ERP Cloud', 'Jira', 'Confluence'],
    experience: [{
      organization: 'Example Telecom', title: 'ERP Specialist',
      bullets: ['Supported Oracle Fusion ERP financial workflows and maintained vendor and financial documentation.'],
      skills: ['Oracle Fusion ERP Cloud', 'Jira', 'Confluence'],
    }],
  };
  const architectureMatch: MatchScore = {
    ...match, mustHave: [], preferred: ['Familiarity with enterprise architecture frameworks and solution design documentation'],
    matchedSkills: ['Oracle Fusion ERP Cloud'], missingSkills: [], gaps: [],
  };
  const matrix = buildRequirementEvidenceMatrix(job, candidate, architectureMatch);
  assert.notEqual(matrix[0]?.support, 'supported', JSON.stringify(matrix[0]));
});
