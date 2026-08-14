import { duplicateGroups } from '@/lib/job-duplicates';
import { buildMarketInsights } from '@/lib/market-insights';
import { getCandidateProfile, listJobs } from '@/lib/store';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function InsightsPage() {
  const [jobs, profile] = await Promise.all([listJobs(1200), getCandidateProfile()]);
  const insights = buildMarketInsights(jobs, profile);
  const duplicates = duplicateGroups(jobs);
  const reposts = duplicates.filter((group) => group.meta.reposted);

  return <>
    <div className="topbar">
      <div>
        <div className="eyebrow">Career intelligence</div>
        <h1 className="title">Market & skills insights</h1>
        <div className="sub">What the jobs in your own discovery database are asking for, which requirements already have evidence in your profile, and where the biggest recurring skill gaps are.</div>
      </div>
      <a className="btn ghost" href="/search-profiles">Saved searches →</a>
    </div>

    <div className="grid recommendation-metrics">
      <div className="metric"><div className="label">Jobs analyzed</div><div className="value">{insights.analyzedJobs}</div></div>
      <div className="metric"><div className="label">ERP / enterprise</div><div className="value">{insights.erpJobs}</div></div>
      <div className="metric"><div className="label">Strong ERP matches</div><div className="value">{insights.erpStrongMatches}</div></div>
      <div className="metric"><div className="label">Duplicate / repost groups</div><div className="value">{duplicates.length}</div></div>
    </div>

    <div className="section-head"><h2>Highest-demand skills in your discovered market</h2><span className="small muted">Demand = share of viable listings containing the skill or an explicit alias.</span></div>
    <div className="table-wrap">
      <table>
        <thead><tr><th>Skill</th><th>Listings</th><th>Demand</th><th>Your evidence</th></tr></thead>
        <tbody>{insights.skills.slice(0, 30).map((row) => <tr key={row.skill}>
          <td><b>{row.skill}</b></td>
          <td>{row.count}</td>
          <td>{row.percentage}%</td>
          <td>{row.owned ? <span className="pill strong">Present</span> : <span className="pill stretch">Gap</span>}</td>
        </tr>)}</tbody>
      </table>
    </div>

    <div className="section-head"><h2>Highest-return learning gaps</h2><span className="small muted">Sorted by how often a skill appears when your profile has no direct evidence for it.</span></div>
    <div className="recommendation-grid">
      {insights.gaps.map((row) => <article className="card recommendation-card" key={row.skill}>
        <div className="row recommendation-card-head">
          <div><div className="kicker">Market gap</div><h3>{row.skill}</h3></div>
          <div className="recommendation-score"><span className="small muted">Demand</span><b>{row.percentage}%</b></div>
        </div>
        <div className="small muted">Mentioned in {row.count} viable listings currently stored in the dashboard. Treat this as prioritization evidence, not a guarantee that learning the skill produces interviews.</div>
      </article>)}
      {!insights.gaps.length ? <div className="notice">No recurring missing skill was detected from the controlled skill dictionary.</div> : null}
    </div>

    <div className="section-head"><h2>Role-family mix</h2><span className="small muted">Useful for seeing where your discovery coverage is concentrated.</span></div>
    <div className="grid recommendation-metrics">
      {insights.roleFamilies.map((row) => <div className="metric" key={row.family}><div className="label">{row.family}</div><div className="value">{row.count}</div><div className="small muted">{row.percentage}% of viable listings</div></div>)}
    </div>

    <div className="section-head"><h2>Duplicate & repost intelligence</h2><span className="small muted">Recommended jobs collapse these groups to one canonical listing; the history remains stored for audit.</span></div>
    <div className="grid">
      {duplicates.slice(0, 20).map((group) => <article className="card" key={group.key}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="kicker">{group.meta.reposted ? 'Likely repost / repeated listing' : 'Duplicate listing'}</div>
            <h3>{group.canonical.title}</h3>
            <div className="small muted">{group.canonical.company} · {group.jobs.length} records · {group.meta.sources.join(', ')}</div>
          </div>
          <a className="btn ghost" href={`/jobs/${group.canonical.id}`}>Open canonical →</a>
        </div>
        <div className="tag-list">
          <span className="tag">{group.meta.duplicateCount} duplicate{group.meta.duplicateCount === 1 ? '' : 's'} collapsed</span>
          {group.meta.firstSeen ? <span className="tag">First seen {formatDate(group.meta.firstSeen)}</span> : null}
          {group.meta.lastSeen ? <span className="tag">Latest {formatDate(group.meta.lastSeen)}</span> : null}
        </div>
      </article>)}
      {!duplicates.length ? <div className="notice">No duplicate title/company groups are currently detected.</div> : null}
    </div>

    {reposts.length ? <div className="notice" style={{ marginTop: 18 }}>{reposts.length} duplicate groups look like repeated/reposted positions. This is a posting-history signal only; it does not claim the employer intentionally created a “ghost job”.</div> : null}
  </>;
}
