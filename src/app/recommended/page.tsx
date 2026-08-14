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

  return <>
    <div className="topbar simple-topbar">
      <div>
        <div className="eyebrow">Find jobs</div>
        <h1 className="title">Best matches</h1>
        <div className="sub">A shorter list of jobs worth reviewing first. Change the search profile when you want to focus on ERP, AI/ML, software, data, IT or automation roles.</div>
      </div>
      <a className="btn ghost" href="/jobs">All jobs →</a>
    </div>

    <div className="grid find-metrics">
      <div className="metric"><div className="label">Recommended</div><div className="value">{recommendations.length}</div></div>
      <div className="metric"><div className="label">Highly suitable</div><div className="value">{highlySuitable}</div></div>
      <div className="metric"><div className="label">Total discovered</div><div className="value">{jobs.length}</div></div>
    </div>

    {selectedProfile ? <div className="active-search-banner"><div><b>{selectedProfile.name}</b><span>{selectedProfile.description}</span></div><a href="/recommended">Clear filter</a></div> : null}

    <RecommendedJobsClient items={recommendations} searchProfiles={searchProfiles} selectedProfileId={selectedProfile?.id} />

    <details className="advanced-panel">
      <summary>More ways to search</summary>
      <div className="advanced-panel-body">
        <p className="small muted">Use these only when the ranked list is too narrow. Live sources continue importing automatically.</p>
        <PortalSearchPanel />
      </div>
    </details>
  </>;
}
