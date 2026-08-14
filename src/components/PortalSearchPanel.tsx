const query = encodeURIComponent('AI Engineer Machine Learning Engineer Data Analyst Software Engineer ERP Analyst Oracle Fusion Oracle ERP Enterprise Applications Intern');
const erpQuery = encodeURIComponent('Oracle Fusion ERP Oracle Cloud ERP ERP Analyst ERP Consultant Enterprise Applications Oracle Financials Oracle Procurement');

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
    name: 'Remotive',
    status: 'Live import',
    detail: 'Public remote-jobs API; imported listings always link back to Remotive as required by its API terms.',
    href: 'https://remotive.com/remote-canada-jobs',
  },
  {
    name: 'Remote OK',
    status: 'Live import',
    detail: 'Public Remote OK feed is imported, normalized, deduplicated and scored automatically.',
    href: 'https://remoteok.com/',
  },
  {
    name: 'Himalayas',
    status: 'Live import',
    detail: 'Public Himalayas jobs API is imported for Canada and worldwide-compatible remote roles, including Oracle and ERP searches.',
    href: 'https://himalayas.app/jobs',
  },
  {
    name: 'We Work Remotely',
    status: 'Live import',
    detail: 'Official public RSS feed is imported with source attribution and applications routed through the original WWR listing.',
    href: 'https://weworkremotely.com/',
  },
  {
    name: 'StillHiring.today',
    status: 'Hiring signal',
    detail: 'Company-level hiring signal. Use it to identify active employers, then import jobs from their public career or ATS pages; no private Airtable scraping.',
    href: 'https://stillhiring.today/',
  },
  {
    name: 'LinkedIn',
    status: 'Portal search',
    detail: 'Direct broad search link. We do not use logged-in scraping or pretend LinkedIn offers a public job-search API.',
    href: `https://www.linkedin.com/jobs/search/?keywords=${query}&location=Canada`,
  },
  {
    name: 'LinkedIn · Oracle / ERP',
    status: 'ERP focus',
    detail: 'Direct Canada search for Oracle Fusion, Oracle Cloud ERP, ERP analyst/consultant and enterprise-application roles.',
    href: `https://www.linkedin.com/jobs/search/?keywords=${erpQuery}&location=Canada`,
  },
  {
    name: 'Indeed',
    status: 'Portal search',
    detail: 'Direct Canada search link; official Indeed APIs are partner/employer oriented rather than a public search feed.',
    href: `https://ca.indeed.com/jobs?q=${query}&l=Canada`,
  },
  {
    name: 'Indeed · Oracle / ERP',
    status: 'ERP focus',
    detail: 'Direct Canada search for Oracle Fusion ERP, Financials, Procurement, ERP analyst and implementation roles.',
    href: `https://ca.indeed.com/jobs?q=${erpQuery}&l=Canada`,
  },
  {
    name: 'Monster',
    status: 'Portal search',
    detail: 'Direct Canada search link for additional listings outside company ATS feeds.',
    href: `https://www.monster.ca/jobs/search?q=${query}&where=Canada`,
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
