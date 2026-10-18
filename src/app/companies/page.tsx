import { CompanyWatchlistClient } from '@/components/CompanyWatchlistClient';
import { filterFortune500Companies } from '@/lib/fortune500';
import { jobsForFortune500Catalog } from '@/lib/fortune500-catalog';
import { listCompleteCareerJobs } from '@/lib/fortune500-jobs-store';
import { getCandidateProfile, listCompanyWatchlist } from '@/lib/store';
import { rankTargetCompanyJobs } from '@/lib/target-company-jobs';

export const dynamic = 'force-dynamic';

function hasCompletedScan(sourceMetadata?: Record<string, unknown>) {
  const catalog = sourceMetadata?.verified_source_catalog;
  if (catalog && typeof catalog === 'object') {
    const verifiedAt = (catalog as Record<string, unknown>).verified_at;
    if (typeof verifiedAt === 'string' && verifiedAt.length > 0) return true;
  }
  const value = sourceMetadata?.fortune500_scan;
  if (!value || typeof value !== 'object') return false;
  const checkedAt = (value as Record<string, unknown>).last_checked_at;
  return typeof checkedAt === 'string' && checkedAt.length > 0;
}

function isCurrentJob(job: { validityStatus?: string }) {
  return !['closed', 'likely_closed'].includes(job.validityStatus ?? 'unknown');
}

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
      listCompleteCareerJobs(),
      getCandidateProfile(),
    ]);
    const companies = filterFortune500Companies(watchlist);
    const currentJobs = jobsForFortune500Catalog(allJobs).filter(isCurrentJob);
    const opportunities = rankTargetCompanyJobs(currentJobs, companies, profile);
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
    const checkedCompanies = companies.filter((company) => hasCompletedScan(company.sourceMetadata)).length;

    return <>
      <div className="topbar">
        <div>
          <h1 className="title">Fortune 500 companies</h1>
          <div className="sub">All 500 companies. Opening counts come from the live Fortune catalog; unverified companies stay marked as pending rather than showing a false zero.</div>
        </div>
        <div className="row">
          <a className="btn primary" href="/target-jobs?fit=all">All current openings</a>
          <a className="btn ghost" href="/target-jobs?fit=recommended">Recommended</a>
        </div>
      </div>

      <div className="section-head">
        <h2>500 companies · {checkedCompanies} source-verified · {totalJobs} current openings · {recommendedJobs} recommended</h2>
      </div>
      <CompanyWatchlistClient companies={coverage} />
    </>;
  } catch (error) {
    console.error('companies render failed after database retries', error);
    return <LoadFailure />;
  }
}
