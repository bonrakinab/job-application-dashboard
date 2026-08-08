import { PortalSearchPanel } from '@/components/PortalSearchPanel';
import { RecommendedJobsClient } from '@/components/RecommendedJobsClient';
import { getCandidateProfile, listJobs } from '@/lib/store';
import { rankRecommendedJobs } from '@/lib/recommendations';

export const dynamic = 'force-dynamic';

export default async function RecommendedJobsPage() {
  const [jobs, profile] = await Promise.all([listJobs(500), getCandidateProfile()]);
  const recommendations = rankRecommendedJobs(jobs, profile);
  const highlySuitable = recommendations.filter((item) => item.highlySuitable).length;
  const internships = recommendations.filter((item) => item.stage === 'internship').length;

  return <>
    <div className="topbar">
      <div>
        <div className="eyebrow">Résumé-based ranking</div>
        <h1 className="title">Recommended jobs</h1>
        <div className="sub">High-fit opportunities based on your role targets, skills, education, experience, location preferences and hard eligibility checks. Internships and new-grad roles are intentionally included.</div>
      </div>
      <a className="btn ghost" href="/">View all jobs →</a>
    </div>

    <div className="grid recommendation-metrics">
      <div className="metric"><div className="label">Recommended</div><div className="value">{recommendations.length}</div></div>
      <div className="metric"><div className="label">Highly suitable</div><div className="value">{highlySuitable}</div></div>
      <div className="metric"><div className="label">Internships</div><div className="value">{internships}</div></div>
      <div className="metric"><div className="label">All discovered</div><div className="value">{jobs.length}</div></div>
    </div>

    <div className="notice">“Priority” is an internal review order, not an employer ATS score or probability of getting an interview. Hard blockers still override ranking.</div>

    <div className="section-head"><h2>Your recommended listings</h2><span className="small muted">The existing dashboard continues to keep every other discovered job.</span></div>
    <RecommendedJobsClient items={recommendations} />

    <div className="section-head"><h2>Broaden the search</h2><span className="small muted">Live imports where a safe public feed exists; direct portal searches where it does not.</span></div>
    <PortalSearchPanel />
  </>;
}
