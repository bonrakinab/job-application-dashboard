import { TargetCompanyJobsClient } from '@/components/TargetCompanyJobsClient';
import { JobsNav } from '@/components/JobsNav';
import { filterFortune500Companies } from '@/lib/fortune500';
import { listCompleteCareerJobs } from '@/lib/fortune500-jobs-store';
import { isMainCareerJob } from '@/lib/part-time-jobs';
import { getCandidateProfile, listCompanyWatchlist } from '@/lib/store';
import { rankTargetCompanyJobs } from '@/lib/target-company-jobs';

export const dynamic = 'force-dynamic';

function isCurrentJob(job: { validityStatus?: string }) {
  return !['closed', 'likely_closed'].includes(job.validityStatus ?? 'unknown');
}

function LoadFailure() {
  return <>
    <div className="topbar">
      <div>
        <h1 className="title">Fortune 500 jobs</h1>
        <div className="sub">These jobs are temporarily unavailable.</div>
      </div>
      <div className="row"><a className="btn ghost" href="/companies">Fortune 500 companies →</a></div>
    </div>
    <JobsNav />
    <div className="notice">Please refresh this page in a moment.</div>
    <a className="btn primary" href="/target-jobs">Try again</a>
  </>;
}

export default async function TargetCompanyJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; fit?: string }>;
}) {
  const params = await searchParams;

  try {
    const [jobs, profile, watchlist] = await Promise.all([
      listCompleteCareerJobs(),
      getCandidateProfile(),
      listCompanyWatchlist(),
    ]);
    const fortune500Companies = filterFortune500Companies(watchlist);
    const currentJobs = jobs.filter(isMainCareerJob).filter(isCurrentJob);
    const items = rankTargetCompanyJobs(currentJobs, fortune500Companies, profile);
    const recommended = items.filter((item) => item.recommended).length;

    return <>
      <div className="topbar">
        <div>
          <h1 className="title">Fortune 500 jobs</h1>
          <div className="sub">Current Ontario/Canada openings from Fortune 500 employers, with newest verified postings first.</div>
        </div>
        <div className="row">
          <a className="btn ghost" href="/companies">Fortune 500 companies</a>
        </div>
      </div>

      <JobsNav />
      <div className="section-head"><h2>{items.length} current openings · {recommended} recommended</h2></div>

      <TargetCompanyJobsClient
        items={items}
        initialCompany={params.company ?? 'all'}
        initialFit={params.fit ?? 'all'}
      />
    </>;
  } catch (error) {
    console.error('target-jobs render failed after database retries', error);
    return <LoadFailure />;
  }
}
