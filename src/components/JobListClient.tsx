'use client';
import { useEffect, useMemo, useState } from 'react';
import type { JobWithMatch } from '@/lib/types';
import { StatusPill } from './StatusPill';

const PAGE_SIZE = 100;

function stage(job: JobWithMatch) {
  const text = `${job.title} ${job.employmentType ?? ''}`.toLowerCase();
  if (/\b(intern|internship|co-op|coop)\b/.test(text)) return 'internship';
  if (/\b(new grad|new graduate|graduate|early career)\b/.test(text)) return 'new-grad';
  if (/\b(entry level|entry-level|junior|associate)\b/.test(text)) return 'entry-level';
  return 'experienced';
}

export function JobListClient({ jobs }: { jobs: JobWithMatch[] }) {
  const [q,setQ]=useState('');
  const [filter,setFilter]=useState('all');
  const [source,setSource]=useState('all');
  const [careerStage,setCareerStage]=useState('all');
  const [page,setPage]=useState(1);
  const sources=useMemo(()=>[...new Set(jobs.map(job=>job.source))].sort(),[jobs]);
  const visible=useMemo(()=>jobs.filter(j=>{
    const text=`${j.title} ${j.company} ${j.location}`.toLowerCase();
    const match=!q||text.includes(q.toLowerCase());
    const category=filter==='all'||j.match?.recommendation===filter;
    const sourceHit=source==='all'||j.source===source;
    const stageHit=careerStage==='all'||stage(j)===careerStage;
    return match&&category&&sourceHit&&stageHit;
  }),[jobs,q,filter,source,careerStage]);
  const totalPages=Math.max(1,Math.ceil(visible.length/PAGE_SIZE));
  const paged=useMemo(()=>visible.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE),[visible,page]);

  useEffect(()=>setPage(1),[q,filter,source,careerStage]);
  useEffect(()=>{ if(page>totalPages)setPage(totalPages); },[page,totalPages]);

  return <>
    <div className="searchbar job-filters"><input className="input" placeholder="Search title, company, location…" value={q} onChange={e=>setQ(e.target.value)}/><select className="select" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All scores</option><option value="exceptional">Exceptional</option><option value="strong">Strong</option><option value="reasonable">Reasonable</option><option value="stretch">Stretch</option><option value="skip">Skip</option></select><select className="select" value={careerStage} onChange={e=>setCareerStage(e.target.value)}><option value="all">All stages</option><option value="internship">Internships</option><option value="new-grad">New grad</option><option value="entry-level">Entry level</option><option value="experienced">Experienced</option></select><select className="select" value={source} onChange={e=>setSource(e.target.value)}><option value="all">All sources</option>{sources.map(value=><option value={value} key={value}>{value}</option>)}</select></div>
    <div className="row" style={{justifyContent:'space-between',marginBottom:'0.75rem'}}><span className="small muted">Showing {visible.length ? (page-1)*PAGE_SIZE+1 : 0}–{Math.min(page*PAGE_SIZE,visible.length)} of {visible.length} matching jobs · {jobs.length} loaded</span><span className="small muted">Page {page} of {totalPages}</span></div>
    <div className="table-wrap"><table><thead><tr><th>Opportunity</th><th>Location</th><th>Match</th><th>Decision</th><th>Status</th><th></th></tr></thead><tbody>{paged.map(job=><tr key={job.id}><td><div className="job-title">{job.title}</div><div className="job-company">{job.company} · {job.source}</div></td><td>{job.location||'—'}</td><td><span className="score">{job.match?.overall ?? '—'}</span>{job.match?<span className="muted">/100</span>:null}</td><td>{job.match?<StatusPill value={job.match.recommendation}/>:<span className="pill">unanalyzed</span>}</td><td><span className="small">{job.application?.status||'discovered'}</span></td><td><a className="btn ghost" href={`/jobs/${job.id}`}>Review →</a></td></tr>)}</tbody></table></div>
    {totalPages>1?<div className="row" style={{justifyContent:'space-between',marginTop:'1rem'}}><button className="btn ghost" type="button" disabled={page<=1} onClick={()=>setPage(value=>Math.max(1,value-1))}>← Previous</button><span className="small muted">{visible.length} results</span><button className="btn ghost" type="button" disabled={page>=totalPages} onClick={()=>setPage(value=>Math.min(totalPages,value+1))}>Next →</button></div>:null}
  </>;
}
