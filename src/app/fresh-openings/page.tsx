import { FreshOpeningsClient } from '@/components/FreshOpeningsClient';
import { FRESH_OPENINGS_RETENTION_DAYS, freshOpenings } from '@/lib/fresh-openings';
import { listJobs } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function FreshOpeningsPage() {
  const jobs = freshOpenings(await listJobs(3000));
  const last24Hours = Date.now() - 24 * 60 * 60 * 1000;
  const addedLast24Hours = jobs.filter((job) => {
    const discovered = job.discoveredAt ? Date.parse(job.discoveredAt) : 0;
    return discovered >= last24Hours;
  }).length;
  const tableJobs = jobs.map((job) => ({ ...job, description: '', raw: undefined }));

  return <>
    <div className="topbar simple-topbar">
      <div>
        <div className="eyebrow">Rolling {FRESH_OPENINGS_RETENTION_DAYS}-day feed</div>
        <h1 className="title">Fresh openings</h1>
        <div className="sub">Every job newly discovered by Job Agent appears here, including the jobs used by the daily email. Openings stay visible for 30 days and then automatically fall off this tab. The original posting date is shown when the source provides it.</div>
      </div>
      <a className="btn ghost" href="/recommended">Find best matches →</a>
    </div>

    <div className="grid metrics" style={{ marginBottom: '1rem' }}>
      <div className="metric"><span>Last 24 hours</span><strong>{addedLast24Hours}</strong><small>newly discovered</small></div>
      <div className="metric"><span>Fresh window</span><strong>{jobs.length}</strong><small>openings retained for 30 days</small></div>
    </div>

    <div className="section-head"><h2>Newest discoveries first</h2><a className="btn ghost" href="/jobs">View full inventory →</a></div>
    <FreshOpeningsClient jobs={tableJobs} />
  </>;
}
