import { opportunityStage, roleFamily } from '@/lib/recommendations';
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
  return (job.match?.overall ?? 0) + (job.healthScore ?? 50) * 0.15;
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
        <div className="eyebrow">Side-by-side decision support</div>
        <h1 className="title">Compare jobs</h1>
        <div className="sub">Compare up to five opportunities using the same match, posting-health and application-state data already stored in the dashboard.</div>
      </div>
      <a className="btn ghost" href="/recommended">Back to recommendations →</a>
    </div>

    {!jobs.length ? <div className="notice">Select two or more jobs from Recommended Jobs and choose Compare selected.</div> : null}
    {jobs.length === 1 ? <div className="notice">One job is selected. Add at least one more job for a useful comparison.</div> : null}
    {best && jobs.length > 1 ? <div className="success" style={{ marginBottom: 16 }}><b>Apply-first signal:</b> {best.title} at {best.company} currently has the strongest combined fit/posting-health priority among these choices. This is a review-order recommendation, not an interview probability.</div> : null}

    {jobs.length ? <div className="table-wrap">
      <table>
        <thead><tr><th>Factor</th>{jobs.map((job) => <th key={job.id}>{job.title}<br/><span className="muted">{job.company}</span></th>)}</tr></thead>
        <tbody>
          <tr><td><b>Overall match</b></td>{jobs.map((job) => <td key={job.id}><span className="score">{job.match?.overall ?? '—'}</span>{job.match ? '/100' : ''}<br/><span className="small muted">{job.match?.recommendation ?? 'unanalyzed'}</span></td>)}</tr>
          <tr><td><b>Posting health</b></td>{jobs.map((job) => <td key={job.id}>{job.healthScore ?? 50}/100<br/><span className="small muted">{job.validityStatus ?? 'unknown'}</span></td>)}</tr>
          <tr><td><b>Role family</b></td>{jobs.map((job) => <td key={job.id}>{roleFamily(job)}<br/><span className="small muted">{opportunityStage(job)}</span></td>)}</tr>
          <tr><td><b>Location</b></td>{jobs.map((job) => <td key={job.id}>{job.location || 'Not listed'}{job.remote ? <><br/><span className="small muted">Remote</span></> : null}</td>)}</tr>
          <tr><td><b>Salary</b></td>{jobs.map((job) => <td key={job.id}>{salary(job)}</td>)}</tr>
          <tr><td><b>Matched skills</b></td>{jobs.map((job) => <td key={job.id}>{job.match?.matchedSkills.length ? job.match.matchedSkills.slice(0, 8).join(', ') : '—'}</td>)}</tr>
          <tr><td><b>Gaps</b></td>{jobs.map((job) => <td key={job.id}>{job.match?.gaps.length ? job.match.gaps.slice(0, 4).join(' · ') : 'No explicit gap extracted'}</td>)}</tr>
          <tr><td><b>Hard blockers</b></td>{jobs.map((job) => <td key={job.id}>{job.match?.blockers.length ? job.match.blockers.join(' · ') : 'None detected'}</td>)}</tr>
          <tr><td><b>Application status</b></td>{jobs.map((job) => <td key={job.id}>{job.application?.status ?? 'discovered'}</td>)}</tr>
          <tr><td><b>Posted</b></td>{jobs.map((job) => <td key={job.id}>{formatDate(job.postedAt)}</td>)}</tr>
          <tr><td><b>Action</b></td>{jobs.map((job) => <td key={job.id}><a className="btn primary" href={`/jobs/${job.id}`}>Review →</a></td>)}</tr>
        </tbody>
      </table>
    </div> : null}
  </>;
}
