import { FreshOpeningsClient } from '@/components/FreshOpeningsClient';
import { JobsNav } from '@/components/JobsNav';
import { FRESH_OPENINGS_WINDOW_HOURS, freshOpenings } from '@/lib/fresh-openings';
import { listJobs } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function FreshOpeningsPage() {
  const jobs = freshOpenings(await listJobs(3000));
  const tableJobs = jobs.map((job) => ({ ...job, description: '', raw: undefined }));

  return <>
    <div className="topbar simple-topbar">
      <div>
        <h1 className="title">Fresh openings</h1>
        <div className="sub">Jobs posted and discovered during the last {FRESH_OPENINGS_WINDOW_HOURS} hours.</div>
      </div>
      <a className="btn ghost" href="/recommended">Find best matches →</a>
    </div>

    <JobsNav />
    <div className="section-head"><h2>{jobs.length} fresh job{jobs.length === 1 ? '' : 's'}</h2></div>
    <FreshOpeningsClient jobs={tableJobs} />
  </>;
}
