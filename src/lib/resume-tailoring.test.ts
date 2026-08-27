import test from 'node:test';
import assert from 'node:assert/strict';
import type { CandidateProfile, Job } from './types';
import {
  APPLICATION_PACK_TAILORING_VERSION,
  RESUME_TEMPLATE_VERSION,
  applicationPackStaleness,
  attachApplicationPackGenerationMeta,
  deterministicTailoringPlan,
  materializeApplicationPack,
  type ApplicationPackPlan,
} from './resume-tailoring';
import { resumePdf } from './pdf';
import { profileWithTailoredCourseworkForResume } from './education-tailoring';

const profile: CandidateProfile = {
  name: 'Arnob Banik',
  email: 'arnob@example.com',
  phone: '+1 555 0100',
  location: 'Windsor, Ontario, Canada',
  links: { linkedin: 'https://linkedin.com/in/example', github: 'https://github.com/example', portfolio: 'https://example.com' },
  headline: 'MSc Computer Science (AI)',
  summary: 'Technical professional with enterprise IT, full-stack software development, and applied AI experience.',
  targetTitles: ['Software Engineer', 'Machine Learning Engineer', 'Oracle ERP Analyst'],
  preferredLocations: ['Canada'],
  skills: ['Python', 'TypeScript', 'JavaScript', 'SQL', 'Next.js', 'React', 'REST APIs', 'PostgreSQL', 'Supabase', 'Machine Learning', 'BERT', 'CLIP', 'HNSW', 'Oracle Fusion ERP Cloud', 'JIRA', 'ISO 27001'],
  skillGroups: [
    { label: 'Languages', skills: ['Python', 'TypeScript', 'JavaScript', 'SQL'] },
    { label: 'Full-Stack & APIs', skills: ['Next.js', 'React', 'REST APIs'] },
    { label: 'Data & Backend', skills: ['PostgreSQL', 'Supabase'] },
    { label: 'Applied AI & ML', skills: ['Machine Learning', 'BERT', 'CLIP', 'HNSW'] },
    { label: 'Cloud, DevOps & Enterprise', skills: ['Oracle Fusion ERP Cloud', 'JIRA', 'ISO 27001'] },
  ],
  degrees: [{ institution: 'University of Windsor', degree: 'Master of Science in Computer Science', field: 'Artificial Intelligence Specialization', start: 'Sept 2024', end: 'Aug 2026 (Expected)', location: 'Windsor, Ontario, Canada' }],
  experience: [
    {
      organization: 'Banglalink', title: 'Enterprise Solutions and Services Specialist Engineer, IT', start: 'Sept 2023', end: 'June 2024', location: 'Dhaka, Bangladesh', skills: ['Oracle Fusion ERP Cloud', 'JIRA', 'ISO 27001'],
      bullets: [
        'Consolidated approximately 15,000 Oracle ERP tax conditions into 460 maintainable rules.',
        'Supported Oracle Fusion ERP Cloud Financials and Procurement workflows.',
        'Prepared ISO 27001 audit artifacts across risk management and access control.',
      ],
    },
    {
      organization: 'GAOTek Inc.', title: 'Software Development Intern - Team Leader', start: 'Dec 2022', end: 'March 2023', location: 'Remote', skills: ['JavaScript'],
      bullets: ['Led a remote intern team delivering web application components in JavaScript and coordinating defect resolution.'],
    },
  ],
  projects: [
    {
      name: 'Flowdesk - Full-Stack Family CRM', description: 'Production family CRM.', skills: ['Next.js', 'React', 'TypeScript', 'PostgreSQL', 'REST APIs'], linkLabel: 'Live',
      bullets: ['Designed and shipped a production household CRM with authenticated API routes and multi-user data isolation.', 'Built task, calendar, finance, medication, and notification workflows.'],
    },
    {
      name: 'MSc Thesis - Color-Aware Composed Image Retrieval', description: 'Efficient multimodal retrieval research.', skills: ['Python', 'Machine Learning', 'CLIP', 'HNSW'],
      bullets: ['Developed a color-aware composed image retrieval framework using CLIP and HNSW.', 'Evaluated prefiltering and postfiltering designs using retrieval-efficiency measures.'],
    },
    {
      name: 'Phishing URL Detection Using Artificial Intelligence', description: 'BERT and ML phishing detection.', skills: ['Python', 'Machine Learning', 'BERT'],
      bullets: ['Trained machine-learning and BERT-family models for phishing URL detection.'],
    },
  ],
  certifications: ['Google IT Support', 'Oracle Cloud Infrastructure Foundations'],
};

function job(title: string, description: string): Job {
  return { externalId: title, source: 'test', sourceKey: 'test', url: 'https://example.com', title, company: 'Example', location: 'Canada', description };
}

const softwareJob = job('Software Engineer', 'Build production web applications with TypeScript, Next.js, React, REST APIs and PostgreSQL.');
const mlJob = job('Machine Learning Engineer', 'Develop Python machine learning systems using BERT, vector search, CLIP and HNSW.');
const erpJob = job('Oracle ERP Analyst', 'Support Oracle Fusion ERP Cloud Financials and Procurement, JIRA workflows, access controls and ISO 27001 documentation.');

test('deterministic evidence ranking changes materially with the JD', () => {
  const software = deterministicTailoringPlan(softwareJob, profile);
  const ml = deterministicTailoringPlan(mlJob, profile);
  const erp = deterministicTailoringPlan(erpJob, profile);

  assert.ok(software.skills.slice(0, 10).includes('TypeScript'));
  assert.ok(software.skills.slice(0, 10).includes('Next.js'));
  assert.equal(software.projects[0]?.name, 'Flowdesk - Full-Stack Family CRM');

  assert.ok(ml.skills.slice(0, 10).includes('Machine Learning'));
  assert.ok(ml.skills.slice(0, 10).includes('BERT'));
  assert.equal(ml.projects[0]?.name, 'MSc Thesis - Color-Aware Composed Image Retrieval');

  assert.ok(erp.skills.slice(0, 10).includes('Oracle Fusion ERP Cloud'));
  assert.ok(erp.skills.slice(0, 10).includes('ISO 27001'));
  assert.notDeepEqual(software.skills.slice(0, 8), ml.skills.slice(0, 8));
  assert.notDeepEqual(ml.skills.slice(0, 8), erp.skills.slice(0, 8));
});

test('materializer rejects invented skills, invented evidence IDs, and completed-degree wording', () => {
  const plan: ApplicationPackPlan = {
    summary: 'software pack',
    resumeHeadline: 'Software Engineer | Kubernetes',
    resumeSummary: 'MSc Computer Science graduate with Kubernetes and TypeScript experience.',
    skills: ['TypeScript', 'Kubernetes', 'Next.js'],
    experience: [{ organization: 'GAOTek Inc.', title: 'Software Development Intern - Team Leader', evidenceIds: ['EXP:99:99'] }],
    projects: [{ name: 'Flowdesk - Full-Stack Family CRM', evidenceIds: ['PROJ:0:0'] }],
    coverLetter: 'Dear Hiring Manager, I am an MSc graduate with Kubernetes experience and would like to join your software team. Thank you for considering my application. Sincerely, Arnob Banik',
    outreachMessage: 'MSc graduate with Kubernetes experience interested in the role.',
    interviewThemes: ['TypeScript application development'],
    claimsAudit: [{ claim: 'Built Kubernetes systems.', evidenceIds: ['PROJ:99:1'] }],
  };
  const pack = materializeApplicationPack(plan, profile, softwareJob);

  assert.ok(pack.skills.includes('TypeScript'));
  assert.ok(pack.skills.includes('Next.js'));
  assert.ok(!pack.skills.includes('Kubernetes'));
  assert.ok(!/graduate/i.test(pack.resumeSummary));
  assert.ok(!/kubernetes/i.test(pack.resumeSummary));
  assert.ok(!/kubernetes/i.test(pack.coverLetter));
  assert.deepEqual(pack.projects[0]?.bullets, ['Designed and shipped a production household CRM with authenticated API routes and multi-user data isolation.']);
  assert.equal(pack.claimsAudit.length, 0);
  assert.ok(pack.experience.find((item) => item.organization === 'GAOTek Inc.')?.bullets.length);
});

test('pack versions mark old profile/template generations as stale', () => {
  const base = materializeApplicationPack(deterministicTailoringPlan(softwareJob, profile), profile, softwareJob);
  assert.equal(applicationPackStaleness(base, '2026-08-09T06:24:00Z').stale, true);

  const current = attachApplicationPackGenerationMeta(base, {
    model: 'gpt-5.6-sol', provider: 'openai', profileUpdatedAt: '2026-08-09T06:24:00Z', generatedAt: '2026-08-09T07:00:00Z',
  });
  assert.equal(current.generationMeta?.tailoringVersion, APPLICATION_PACK_TAILORING_VERSION);
  assert.equal(current.generationMeta?.templateVersion, RESUME_TEMPLATE_VERSION);
  assert.equal(applicationPackStaleness(current, '2026-08-09T06:24:00Z').stale, false);
  assert.equal(applicationPackStaleness(current, '2026-08-09T08:00:00Z').stale, true);
});

test('resume PDF preserves the reference-template section order on one page', () => {
  const pack = materializeApplicationPack(deterministicTailoringPlan(softwareJob, profile), profile, softwareJob);
  const pdfText = resumePdf(profile, softwareJob, pack).toString('utf8');
  const sections = ['PROFESSIONAL SUMMARY', 'EXPERIENCE', 'SKILLS', 'PROJECTS', 'EDUCATION', 'CERTIFICATIONS'];
  const positions = sections.map((section) => pdfText.indexOf(section));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  assert.equal((pdfText.match(/\/Type \/Page\b/g) ?? []).length, 1);
  assert.doesNotMatch(pdfText, /Tailored for/);
});

test('LinkedIn-expanded profiles are capped to a one-page set of employer-facing evidence', () => {
  const expanded: CandidateProfile = {
    ...profile,
    experience: Array.from({ length: 14 }, (_, index) => ({
      organization: `Organization ${index + 1}`,
      title: index < 5 ? 'Software Developer' : 'Volunteer',
      bullets: [`Built TypeScript software workflow ${index + 1}.`],
      skills: index < 5 ? ['TypeScript'] : [],
    })),
    degrees: [
      ...(profile.degrees ?? []),
      { institution: 'Vellore Institute of Technology', degree: 'Bachelor of Technology', field: 'Computer Science' },
      { institution: 'School', degree: 'O-Levels and A-Levels' },
    ],
    certifications: Array.from({ length: 24 }, (_, index) => index === 0
      ? 'AWS Academy Graduate - AWS Academy Cloud Foundations'
      : `Unrelated Certificate ${index}`),
  };
  const plan = deterministicTailoringPlan(softwareJob, expanded);
  const pack = materializeApplicationPack(plan, expanded, softwareJob);
  const renderedProfile = profileWithTailoredCourseworkForResume(expanded, pack);

  assert.ok(pack.experience.length <= 4);
  assert.ok((pack.certifications ?? []).length <= 3);
  assert.ok((renderedProfile.degrees ?? []).length <= 2);
  const pdf = resumePdf(renderedProfile, softwareJob, pack).toString('utf8');
  assert.equal((pdf.match(/\/Type \/Page\b/g) ?? []).length, 1);
});
