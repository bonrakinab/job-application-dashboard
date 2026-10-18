import { CompanyWatchlistClient } from '@/components/CompanyWatchlistClient';
import { filterFortune500Companies } from '@/lib/fortune500';
import { isMainCareerJob } from '@/lib/part-time-jobs';
import { getCandidateProfile, listCompanyWatchlist, listJobs } from '@/lib/store';
import { rankTargetCompanyJobs } from '@/lib/target-company-jobs';

export const dynamic = 'force-dynamic';

function LoadFailure() {
  return <>
    <div className="topbar">
      <div>
        <h1 className="title">Fortune 500 companies</h1>
        <div className="sub">The Fortune 500 company list is temporarily unavailable.</div>
      </div>
      <div className="row"><a className="btn ghost" href="/target-jobs">Fortune 500 jobs →</a></div>
    </div>
    <div className="notice">Please refresh this page in a moment.</div>
    <a className="btn primary" href="/companies">Try again</a>
  </>;
}

export default async function CompaniesPage() {
  try {
    const [watchlist, allJobs, profile] = await Promise.all([
      listCompanyWatchlist(),
      listJobs(2000),
      getCandidateProfile(),
    ]);
    const companies = filterFortune500Companies(watchlist);
    const opportunities = rankTargetCompanyJobs(allJobs.filter(isMainCareerJob), companies, profile);
    const byCompany = new Map<string, typeof opportunities>();
    for (const item of opportunities) {
      byCompany.set(item.watchedCompany, [...(byCompany.get(item.watchedCompany) ?? []), item]);
    }
    const coverage = companies.map((company) => {
      const matching = byCompany.get(company.company) ?? [];
      return {
        ...company,
        jobs: matching.length,
        recommended: matching.filter((item) => item.recommended).length,
      };
    });
    const totalJobs = opportunities.length;
    const recommendedJobs = opportunities.filter((item) => item.recommended).length;

    return <>
      <div className="topbar">
        <div>
          <h1 className="title">Fortune 500 companies</h1>
          <div className="sub">All 500 companies, ordered by 2026 Fortune rank.</div>
        </div>
        <div className="row">
          <a className="btn primary" href="/target-jobs?fit=recommended">Recommended jobs</a>
          <a className="btn ghost" href="/target-jobs?fit=all">All Fortune 500 jobs</a>
        </div>
      </div>

      <div className="section-head">
        <h2>500 companies · {totalJobs} open jobs · {recommendedJobs} recommended</h2>
      </div>
      <CompanyWatchlistClient companies={coverage} />
    </>;
  } catch (error) {
    console.error('companies render failed after database retries', error);
    return <LoadFailure />;
  }
}
