import { CompanyWatchlistClient } from '@/components/CompanyWatchlistClient';
import { listCompanyWatchlist, listJobs } from '@/lib/store';
import { sameCompany } from '@/lib/target-company-jobs';

export const dynamic = 'force-dynamic';

function LoadFailure() {
  return <>
    <div className="topbar">
      <div>
        <h1 className="title">Target companies</h1>
        <div className="sub">Your company watchlist is temporarily unavailable.</div>
      </div>
      <div className="row"><a className="btn ghost" href="/target-jobs">Target-company jobs →</a></div>
    </div>
    <div className="notice">Please refresh this page in a moment.</div>
    <a className="btn primary" href="/companies">Try again</a>
  </>;
}

export default async function CompaniesPage() {
  try {
    const [companies, jobs] = await Promise.all([listCompanyWatchlist(), listJobs(2000)]);
    const coverage = companies.map((company) => {
      const matchingJobs = jobs.filter((job) => sameCompany(company.company, job.company));
      return {
        ...company,
        jobs: matchingJobs.length,
        recommended: matchingJobs.filter((job) => job.match && ['exceptional', 'strong', 'reasonable'].includes(job.match.recommendation) && !job.match.blockers.length).length,
      };
    });
    return <>
      <div className="topbar">
        <div>
          <h1 className="title">Target companies</h1>
          <div className="sub">Follow employers and open their latest jobs.</div>
        </div>
        <div className="row">
          <a className="btn primary" href="/target-jobs">View company jobs</a>
        </div>
      </div>

      <div className="section-head"><h2>{companies.length} companies</h2></div>
      <CompanyWatchlistClient companies={coverage} />
    </>;
  } catch (error) {
    console.error('companies render failed after database retries', error);
    return <LoadFailure />;
  }
}
