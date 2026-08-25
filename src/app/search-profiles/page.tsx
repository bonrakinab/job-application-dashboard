import { SearchProfilesClient } from '@/components/SearchProfilesClient';
import { listSearchProfiles } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function SearchProfilesPage() {
  const profiles = await listSearchProfiles();
  return <>
    <div className="topbar">
      <div>
        <h1 className="title">Saved searches</h1>
        <div className="sub">Create focused searches for different types of roles.</div>
      </div>
      <a className="btn ghost" href="/recommended">Back to jobs</a>
    </div>
    <SearchProfilesClient initialProfiles={profiles} />
  </>;
}
