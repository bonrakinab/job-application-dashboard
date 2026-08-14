import { PortalSearchPanel } from '@/components/PortalSearchPanel';
import { RecommendedJobsClient } from '@/components/RecommendedJobsClient';
import { rankRecommendedJobs } from '@/lib/recommendations';
import { filterJobsForSearchProfile, profileForSearch } from '@/lib/search-profiles';
import { getCandidateProfile, listJobs, listSearchProfiles } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function RecommendedJobsPage({ searchParams }: { searchParams: Promise<{ profile?: string }> }) {
  const params = await searchParams;
  const [jobs, profile, searchProfiles] = await Promise.all([listJobs(700), getCandidateProfile(), listSearchProfiles()]);
  const selectedProfile = params.profile ? searchProfiles.find((item) => item.id === params.profile && item.enabled) : undefined;
  const effectiveProfile = profileForSearch(profile, selectedProfile);
  const searchJobs = filterJobsForSearchProfile(jobs, selectedProfile);
  const recommendations = rankRecommendedJobs(searchJobs, effectiveProfile)
    .filter((item) => !selectedProfile || item.match.overall >= selectedProfile.minMatch);
  const highlySuitable = recommendations.filter((item) => item.highlySuitable).length;
  const internships = recommendations.filter((item) => item.stage === 'internship').length;

  return <>
    <div className="topbar">
      <div>
        <div className="eyebrow">Résumé-based ranking</div>
        <h1 className="title">Recommended jobs</h1>
        <div className="sub">High-fit opportunities based on your role targets, skills, education, experience, location preferences and hard eligibility checks. Internships and new-grad roles are intentionally included.</div>
      </div>
      <div className="row">
        <a className="btn ghost" href="/search-profiles">Manage searches</a>
        <a className="btn ghost" href="/">View all jobs →</a>
      </div>
    </div>

    <div className="grid recommendation-metrics">
      <div className="metric"><div className="label">Recommended</div><div className="value">{recommendations.length}</div></div>
      <div className="metric"><div className="label">Highly suitable</div><div className="value">{highlySuitable}</div></div>
      <div className="metric"><div className="label">Internships</div><div className="value">{internships}</div></div>
      <div className="metric"><div className="label">All discovered</div><div className="value">{jobs.length}</div></div>
    </div>

    {selectedProfile ? <div className="success" style={{ marginBottom: 15 }}><b>Search profile:</b> {selectedProfile.name}. {selectedProfile.description} Minimum match: {selectedProfile.minMatch}/100. <a href="/recommended" style={{ textDecoration: 'underline' }}>Clear filter</a></div> : null}
    <div className="notice">“Priority” is an internal review order, not an employer ATS score or probability of getting an interview. Hard blockers still override ranking. Exact duplicate title/company listings are collapsed to a canonical job in this view.</div>

    <div className="section-head"><h2>Your recommended listings</h2><span className="small muted">The existing dashboard continues to keep every other discovered job.</span></div>
    <RecommendedJobsClient items={recommendations} searchProfiles={searchProfiles} selectedProfileId={selectedProfile?.id} />

    <div className="section-head"><h2>Broaden the search</h2><span className="small muted">Live imports where a safe public feed exists; direct portal searches where it does not.</span></div>
    <PortalSearchPanel />
  </>;
}
