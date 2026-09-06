import { JobListClient } from '@/components/JobListClient';
import { JobsNav } from '@/components/JobsNav';
import { isWindsorPartTimeJob, PART_TIME_PROFILE_ID } from '@/lib/part-time-jobs';
import { getCandidateProfileOptional, jobMatchNeedsRefresh, listJobs } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function PartTimeJobsPage() {
  const [allJobs, profile] = await Promise.all([
    listJobs(3000),
    getCandidateProfileOptional(PART_TIME_PROFILE_ID),
  ]);
  const jobs = allJobs.filter(isWindsorPartTimeJob);
  const tableJobs = jobs.map((job) => ({
    ...job,
    match: profile && !jobMatchNeedsRefresh(job.match, PART_TIME_PROFILE_ID) ? job.match : undefined,
    description: '',
    raw: undefined,
  }));

  return <>
    <div className="topbar simple-topbar">
      <div>
        <h1 className="title">Local jobs</h1>
        <div className="sub">Part-time and casual work in Windsor–Essex, plus part-time and full-time food-chain roles. Use Filters to choose a job type.</div>
      </div>
      <div className="row">
        <a className="btn ghost" href="/jobs/new?profile=part-time">Add a job</a>
        <a className="btn primary" href="/part-time-jobs/profile">{profile ? 'Manage part-time résumé' : 'Upload part-time résumé'}</a>
      </div>
    </div>

    <JobsNav />
    {!profile ? <div className="notice">Upload your separate part-time résumé before generating a match score, résumé, or cover letter. Main-profile experience will never be used for these jobs.</div> : null}
    <div className="card compact-card">
      <b>Windsor local search</b>
      <p className="small muted">Checks Workopolis, Workforce WindsorEssex/WEjobs, local community boards, and public employer career pages. New verified listings are deduplicated and added to this tab.</p>
    </div>
    <div className="section-head"><h2>{jobs.length} local job{jobs.length === 1 ? '' : 's'}</h2></div>
    <JobListClient jobs={tableJobs} />
  </>;
}
