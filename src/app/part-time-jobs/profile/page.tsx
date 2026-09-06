import { PartTimeResumeUpload } from '@/components/PartTimeResumeUpload';
import { ProfileEditor } from '@/components/ProfileEditor';
import { JobsNav } from '@/components/JobsNav';
import { emptyPartTimeProfile, PART_TIME_PROFILE_ID } from '@/lib/part-time-jobs';
import { getCandidateProfileOptional } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function PartTimeProfilePage() {
  const saved = await getCandidateProfileOptional(PART_TIME_PROFILE_ID);
  const profile = saved ?? emptyPartTimeProfile();
  return <>
    <div className="topbar simple-topbar">
      <div>
        <h1 className="title">Part-time résumé</h1>
        <div className="sub">The only evidence source used for Windsor part-time job matching, résumés, and cover letters.</div>
      </div>
      <a className="btn ghost" href="/part-time-jobs">Back to part-time jobs</a>
    </div>
    <JobsNav />
    <PartTimeResumeUpload hasProfile={Boolean(saved)} />
    {saved ? <>
      <div className="section-head"><h2>Review imported details</h2></div>
      <ProfileEditor initial={profile} profileId={PART_TIME_PROFILE_ID} showLinkedInImport={false} />
    </> : <div className="notice">Upload the separate résumé to create this profile. Nothing from your main résumé or LinkedIn profile is copied into it.</div>}
  </>;
}
