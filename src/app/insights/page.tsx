import { buildMarketInsights } from '@/lib/market-insights';
import { getCandidateProfile, listJobs } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function InsightsPage() {
  const [jobs, profile] = await Promise.all([listJobs(1200), getCandidateProfile()]);
  const insights = buildMarketInsights(jobs, profile);
  const coveredSkills = insights.skills.filter((row) => row.owned).length;

  return <>
    <div className="topbar">
      <div>
        <h1 className="title">Skills insights</h1>
        <div className="sub">See which skills appear most often and which ones may be worth learning next.</div>
      </div>
      <a className="btn ghost" href="/settings">Update profile</a>
    </div>

    <div className="summary-strip">
      <div className="summary-item"><b>{insights.analyzedJobs}</b><span>Jobs analyzed</span></div>
      <div className="summary-item"><b>{coveredSkills}</b><span>Common skills in your profile</span></div>
      <div className="summary-item"><b>{insights.gaps.length}</b><span>Recurring skill gaps</span></div>
    </div>

    <div className="section-head"><h2>Skills employers request</h2></div>
    <div className="table-wrap compact-table">
      <table>
        <thead><tr><th>Skill</th><th>Jobs</th><th>Share</th><th>Your profile</th></tr></thead>
        <tbody>{insights.skills.slice(0, 15).map((row) => <tr key={row.skill}>
          <td><b>{row.skill}</b></td>
          <td>{row.count}</td>
          <td>{row.percentage}%</td>
          <td>{row.owned ? <span className="pill strong">Included</span> : <span className="pill stretch">Missing</span>}</td>
        </tr>)}</tbody>
      </table>
    </div>

    <div className="section-head"><h2>Skills to consider learning</h2></div>
    <div className="recommendation-grid simple-job-cards">
      {insights.gaps.slice(0, 8).map((row) => <article className="card simple-job-card" key={row.skill}>
        <div><h3>{row.skill}</h3><div className="simple-job-meta">Requested by {row.count} jobs in your current search.</div></div>
        <div className="simple-job-score"><b>{row.percentage}%</b><span>of jobs</span></div>
      </article>)}
      {!insights.gaps.length ? <div className="notice">No recurring skill gaps were found.</div> : null}
    </div>

    <details className="advanced-panel">
      <summary>Role types in your search</summary>
      <div className="advanced-panel-body tag-list">
        {insights.roleFamilies.map((row) => <span className="tag" key={row.family}>{row.family}: {row.count}</span>)}
      </div>
    </details>
  </>;
}
