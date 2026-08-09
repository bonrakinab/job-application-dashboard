import type { CandidateProfile, JobWithMatch } from './types';

export const demoProfile: CandidateProfile = {
  name: 'Candidate',
  headline: 'AI / ML candidate',
  location: 'Ontario, Canada',
  targetTitles: ['AI Engineer', 'Machine Learning Engineer', 'Data Scientist', 'Solutions Engineer'],
  preferredLocations: ['Canada', 'Ontario', 'Toronto', 'Windsor', 'Remote'],
  skills: ['Python', 'SQL', 'Machine Learning', 'Deep Learning', 'Cloud', 'LLM'],
  yearsExperience: 2,
  degrees: [{ institution: 'University', degree: 'MSc', field: 'Computer Science' }],
  experience: [],
  projects: [],
};

export const demoJobs: JobWithMatch[] = [
  {
    id: 'demo-1', externalId: '1', source: 'ashby', sourceKey: 'demo', url: '#', applyUrl: '#', title: 'AI Engineer', company: 'Northstar AI', location: 'Toronto, Canada', description: '&lt;p&gt;Build machine learning systems with Python, SQL and cloud LLM tooling.&lt;/p&gt;&lt;h3&gt;Our ideal candidate&lt;/h3&gt;&lt;ul&gt;&lt;li&gt;Hands-on experience with Python, SQL and machine learning&lt;/li&gt;&lt;li&gt;Comfortable with cloud platforms and LLM systems&lt;/li&gt;&lt;/ul&gt;', remote: false,
    postedAt: new Date(Date.now() - 3 * 3600_000).toISOString(), discoveredAt: new Date().toISOString(),
    match: { overall: 93, skills: 96, experience: 84, education: 95, domain: 94, location: 100, recommendation: 'exceptional', blockers: [], strengths: ['Python','Machine Learning','SQL','Cloud'], gaps: ['Kubernetes'], mustHave: ['Python','ML'], preferred: ['Kubernetes'], matchedSkills: ['Python','SQL','Machine Learning','Cloud','LLM'], missingSkills: ['Kubernetes'], explanation: 'Strong overlap with configured AI/ML profile.', model: 'demo' },
    application: { jobId: 'demo-1', status: 'reviewing' },
  },
  {
    id: 'demo-2', externalId: '2', source: 'lever', sourceKey: 'demo', url: '#', applyUrl: '#', title: 'Machine Learning Engineer', company: 'Maple Analytics', location: 'Remote Canada', description: 'Build ML systems with Python and SQL.', remote: true,
    postedAt: new Date(Date.now() - 8 * 3600_000).toISOString(), discoveredAt: new Date().toISOString(),
    match: { overall: 87, skills: 90, experience: 78, education: 90, domain: 88, location: 100, recommendation: 'strong', blockers: [], strengths: ['Python','SQL','Machine Learning'], gaps: ['MLOps'], mustHave: ['Python','ML'], preferred: ['MLOps'], matchedSkills: ['Python','SQL','Machine Learning'], missingSkills: ['MLOps'], explanation: 'Strong role and location match.', model: 'demo' },
    application: { jobId: 'demo-2', status: 'discovered' },
  },
  {
    id: 'demo-3', externalId: '3', source: 'greenhouse', sourceKey: 'demo', url: '#', applyUrl: '#', title: 'Principal ML Engineer', company: 'Restricted Systems', location: 'United States', description: 'Principal role. Active security clearance required.', remote: false,
    postedAt: new Date(Date.now() - 12 * 3600_000).toISOString(), discoveredAt: new Date().toISOString(),
    match: { overall: 49, skills: 84, experience: 55, education: 90, domain: 80, location: 20, recommendation: 'skip', blockers: ['Requires an active security clearance.','Role seniority appears materially above the configured experience level.'], strengths: ['Python'], gaps: [], mustHave: [], preferred: [], matchedSkills: ['Python'], missingSkills: [], explanation: 'Hard eligibility blocker overrides semantic relevance.', model: 'demo' },
    application: { jobId: 'demo-3', status: 'discovered' },
  },
];
