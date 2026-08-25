'use client';
import { useEffect, useMemo, useState } from 'react';
import type { JobValidityStatus, JobWithMatch } from '@/lib/types';
import { jobMatchesType, jobTypeLabels, type JobTypeFilter } from '@/lib/job-type';
import { applicationLabel, matchesApplicationFilter, type ApplicationFilter } from '@/lib/application-state';
import { StatusPill } from './StatusPill';

const PAGE_SIZE = 100;

function stage(job: JobWithMatch) {
  const text = `${job.title} ${job.employmentType ?? ''}`.toLowerCase();
  if (/\b(intern|internship|co-op|coop)\b/.test(text)) return 'internship';
  if (/\b(new grad|new graduate|graduate|early career)\b/.test(text)) return 'new-grad';
  if (/\b(entry level|entry-level|junior|associate)\b/.test(text)) return 'entry-level';
  return 'experienced';
}

function validityLabel(status?: JobValidityStatus) {
  if (status === 'active') return 'Verified active';
  if (status === 'likely_active') return 'Likely active';
  if (status === 'likely_closed') return 'Likely closed';
  if (status === 'closed') return 'Closed';
  return 'Unverified';
}

function validityRank(status?: JobValidityStatus) {
  if (status === 'active') return 5;
  if (status === 'likely_active') return 4;
  if (status === 'unknown' || !status) return 3;
  if (status === 'likely_closed') return 1;
  return 0;
}

export function JobListClient({ jobs }: { jobs: JobWithMatch[] }) {
  const [q,setQ]=useState('');
  const [filter,setFilter]=useState('all');
  const [source,setSource]=useState('all');
  const [careerStage,setCareerStage]=useState('all');
  const [jobType,setJobType]=useState<JobTypeFilter>('all');
  const [applicationState,setApplicationState]=useState<ApplicationFilter>('all');
  const [validity,setValidity]=useState('viable');
  const [page,setPage]=useState(1);
  const sources=useMemo(()=>[...new Set(jobs.map(job=>job.source))].sort(),[jobs]);
  const visible=useMemo(()=>jobs.filter(j=>{
    const text=`${j.title} ${j.company} ${j.location}`.toLowerCase();
    const match=!q||text.includes(q.toLowerCase());
    const category=filter==='all'||j.match?.recommendation===filter;
    const sourceHit=source==='all'||j.source===source;
    const stageHit=careerStage==='all'||stage(j)===careerStage;
    const typeHit=jobMatchesType(j,jobType);
    const applicationHit=matchesApplicationFilter(j.application,applicationState);
    const validityHit=validity==='all'
      || (validity==='viable' && !['closed','likely_closed'].includes(j.validityStatus ?? 'unknown'))
      || (validity==='verified' && ['active','likely_active'].includes(j.validityStatus ?? 'unknown'))
      || (validity==='unknown' && (j.validityStatus ?? 'unknown')==='unknown')
      || (validity==='closed' && ['closed','likely_closed'].includes(j.validityStatus ?? 'unknown'));
    return match&&category&&sourceHit&&stageHit&&typeHit&&applicationHit&&validityHit;
  }).sort((a,b)=>validityRank(b.validityStatus)-validityRank(a.validityStatus)
    || (b.healthScore ?? 50)-(a.healthScore ?? 50)
    || (b.match?.overall ?? -1)-(a.match?.overall ?? -1)),[jobs,q,filter,source,careerStage,jobType,applicationState,validity]);
  const totalPages=Math.max(1,Math.ceil(visible.length/PAGE_SIZE));
  const paged=useMemo(()=>visible.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE),[visible,page]);

  useEffect(()=>setPage(1),[q,filter,source,careerStage,jobType,applicationState,validity]);
  useEffect(()=>{ if(page>totalPages)setPage(totalPages); },[page,totalPages]);

  return <>
    <input className="input" aria-label="Search jobs" placeholder="Search title, company, or location…" value={q} onChange={e=>setQ(e.target.value)}/>
    <details className="filter-panel">
      <summary>Filters</summary>
      <div className="filter-panel-body searchbar job-filters">
        <select className="select" aria-label="Match rating" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All match ratings</option><option value="exceptional">Exceptional</option><option value="strong">Strong</option><option value="reasonable">Reasonable</option><option value="stretch">Stretch</option><option value="skip">Skip</option></select>
        <select className="select" aria-label="Career stage" value={careerStage} onChange={e=>setCareerStage(e.target.value)}><option value="all">All stages</option><option value="internship">Internships</option><option value="new-grad">New grad</option><option value="entry-level">Entry level</option><option value="experienced">Experienced</option></select>
        <select className="select" aria-label="Job type" value={jobType} onChange={e=>setJobType(e.target.value as JobTypeFilter)}><option value="all">All job types</option><option value="full-time">Full-time</option><option value="part-time">Part-time</option><option value="contract">Contract</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="on-site">On-site</option></select>
        <select className="select" aria-label="Application state" value={applicationState} onChange={e=>setApplicationState(e.target.value as ApplicationFilter)}><option value="all">Any application status</option><option value="applied">Applied</option><option value="not-applied">Not applied</option></select>
        <select className="select" aria-label="Posting state" value={validity} onChange={e=>setValidity(e.target.value)}><option value="viable">Open or unverified</option><option value="verified">Verified active</option><option value="unknown">Unverified</option><option value="closed">Closed</option><option value="all">Any posting state</option></select>
        <select className="select" aria-label="Source" value={source} onChange={e=>setSource(e.target.value)}><option value="all">All sources</option>{sources.map(value=><option value={value} key={value}>{value}</option>)}</select>
      </div>
    </details>
    <div className="result-line"><span className="small muted">{visible.length} matching jobs</span><span className="small muted">Page {page} of {totalPages}</span></div>
    {!visible.length?<div className="notice">No jobs match the selected filters. Try another application state, job type, stage, posting state, source, or search term.</div>:null}
    <div className="table-wrap"><table><thead><tr><th>Job</th><th>Application</th><th>Type</th><th>Location</th><th>Posting</th><th>Match</th><th>Decision</th><th></th></tr></thead><tbody>{paged.map(job=>{const labels=jobTypeLabels(job);return <tr key={job.id}><td><div className="job-title">{job.title}</div><div className="job-company">{job.company}</div></td><td><span className="tag"><b>{applicationLabel(job.application)}</b></span></td><td>{labels.length?<div className="tag-list">{labels.slice(0,2).map(label=><span className="tag" key={label}>{label}</span>)}</div>:<span className="muted">—</span>}</td><td>{job.location||'—'}</td><td><span className="pill">{validityLabel(job.validityStatus)}</span></td><td><span className="score">{job.match?.overall ?? '—'}</span>{job.match?<span className="muted">/100</span>:null}</td><td>{job.match?<StatusPill value={job.match.recommendation}/>:<span className="pill">unanalyzed</span>}</td><td><a className="btn ghost" href={`/jobs/${job.id}`}>View</a></td></tr>})}</tbody></table></div>
    {totalPages>1?<div className="row" style={{justifyContent:'space-between',marginTop:'1rem'}}><button className="btn ghost" type="button" disabled={page<=1} onClick={()=>setPage(value=>Math.max(1,value-1))}>← Previous</button><span className="small muted">{visible.length} results</span><button className="btn ghost" type="button" disabled={page>=totalPages} onClick={()=>setPage(value=>Math.min(totalPages,value+1))}>Next →</button></div>:null}
  </>;
}
