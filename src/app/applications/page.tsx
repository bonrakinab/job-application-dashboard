import { ApplicationTracker, type ApplicationTrackerRow } from '@/components/ApplicationTracker';
import { listJobs } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function ApplicationsPage() {
  // The tracker must inspect the full stored inventory. A 300-job read can hide older
  // applications as new discoveries push them out of the newest rows.
  const jobs = await listJobs(3000);
  const trackedRows: ApplicationTrackerRow[] = jobs
    .filter((job) => Boolean(job.id && job.application && job.application.status !== 'discovered'))
    .map((job) => ({
      id: job.id as string,
      title: job.title,
      company: job.company,
      location: job.location,
      match: job.match?.overall,
      status: job.application!.status,
      appliedAt: job.application!.appliedAt,
      responseAt: job.application!.responseAt,
      updatedAt: job.application!.updatedAt,
      notes: job.application!.notes,
    }))
    .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime());

  return <>
    <div className="topbar">
      <div>
        <h1 className="title">Applications</h1>
        <div className="sub">Track each application from review to decision.</div>
      </div>
    </div>
    <ApplicationTracker initialRows={trackedRows} />
  </>;
}
