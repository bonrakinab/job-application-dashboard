import { jobTypeLabels } from '@/lib/job-type';
import { getJob } from '@/lib/store';
import type { JobWithMatch } from '@/lib/types';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function salary(job: JobWithMatch) {
  if (job.salaryText) return job.salaryText;
  if (job.salaryMin != null || job.salaryMax != null) {
    const prefix = job.currency ? `${job.currency} ` : '';
    if (job.salaryMin != null && job.salaryMax != null) return `${prefix}${job.salaryMin.toLocaleString()}–${job.salaryMax.toLocaleString()}`;
    return `${prefix}${(job.salaryMin ?? job.salaryMax)?.toLocaleString()}`;
  }
  return 'Not listed';
}

function applyPriority(job: JobWithMatch) {
  if (job.match?.blockers.length || ['closed', 'likely_closed'].includes(job.validityStatus ?? 'unknown')) return -1000;
  return job.match?.overall ?? 0;
}

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const params = await searchParams;
  const ids = [...new Set((params.ids ?? '').split(',').map((value) => value.trim()).filter(Boolean))].slice(0, 5);
  const loaded = await Promise.all(ids.map((id) => getJob(id)));
  const jobs = loaded.filter((job): job is JobWithMatch => Boolean(job));
  const ordered = [...jobs].sort((a, b) => applyPriority(b) - applyPriority(a));
  const best = ordered[0];

  return <>
    <div className="topbar">
      <div>
        <h1 className="title">Compare jobs</h1>
        <div className="sub">Compare the details that matter before choosing where to apply.</div>
      </div>
      <a className="btn ghost" href="/recommended">Back to jobs</a>
    </div>

    {!jobs.length ? <div className="notice">Select at least two jobs from Best matches, then choose Compare.</div> : null}
    {jobs.length === 1 ? <div className="notice">Select one more job for comparison.</div> : null}
    {best && jobs.length > 1 ? <div className="success" style={{ marginBottom: 16 }}><b>Best match:</b> {best.title} at {best.company}.</div> : null}

    {jobs.length ? <div className="table-wrap">
      <table>
        <thead><tr><th>Factor</th>{jobs.map((job) => <th key={job.id}>{job.title}<br/><span className="muted">{job.company}</span></th>)}</tr></thead>
        <tbody>
          <tr><td><b>Overall match</b></td>{jobs.map((job) => <td key={job.id}><span className="score">{job.match?.overall ?? '—'}</span>{job.match ? '/100' : ''}<br/><span className="small muted">{job.match?.recommendation ?? 'unanalyzed'}</span></td>)}</tr>
          <tr><td><b>Location</b></td>{jobs.map((job) => <td key={job.id}>{job.location || 'Not listed'}{job.remote ? <><br/><span className="small muted">Remote</span></> : null}</td>)}</tr>
          <tr><td><b>Job type</b></td>{jobs.map((job) => <td key={job.id}>{jobTypeLabels(job).join(', ') || job.employmentType || 'Not listed'}</td>)}</tr>
          <tr><td><b>Salary</b></td>{jobs.map((job) => <td key={job.id}>{salary(job)}</td>)}</tr>
          <tr><td><b>Strengths</b></td>{jobs.map((job) => <td key={job.id}>{job.match?.strengths.length ? job.match.strengths.slice(0, 3).join(' · ') : '—'}</td>)}</tr>
          <tr><td><b>Gaps</b></td>{jobs.map((job) => <td key={job.id}>{job.match?.gaps.length ? job.match.gaps.slice(0, 3).join(' · ') : 'None identified'}</td>)}</tr>
          <tr><td><b>Application status</b></td>{jobs.map((job) => <td key={job.id}>{job.application?.status ?? 'discovered'}</td>)}</tr>
          <tr><td><b>Posted</b></td>{jobs.map((job) => <td key={job.id}>{formatDate(job.postedAt)}</td>)}</tr>
          <tr><td><b>Action</b></td>{jobs.map((job) => <td key={job.id}><a className="btn primary" href={`/jobs/${job.id}`}>View job</a></td>)}</tr>
        </tbody>
      </table>
    </div> : null}
  </>;
}
