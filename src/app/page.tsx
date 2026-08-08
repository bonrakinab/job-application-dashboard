import { DiscoverButton } from '@/components/DiscoverButton';
import { JobListClient } from '@/components/JobListClient';
import { MetricCard } from '@/components/MetricCard';
import { getDashboardStats, isLiveMode, listJobs } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const jobs = await listJobs(500);
  const stats = await getDashboardStats(jobs);
  return <>
    <div className="topbar"><div><div className="eyebrow">Personal job intelligence</div><h1 className="title">Opportunity command center</h1><div className="sub">Discover → filter → rank → prepare → review → apply → learn.</div></div><div className="row"><a className="btn primary" href="/recommended">★ Recommended jobs</a><DiscoverButton/></div></div>
    {!isLiveMode()?<div className="notice">Demo mode is active because Supabase is not configured. The interface and workflow are functional, but data is not persistent until the Supabase environment variables are added.</div>:null}
    <div className="grid metrics"><MetricCard label="Discovered" value={stats.discovered}/><MetricCard label="Strong matches" value={stats.recommended}/><MetricCard label="Applied" value={stats.applied}/><MetricCard label="Interviews" value={stats.interviews}/><MetricCard label="Offers" value={stats.offers}/></div>
    <div className="section-head"><h2>All opportunities</h2><span className="small muted">Every discovered job remains here. Hard eligibility blockers override match scores.</span></div>
    <JobListClient jobs={jobs}/>
  </>;
}
