const query = encodeURIComponent('AI Engineer Machine Learning Engineer Data Analyst Software Engineer ERP Analyst Oracle Fusion Oracle ERP Enterprise Applications Intern');
const portals = [
  {
    name: 'Target companies',
    detail: 'Jobs from employers you follow.',
    href: '/target-jobs',
  },
  {
    name: 'LinkedIn',
    detail: 'Search LinkedIn jobs in Canada.',
    href: `https://www.linkedin.com/jobs/search/?keywords=${query}&location=Canada`,
  },
  {
    name: 'Indeed',
    detail: 'Search Indeed jobs in Canada.',
    href: `https://ca.indeed.com/jobs?q=${query}&l=Canada`,
  },
  {
    name: 'Jobicy',
    detail: 'Browse remote jobs.',
    href: `https://jobicy.com/jobs?search_keywords=${query}`,
  },
  {
    name: 'Remotive',
    detail: 'Browse remote Canada jobs.',
    href: 'https://remotive.com/remote-canada-jobs',
  },
  {
    name: 'Himalayas',
    detail: 'Browse remote jobs worldwide.',
    href: 'https://himalayas.app/jobs',
  },
  {
    name: 'We Work Remotely',
    detail: 'Browse remote jobs.',
    href: 'https://weworkremotely.com/',
  },
];

export function PortalSearchPanel() {
  return <div className="portal-grid">
    {portals.map((portal) => <a className="config portal-card" href={portal.href} target={portal.href.startsWith('http') ? '_blank' : undefined} rel={portal.href.startsWith('http') ? 'noreferrer' : undefined} key={portal.name}>
      <b>{portal.name}</b>
      <span>{portal.detail}</span>
    </a>)}
  </div>;
}
