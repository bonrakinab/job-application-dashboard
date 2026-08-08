import { ProfileEditor } from '@/components/ProfileEditor';
import { SourceManager } from '@/components/SourceManager';
import { configuredSources } from '@/connectors/registry';
import { getCandidateProfile, isLiveMode } from '@/lib/store';
import { gmailConfigured } from '@/lib/gmail';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const [profile, sources] = await Promise.all([getCandidateProfile(), configuredSources()]);
  const configs: Array<[string, boolean, string]> = [
    ['Supabase', isLiveMode(), 'Persistent database'],
    ['OpenAI', Boolean(process.env.OPENAI_API_KEY), 'AI scoring, research + application packs'],
    ['Gmail', gmailConfigured(), 'Daily digest + outreach drafts'],
    ['Dashboard auth', Boolean(process.env.DASHBOARD_PASSWORD && process.env.AUTH_SECRET), 'Private access gate'],
    ['Cron', Boolean(process.env.CRON_SECRET), 'Scheduled daily run'],
    ['ATS sources', sources.length > 0, `${sources.length} configured sources`],
  ];

  return <>
    <div className="topbar"><div><div className="eyebrow">Configuration</div><h1 className="title">System settings</h1><div className="sub">Secret values stay in Vercel; this page only reports whether each capability is configured.</div></div><form action="/api/auth/logout" method="post"><button className="btn ghost">Sign out</button></form></div>
    <div className="grid config-grid">{configs.map(([name, on, desc]) => <div className="config" key={name}><b><span className={`status-dot ${on ? 'on' : ''}`}/>{name}</b><span>{on ? 'Configured' : 'Not configured'} · {desc}</span></div>)}</div>
    <div className="section-head"><h2>Candidate profile</h2><span className="small muted">This is the truth source for all tailoring. Never add invented experience.</span></div>
    {!isLiveMode() ? <div className="notice">Supabase is not connected, so saving is disabled. You can still use CANDIDATE_PROFILE_JSON as a private Vercel environment variable for first boot.</div> : null}
    <ProfileEditor initial={profile}/>
    <div className="section-head"><h2>Job sources</h2><span className="small muted">Public ATS sources only; LinkedIn account scraping is not required.</span></div>
    <SourceManager sources={sources} canPersist={isLiveMode()}/>
  </>;
}
