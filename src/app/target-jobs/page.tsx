import { TargetCompanyJobsClient } from '@/components/TargetCompanyJobsClient';
import { JobsNav } from '@/components/JobsNav';
import { getCandidateProfile, listCompanyWatchlist, listJobs } from '@/lib/store';
import { rankTargetCompanyJobs } from '@/lib/target-company-jobs';

export const dynamic = 'force-dynamic';

function LoadFailure() {
  return <>
    <div className="topbar">
      <div>
        <h1 className="title">Target company jobs</h1>
        <div className="sub">These jobs are temporarily unavailable.</div>
      </div>
      <div className="row"><a className="btn ghost" href="/companies">Target companies →</a></div>
    </div>
    <JobsNav />
    <div className="notice">Please refresh this page in a moment.</div>
    <a className="btn primary" href="/target-jobs">Try again</a>
  </>;
}

export default async function TargetCompanyJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; company?: string }>;
}) {
  const params = await searchParams;

  try {
    const [jobs, profile, watchlist] = await Promise.all([
      listJobs(2000),
      getCandidateProfile(),
      listCompanyWatchlist(),
    ]);
    const items = rankTargetCompanyJobs(jobs, watchlist, profile);
    return <>
      <div className="topbar">
        <div>
          <h1 className="title">Target company jobs</h1>
          <div className="sub">Open roles from employers you want to follow.</div>
        </div>
        <div className="row">
          <a className="btn ghost" href="/companies">Manage companies</a>
        </div>
      </div>

      <JobsNav />
      <div className="section-head"><h2>{items.length} job{items.length === 1 ? '' : 's'}</h2></div>

      <TargetCompanyJobsClient
        items={items}
        initialGroup={params.group ?? 'all'}
        initialCompany={params.company ?? 'all'}
      />
    </>;
  } catch (error) {
    console.error('target-jobs render failed after database retries', error);
    return <LoadFailure />;
  }
}
