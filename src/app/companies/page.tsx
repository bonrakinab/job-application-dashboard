import { CompanyWatchlistClient } from '@/components/CompanyWatchlistClient';
import { listCompanyWatchlist, listJobs } from '@/lib/store';
import { sameCompany } from '@/lib/target-company-jobs';

export const dynamic = 'force-dynamic';

export default async function CompaniesPage() {
  const [companies, jobs] = await Promise.all([listCompanyWatchlist(), listJobs(2000)]);
  const coverage = companies.map((company) => {
    const matchingJobs = jobs.filter((job) => sameCompany(company.company, job.company));
    return {
      ...company,
      jobs: matchingJobs.length,
      recommended: matchingJobs.filter((job) => job.match && ['exceptional', 'strong', 'reasonable'].includes(job.match.recommendation) && !job.match.blockers.length).length,
    };
  });
  const liveCompanies = coverage.filter((company) => company.jobs > 0).length;
  const tierOne = coverage.filter((company) => company.priority === 1).length;

  return <>
    <div className="topbar">
      <div>
        <div className="eyebrow">Employer coverage</div>
        <h1 className="title">Target companies</h1>
        <div className="sub">A broad Canada-focused employer watchlist organized into overlapping groups such as MANG, FAANG/MAANG, Magnificent Seven, Fortune 5, Big Four, global IT/service-based companies, enterprise software & cloud, AI leaders and major Canadian employer groups.</div>
      </div>
      <div className="row">
        <a className="btn primary" href="/target-jobs">View target-company jobs →</a>
        <a className="btn ghost" href="/recommended">Recommended jobs →</a>
      </div>
    </div>

    <div className="grid recommendation-metrics">
      <div className="metric"><div className="label">Target employers</div><div className="value">{companies.length}</div></div>
      <div className="metric"><div className="label">Tier 1</div><div className="value">{tierOne}</div></div>
      <div className="metric"><div className="label">With live jobs</div><div className="value">{liveCompanies}</div></div>
      <div className="metric"><div className="label">Jobs in database</div><div className="value">{jobs.length}</div></div>
    </div>

    <div className="notice">Company groups now open their actual target-job feed. Automated coverage uses public company career/ATS endpoints such as Greenhouse, Lever, Ashby, Workday and Amazon Jobs; no logged-in job-portal account is scraped.</div>

    <CompanyWatchlistClient companies={coverage} />
  </>;
}
