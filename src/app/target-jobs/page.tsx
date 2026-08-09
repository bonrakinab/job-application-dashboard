import { TargetCompanyJobsClient } from '@/components/TargetCompanyJobsClient';
import { getCandidateProfile, listCompanyWatchlist, listJobs } from '@/lib/store';
import { rankTargetCompanyJobs } from '@/lib/target-company-jobs';

export const dynamic = 'force-dynamic';

function LoadFailure() {
  return <>
    <div className="topbar">
      <div>
        <div className="eyebrow">Watched employers · profile-ranked</div>
        <h1 className="title">Target company jobs</h1>
        <div className="sub">The job data service did not respond reliably enough to render this request.</div>
      </div>
      <div className="row"><a className="btn ghost" href="/companies">Target companies →</a></div>
    </div>
    <div className="notice">Job data is temporarily unavailable. The app already retried the database request automatically; refresh this page in a moment. No application or profile data was changed.</div>
    <a className="btn primary" href="/target-jobs">Retry target-company jobs →</a>
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
    const best = items.filter((item) => item.recommended).length;
    const highlySuitable = items.filter((item) => item.highlySuitable).length;
    const internships = items.filter((item) => item.stage === 'internship').length;
    const employersWithJobs = new Set(items.map((item) => item.watchedCompany)).size;

    return <>
      <div className="topbar">
        <div>
          <div className="eyebrow">Watched employers · profile-ranked</div>
          <h1 className="title">Target company jobs</h1>
          <div className="sub">Jobs imported from employers in your target-company watchlist. The best matches are ranked first using the same eligibility, skills, experience, education, location and career-stage logic as the rest of the dashboard.</div>
        </div>
        <div className="row">
          <a className="btn ghost" href="/companies">Target companies →</a>
          <a className="btn ghost" href="/recommended">All recommendations →</a>
        </div>
      </div>

      <div className="grid recommendation-metrics">
        <div className="metric"><div className="label">Target-company jobs</div><div className="value">{items.length}</div></div>
        <div className="metric"><div className="label">Best profile matches</div><div className="value">{best}</div></div>
        <div className="metric"><div className="label">Highly suitable</div><div className="value">{highlySuitable}</div></div>
        <div className="metric"><div className="label">Employers with jobs</div><div className="value">{employersWithJobs}</div></div>
      </div>

      {internships ? <div className="success">{internships} internship/co-op target-company role{internships === 1 ? '' : 's'} currently in the imported pool.</div> : null}
      <div className="notice">This page does not scrape your logged-in LinkedIn, Indeed, Monster or Wellfound sessions. Automated ingestion uses public company career/ATS endpoints and public job feeds; portal links remain manual when no safe machine-readable feed is available.</div>

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
