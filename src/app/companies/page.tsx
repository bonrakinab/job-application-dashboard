import { CompanyWatchlistClient } from '@/components/CompanyWatchlistClient';
import { filterFortune500Companies } from '@/lib/fortune500';
import { listFortune500CatalogCompanyCounts, listFortune500SourceCoverage } from '@/lib/fortune500-jobs-store';
import { listCompanyWatchlist } from '@/lib/store';

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
    const [watchlist, counts, sourceCoverage] = await Promise.all([
      listCompanyWatchlist(),
      listFortune500CatalogCompanyCounts(),
      listFortune500SourceCoverage(),
    ]);
    const companies = filterFortune500Companies(watchlist);
    const coverage = companies.map((company) => ({
      ...company,
      jobs: counts.get(company.company) ?? 0,
      sourceCoverage: sourceCoverage.get(company.company),
    }));
    const totalJobs = [...counts.values()].reduce((sum, count) => sum + count, 0);
    const mappedCompanies = companies.filter((company) => (sourceCoverage.get(company.company)?.totalSources ?? 0) > 0).length;
    const syncedCompanies = companies.filter((company) => {
      const source = sourceCoverage.get(company.company);
      return Boolean(source && source.totalSources > 0 && source.completedSources === source.totalSources);
    }).length;

    return <>
      <div className="topbar">
        <div>
          <h1 className="title">Fortune 500 companies</h1>
          <div className="sub">All 500 companies. Each card distinguishes live-source coverage from a real zero-opening result, so missing source coverage is never presented as “no jobs.”</div>
        </div>
        <div className="row">
          <a className="btn primary" href="/target-jobs">All current openings</a>
        </div>
      </div>

      <div className="section-head">
        <h2>500 companies · {mappedCompanies} source-mapped · {syncedCompanies} fully synced · {totalJobs.toLocaleString()} current openings</h2>
      </div>
      <CompanyWatchlistClient companies={coverage} />
    </>;
  } catch (error) {
    console.error('companies render failed after database retries', error);
    return <LoadFailure />;
  }
}
