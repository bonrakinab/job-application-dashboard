import { JobsNav } from '@/components/JobsNav';
import { JobListClient } from '@/components/JobListClient';
import { listCustomerServiceJobs } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function CustomerServicePage() {
  const jobs = await listCustomerServiceJobs();
  const tableJobs = jobs.map(job => ({ ...job, description: '', raw: undefined }));
  return <>
    <div className="topbar simple-topbar">
      <div>
        <h1 className="title">Customer Service</h1>
        <div className="sub">Across Ontario — on-site, hybrid, and remote roles open to Ontario residents.</div>
      </div>
      <a className="btn ghost" href="/jobs/new">Add a job</a>
    </div>
    <JobsNav />
    <div className="card compact-card">
      <b>Every employment type, across the province</b>
      <p className="small muted">Browse collected customer service, customer care, support, client service, associate, and call-centre roles. Full-time, part-time, contract, and temporary listings are included regardless of match score. Search by city or employer and combine job type with workplace filters.</p>
      <p className="small muted">Newest postings appear first. This view includes older listings; email alerts still use the 72-hour limit. Known closed jobs are hidden by default. Unverified listings are labelled and need checking on the employer’s site. Coverage reflects collected postings, not every vacancy in Ontario.</p>
    </div>
    <div className="section-head"><h2>{jobs.length} collected customer service job{jobs.length === 1 ? '' : 's'}</h2></div>
    <JobListClient jobs={tableJobs} newestFirst />
  </>;
}
