import { PortalSearchPanel } from '@/components/PortalSearchPanel';
import { RecommendedJobsClient } from '@/components/RecommendedJobsClient';
import { JobsNav } from '@/components/JobsNav';
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

  return <>
    <div className="topbar simple-topbar">
      <div>
        <h1 className="title">Best matches</h1>
        <div className="sub">Jobs ranked against your profile, with the strongest matches first.</div>
      </div>
      <a className="btn ghost" href="/jobs">All jobs →</a>
    </div>

    <JobsNav />

    {selectedProfile ? <div className="active-search-banner"><div><b>{selectedProfile.name}</b><span>{selectedProfile.description}</span></div><a href="/recommended">Clear filter</a></div> : null}

    <RecommendedJobsClient items={recommendations} searchProfiles={searchProfiles} selectedProfileId={selectedProfile?.id} />

    <details className="advanced-panel">
      <summary>More ways to search</summary>
      <div className="advanced-panel-body">
        <p className="small muted">Open searches on external job sites when you need more results.</p>
        <PortalSearchPanel />
      </div>
    </details>
  </>;
}
