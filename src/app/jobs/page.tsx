import { DiscoverButton } from '@/components/DiscoverButton';
import { JobListClient } from '@/components/JobListClient';
import { JobsNav } from '@/components/JobsNav';
import { listJobs } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function AllJobsPage() {
  const jobs = await listJobs(3000);
  const tableJobs = jobs.map((job) => ({ ...job, description: '', raw: undefined }));
  return <>
    <div className="topbar simple-topbar">
      <div>
        <h1 className="title">All jobs</h1>
        <div className="sub">Search every job collected by the dashboard.</div>
      </div>
      <DiscoverButton />
    </div>

    <JobsNav />
    <div className="section-head"><h2>{jobs.length} jobs</h2></div>
    <JobListClient jobs={tableJobs} />
  </>;
}
