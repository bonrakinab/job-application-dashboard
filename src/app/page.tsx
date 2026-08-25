import { DiscoverButton } from '@/components/DiscoverButton';
import { applicationLabel } from '@/lib/application-state';
import { rankRecommendedJobs } from '@/lib/recommendations';
import { getCandidateProfile, getDashboardStats, isLiveMode, listJobs } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [jobs, profile] = await Promise.all([listJobs(1000), getCandidateProfile()]);
  const stats = await getDashboardStats(jobs);
  const recommended = rankRecommendedJobs(jobs, profile).slice(0, 5);

  return <>
    <div className="topbar simple-topbar">
      <div>
        <h1 className="title">Your job search</h1>
        <div className="sub">Review the best jobs, prepare your documents, and keep applications up to date.</div>
      </div>
      <div className="row"><a className="btn primary" href="/recommended">Review best matches</a><DiscoverButton /></div>
    </div>

    {!isLiveMode() ? <div className="notice">Demo mode is active because Supabase is not configured. Data will not persist until the production connection is available.</div> : null}

    <div className="summary-strip">
      <div className="summary-item"><b>{stats.recommended}</b><span>Jobs worth reviewing</span></div>
      <div className="summary-item"><b>{stats.applied}</b><span>Applications sent</span></div>
      <div className="summary-item"><b>{stats.interviews}</b><span>Interviews</span></div>
    </div>

    <div className="section-head"><h2>Next steps</h2></div>
    <div className="quick-grid">
      <a className="card quick-card" href="/recommended">
        <div className="quick-number">1</div><div><h3>Review jobs</h3><p className="small muted">Start with roles that best match your profile.</p></div><span>View jobs →</span>
      </a>
      <a className="card quick-card" href="/applications">
        <div className="quick-number">2</div><div><h3>Update applications</h3><p className="small muted">Record applications, interviews, and decisions.</p></div><span>Open tracker →</span>
      </a>
      <a className="card quick-card" href="/settings">
        <div className="quick-number">3</div><div><h3>Keep your profile current</h3><p className="small muted">Your profile is used to tailor every résumé and cover letter.</p></div><span>Edit profile →</span>
      </a>
    </div>

    <div className="section-head"><h2>Top matches right now</h2><a className="small muted" href="/recommended">See all recommended →</a></div>
    <div className="card compact-list">
      {recommended.length ? recommended.map((item) => <a className="compact-job" href={`/jobs/${item.job.id}`} key={item.job.id}>
        <div><b>{item.job.title}</b><span>{item.job.company} · {item.job.location || 'Location not listed'}</span><span><b>{applicationLabel(item.job.application)}</b></span></div>
        <div className="compact-score"><b>{item.match.overall}</b><span>{item.family}</span></div>
      </a>) : <div className="small muted">No recommended listings currently clear the ranking and eligibility thresholds.</div>}
    </div>

    <div className="overview-footer-links"><a href="/jobs">Browse all {jobs.length} jobs →</a></div>
  </>;
}
