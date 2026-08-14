import { DiscoverButton } from '@/components/DiscoverButton';
import { MetricCard } from '@/components/MetricCard';
import { applicationLabel } from '@/lib/application-state';
import { rankRecommendedJobs } from '@/lib/recommendations';
import { getCandidateProfile, getDashboardStats, isLiveMode, listJobs } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [jobs, profile] = await Promise.all([listJobs(1000), getCandidateProfile()]);
  const stats = await getDashboardStats(jobs);
  const recommended = rankRecommendedJobs(jobs, profile).slice(0, 5);
  const erpCount = rankRecommendedJobs(jobs, profile).filter((item) => item.family === 'ERP & enterprise systems').length;

  return <>
    <div className="topbar simple-topbar">
      <div>
        <div className="eyebrow">Job search overview</div>
        <h1 className="title">What needs your attention?</h1>
        <div className="sub">Start with the best matches, prepare the application, then track the outcome. Advanced tools are kept out of the way until you need them.</div>
      </div>
      <div className="row"><a className="btn primary" href="/recommended">Review best matches</a><DiscoverButton /></div>
    </div>

    {!isLiveMode() ? <div className="notice">Demo mode is active because Supabase is not configured. Data will not persist until the production connection is available.</div> : null}

    <div className="grid overview-metrics">
      <MetricCard label="Strong matches" value={stats.recommended} />
      <MetricCard label="Applied" value={stats.applied} />
      <MetricCard label="Interviews" value={stats.interviews} />
      <MetricCard label="ERP / enterprise matches" value={erpCount} />
    </div>

    <div className="section-head"><h2>Start here</h2><span className="small muted">The three things you are most likely to need.</span></div>
    <div className="quick-grid">
      <a className="card quick-card" href="/recommended">
        <div className="quick-number">1</div><div><h3>Find the right jobs</h3><p className="small muted">See ranked recommendations, choose a saved search such as ERP & Enterprise Applications, and compare roles.</p></div><span>Open Find Jobs →</span>
      </a>
      <a className="card quick-card" href="/applications">
        <div className="quick-number">2</div><div><h3>Track applications</h3><p className="small muted">Keep reviewing, applied, interview and offer stages in one place.</p></div><span>Open Applications →</span>
      </a>
      <a className="card quick-card" href="/workspace">
        <div className="quick-number">3</div><div><h3>Use advanced tools when needed</h3><p className="small muted">Career insights, answer bank, saved searches, companies and automations are grouped in Workspace.</p></div><span>Open Workspace →</span>
      </a>
    </div>

    <div className="section-head"><h2>Top matches right now</h2><a className="small muted" href="/recommended">See all recommended →</a></div>
    <div className="card compact-list">
      {recommended.length ? recommended.map((item) => <a className="compact-job" href={`/jobs/${item.job.id}`} key={item.job.id}>
        <div><b>{item.job.title}</b><span>{item.job.company} · {item.job.location || 'Location not listed'}</span><span><b>{applicationLabel(item.job.application)}</b></span></div>
        <div className="compact-score"><b>{item.match.overall}</b><span>{item.family}</span></div>
      </a>) : <div className="small muted">No recommended listings currently clear the ranking and eligibility thresholds.</div>}
    </div>

    <div className="overview-footer-links">
      <a href="/jobs">Browse all {jobs.length} stored jobs →</a>
      <a href="/recommended?profile=erp-enterprise">Open ERP / Oracle search →</a>
    </div>
  </>;
}
