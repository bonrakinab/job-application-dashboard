import { ProfileEditor } from '@/components/ProfileEditor';
import { SourceManager } from '@/components/SourceManager';
import { configuredSources } from '@/connectors/registry';
import { aiStatus } from '@/lib/ai';
import { gmailAuthorizationStatus, gmailRuntimeStatus } from '@/lib/gmail';
import { getCandidateProfile, isLiveMode } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const [profile, sources, gmail, gmailAuth] = await Promise.all([
    getCandidateProfile(),
    configuredSources(),
    gmailRuntimeStatus(),
    gmailAuthorizationStatus(),
  ]);
  const ai = aiStatus();
  const configs: Array<[string, boolean, string]> = [
    ['Supabase', isLiveMode(), 'Persistent database'],
    ['AI provider', ai.configured, ai.provider === 'gemini' ? 'Gemini 3.6 Flash · scoring + application packs' : 'OpenAI · scoring, research + application packs'],
    ['Gemini key', ai.gemini, 'Primary free-tier provider when AI_PROVIDER=gemini'],
    ['OpenAI key', ai.openai, 'Optional paid provider when AI_PROVIDER=openai'],
    ['Gmail OAuth', gmailAuth.authorized, gmailAuth.authorized ? `Authorized via ${gmail.credentialSource} credential` : gmail.oauth ? 'Configured but authorization is invalid; reconnect required' : 'Required for outreach draft creation'],
    ['Gmail digest', Boolean(gmail.digest && gmailAuth.authorized), gmail.digestTo ? 'Daily recipient configured' : 'Daily recipient is not configured'],
    ['Dashboard auth', Boolean(process.env.DASHBOARD_PASSWORD && process.env.AUTH_SECRET), 'Private access gate'],
    ['Cron', Boolean(process.env.CRON_SECRET), 'Optional fallback scheduled route'],
    ['ATS sources', sources.length > 0, `${sources.length} configured sources`],
  ];

  return <>
    <div className="topbar"><div><h1 className="title">Profile & settings</h1><div className="sub">Keep your résumé information current. The dashboard uses it for job matching and application documents.</div></div><form action="/api/auth/logout" method="post"><button className="btn ghost" type="submit">Sign out</button></form></div>
    {!isLiveMode() ? <div className="notice">Supabase is not connected, so saving is disabled. You can still use CANDIDATE_PROFILE_JSON as a private Vercel environment variable for first boot.</div> : null}
    <ProfileEditor initial={profile}/>

    <div className="section-head"><h2>Email connection</h2></div>
    <div className="card">
      {gmailAuth.authorized ? <div className="row" style={{ justifyContent: 'space-between' }}>
        <div><b>Gmail connected</b><p className="small muted">Used for outreach drafts and configured alerts.</p></div>
        {gmail.storedConnection ? <form action="/api/auth/google/disconnect" method="post"><button className="btn ghost" type="submit">Disconnect</button></form> : null}
      </div> : gmail.oauth ? <div className="row" style={{ justifyContent: 'space-between' }}>
        <div><b>Gmail needs to be reconnected</b><p className="small muted">Reconnect to restore dashboard email features.</p></div>
        <a className="btn primary" href="/api/auth/google/start">Reconnect Gmail</a>
      </div> : <div className="row" style={{ justifyContent: 'space-between' }}>
        <div><b>Gmail is not connected</b><p className="small muted">Connect it to create outreach drafts.</p></div>
        <a className="btn primary" href="/api/auth/google/start">Connect Gmail</a>
      </div>}
    </div>

    <div className="settings-stack" style={{ marginTop: 22 }}>
      <details className="advanced-panel">
        <summary>Job sources</summary>
        <div className="advanced-panel-body"><SourceManager sources={sources} canPersist={isLiveMode()}/></div>
      </details>
      <details className="advanced-panel">
        <summary>Technical status</summary>
        <div className="advanced-panel-body">
          <div className="grid config-grid">{configs.map(([name, on, desc]) => <div className="config" key={name}><b><span className={`status-dot ${on ? 'on' : ''}`}/>{name}</b><span>{on ? 'Ready' : 'Needs attention'} · {desc}</span></div>)}</div>
          {ai.provider === 'gemini' ? <p className="small muted">Gemini is the current AI provider. Company web research requires the OpenAI connection.</p> : null}
          {gmailAuth.error ? <p className="small muted">Gmail: {gmailAuth.error}</p> : null}
        </div>
      </details>
    </div>
  </>;
}
