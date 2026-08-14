import { SearchProfilesClient } from '@/components/SearchProfilesClient';
import { listSearchProfiles } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function SearchProfilesPage() {
  const profiles = await listSearchProfiles();
  return <>
    <div className="topbar">
      <div>
        <div className="eyebrow">Role-specific discovery views</div>
        <h1 className="title">Saved search profiles</h1>
        <div className="sub">Switch between AI/ML, data, software, IT/cloud, ERP/enterprise and automation-oriented searches without changing the master candidate profile or the existing all-jobs workflow.</div>
      </div>
      <a className="btn ghost" href="/recommended">All recommendations →</a>
    </div>
    <SearchProfilesClient initialProfiles={profiles} />
  </>;
}
