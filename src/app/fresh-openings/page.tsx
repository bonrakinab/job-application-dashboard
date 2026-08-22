import { FreshOpeningsClient } from '@/components/FreshOpeningsClient';
import { FRESH_OPENINGS_WINDOW_HOURS, freshOpenings } from '@/lib/fresh-openings';
import { listJobs } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function FreshOpeningsPage() {
  const jobs = freshOpenings(await listJobs(3000));
  const tableJobs = jobs.map((job) => ({ ...job, description: '', raw: undefined }));

  return <>
    <div className="topbar simple-topbar">
      <div>
        <div className="eyebrow">Strict rolling {FRESH_OPENINGS_WINDOW_HOURS}-hour feed</div>
        <h1 className="title">Fresh openings</h1>
        <div className="sub">Only jobs first discovered within the last 24 hours and carrying a source-reported posting time from the same 24-hour window appear here. Older jobs and listings without a usable posting time remain available in the full inventory.</div>
      </div>
      <a className="btn ghost" href="/recommended">Find best matches →</a>
    </div>

    <div className="grid metrics" style={{ marginBottom: '1rem' }}>
      <div className="metric"><span>Verified fresh</span><strong>{jobs.length}</strong><small>posted and discovered within 24 hours</small></div>
      <div className="metric"><span>Maximum age</span><strong>{FRESH_OPENINGS_WINDOW_HOURS}h</strong><small>rolling source-posted window</small></div>
    </div>

    <div className="section-head"><h2>Newest source postings first</h2><a className="btn ghost" href="/jobs">View full inventory →</a></div>
    <FreshOpeningsClient jobs={tableJobs} />
  </>;
}
