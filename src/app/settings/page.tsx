import { ProfileEditor } from '@/components/ProfileEditor';
import { SourceManager } from '@/components/SourceManager';
import { configuredSources } from '@/connectors/registry';
import { aiStatus } from '@/lib/ai';
import { gmailRuntimeStatus } from '@/lib/gmail';
import { getCandidateProfile, isLiveMode } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const [profile, sources, gmail] = await Promise.all([
    getCandidateProfile(),
    configuredSources(),
    gmailRuntimeStatus(),
  ]);
  const ai = aiStatus();
  const configs: Array<[string, boolean, string]> = [
    ['Supabase', isLiveMode(), 'Persistent database'],
    ['AI provider', ai.configured, ai.provider === 'gemini' ? 'Gemini 3.6 Flash · scoring + application packs' : 'OpenAI · scoring, research + application packs'],
    ['Gemini key', ai.gemini, 'Primary free-tier provider when AI_PROVIDER=gemini'],
    ['OpenAI key', ai.openai, 'Optional paid provider when AI_PROVIDER=openai'],
    ['Gmail OAuth', gmail.oauth, gmail.storedRefreshToken ? 'Connected through the dashboard' : 'Required for outreach draft creation'],
    ['Gmail digest', gmail.digest, 'Optional daily email recipient + Gmail OAuth'],
    ['Dashboard auth', Boolean(process.env.DASHBOARD_PASSWORD && process.env.AUTH_SECRET), 'Private access gate'],
    ['Cron', Boolean(process.env.CRON_SECRET), 'Optional fallback scheduled route'],
    ['ATS sources', sources.length > 0, `${sources.length} configured sources`],
  ];

  return <>
    <div className="topbar"><div><div className="eyebrow">Configuration</div><h1 className="title">System settings</h1><div className="sub">Secret values stay server-side; this page only reports whether each capability is configured.</div></div><form action="/api/auth/logout" method="post"><button className="btn ghost">Sign out</button></form></div>
    <div className="grid config-grid">{configs.map(([name, on, desc]) => <div className="config" key={name}><b><span className={`status-dot ${on ? 'on' : ''}`}/>{name}</b><span>{on ? 'Configured' : 'Not configured'} · {desc}</span></div>)}</div>
    {ai.provider === 'gemini' ? <div className="notice">Gemini is the default AI provider. Core job analysis and application-pack generation can use the Gemini free tier. Company/hiring-team web research remains disabled in free-tier mode because Google Search grounding is not included there.</div> : null}

    <div className="section-head"><h2>Gmail connection</h2><span className="small muted">Used only for Gmail drafts and the optional digest.</span></div>
    <div className="panel">
      {gmail.oauth ? <>
        <p><b>Gmail is connected.</b> Outreach stays draft-only; the app does not automatically send recruiter messages.</p>
        {gmail.storedRefreshToken ? <form action="/api/auth/google/disconnect" method="post"><button className="btn ghost" type="submit">Disconnect Gmail</button></form> : <div className="small muted">This connection currently comes from the Vercel GOOGLE_REFRESH_TOKEN environment variable.</div>}
      </> : <>
        <p>Connect Gmail without copying tokens or using OAuth Playground.</p>
        <a className="btn" href="/api/auth/google/start">Connect Gmail</a>
      </>}
    </div>
    {gmail.oauth && !gmail.digest ? <div className="notice">Gmail outreach drafts are ready. Add GMAIL_DIGEST_TO only if you also want the optional daily email digest.</div> : null}

    <div className="section-head"><h2>Candidate profile</h2><span className="small muted">This is the truth source for all tailoring. Never add invented experience.</span></div>
    {!isLiveMode() ? <div className="notice">Supabase is not connected, so saving is disabled. You can still use CANDIDATE_PROFILE_JSON as a private Vercel environment variable for first boot.</div> : null}
    <ProfileEditor initial={profile}/>
    <div className="section-head"><h2>Job sources</h2><span className="small muted">Public ATS sources only; LinkedIn account scraping is not required.</span></div>
    <SourceManager sources={sources} canPersist={isLiveMode()}/>
  </>;
}
