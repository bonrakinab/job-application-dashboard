import { DiscoverButton } from '@/components/DiscoverButton';
import { JobListClient } from '@/components/JobListClient';
import { listJobs } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function AllJobsPage() {
  const jobs = await listJobs(3000);
  const tableJobs = jobs.map((job) => ({ ...job, description: '', raw: undefined }));
  return <>
    <div className="topbar simple-topbar">
      <div>
        <div className="eyebrow">Full inventory</div>
        <h1 className="title">All jobs</h1>
        <div className="sub">Every discovered listing lives here. Use Find Jobs for the shorter, ranked list you should review first.</div>
      </div>
      <DiscoverButton />
    </div>

    <div className="section-head"><h2>{jobs.length} stored opportunities</h2><a className="btn ghost" href="/recommended">Back to recommended →</a></div>
    <JobListClient jobs={tableJobs} />
  </>;
}
