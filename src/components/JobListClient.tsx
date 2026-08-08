'use client';
import { useMemo, useState } from 'react';
import type { JobWithMatch } from '@/lib/types';
import { StatusPill } from './StatusPill';

export function JobListClient({ jobs }: { jobs: JobWithMatch[] }) {
  const [q,setQ]=useState(''); const [filter,setFilter]=useState('all');
  const visible=useMemo(()=>jobs.filter(j=>{const text=`${j.title} ${j.company} ${j.location}`.toLowerCase();const match=!q||text.includes(q.toLowerCase());const category=filter==='all'||j.match?.recommendation===filter;return match&&category}),[jobs,q,filter]);
  return <>
    <div className="searchbar"><input className="input" placeholder="Search title, company, location…" value={q} onChange={e=>setQ(e.target.value)}/><select className="select" style={{maxWidth:180}} value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All scores</option><option value="exceptional">Exceptional</option><option value="strong">Strong</option><option value="reasonable">Reasonable</option><option value="stretch">Stretch</option><option value="skip">Skip</option></select></div>
    <div className="table-wrap"><table><thead><tr><th>Opportunity</th><th>Location</th><th>Match</th><th>Decision</th><th>Status</th><th></th></tr></thead><tbody>{visible.map(job=><tr key={job.id}><td><div className="job-title">{job.title}</div><div className="job-company">{job.company} · {job.source}</div></td><td>{job.location||'—'}</td><td><span className="score">{job.match?.overall ?? '—'}</span>{job.match?<span className="muted">/100</span>:null}</td><td>{job.match?<StatusPill value={job.match.recommendation}/>:<span className="pill">unanalyzed</span>}</td><td><span className="small">{job.application?.status||'discovered'}</span></td><td><a className="btn ghost" href={`/jobs/${job.id}`}>Review →</a></td></tr>)}</tbody></table></div>
  </>;
}
