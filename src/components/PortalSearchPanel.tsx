const query = encodeURIComponent('AI Engineer Machine Learning Engineer Data Analyst ERP Analyst Software Engineer Intern');

const portals = [
  {
    name: 'Company career sites',
    status: 'Live import',
    detail: 'Greenhouse, Lever and Ashby company boards are imported and scored automatically.',
    href: '/',
  },
  {
    name: 'Jobicy',
    status: 'Live import',
    detail: 'Public remote-jobs API; Canada listings are imported without an extra API key.',
    href: `https://jobicy.com/jobs?search_keywords=${query}`,
  },
  {
    name: 'LinkedIn',
    status: 'Portal search',
    detail: 'Direct search link. We do not use logged-in scraping or pretend LinkedIn offers a public job-search API.',
    href: `https://www.linkedin.com/jobs/search/?keywords=${query}&location=Canada`,
  },
  {
    name: 'Indeed',
    status: 'Portal search',
    detail: 'Direct Canada search link; official Indeed APIs are partner/employer oriented rather than a public search feed.',
    href: `https://ca.indeed.com/jobs?q=${query}&l=Canada`,
  },
  {
    name: 'Monster',
    status: 'Portal search',
    detail: 'Direct Canada search link for additional listings outside company ATS feeds.',
    href: `https://www.monster.ca/jobs/search?q=${query}&where=Canada`,
  },
  {
    name: 'Wellfound',
    status: 'Portal search',
    detail: 'Startup-focused source, useful for software, AI, data and early-career roles.',
    href: 'https://wellfound.com/jobs',
  },
];

export function PortalSearchPanel() {
  return <div className="portal-grid">
    {portals.map((portal) => <a className="config portal-card" href={portal.href} target={portal.href.startsWith('http') ? '_blank' : undefined} rel={portal.href.startsWith('http') ? 'noreferrer' : undefined} key={portal.name}>
      <b>{portal.name}</b>
      <span className="portal-status">{portal.status}</span>
      <span>{portal.detail}</span>
    </a>)}
  </div>;
}
