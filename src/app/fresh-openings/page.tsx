import { FreshOpeningsClient } from '@/components/FreshOpeningsClient';
import { JobsNav } from '@/components/JobsNav';
import { FRESH_OPENINGS_WINDOW_HOURS, freshOpenings } from '@/lib/fresh-openings';
import { isMainCareerJob } from '@/lib/part-time-jobs';
import { listJobs } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function FreshOpeningsPage() {
  const jobs = freshOpenings((await listJobs(3000)).filter(isMainCareerJob));
  const tableJobs = jobs.map((job) => ({ ...job, description: '', raw: undefined }));

  return <>
    <div className="topbar simple-topbar">
      <div>
        <h1 className="title">Recent openings</h1>
        <div className="sub">Jobs discovered during the last {FRESH_OPENINGS_WINDOW_HOURS} hours. Verified fresh postings appear first; older or unverified source dates remain visible.</div>
      </div>
      <a className="btn ghost" href="/recommended">Find best matches →</a>
    </div>

    <JobsNav />
    <div className="section-head"><h2>{jobs.length} recently discovered job{jobs.length === 1 ? '' : 's'}</h2></div>
    <FreshOpeningsClient jobs={tableJobs} />
  </>;
}
