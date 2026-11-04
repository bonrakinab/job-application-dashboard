import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyAlertJob,publicationProof,proofStillFresh,canonicalAlertUrl,ALERT_WINDOW_HOURS} from './job-alert-validation';
import {alertAlreadySent} from './job-alert-history';
import type {Job} from './types';
const now=Date.parse('2026-11-04T01:00:00Z');
const url='https://job-boards.greenhouse.io/example/jobs/123';
const job:Job={source:'greenhouse',sourceKey:'example',externalId:'123',title:'Junior Software Developer',company:'Example Inc.',location:'Toronto, Ontario',url,description:'Software development vacancy with junior experience requirements.',postedAt:new Date(now).toISOString(),discoveredAt:new Date(now-1000).toISOString(),lastSeenAt:new Date(now).toISOString()};
const live={id:123,internal_job_id:456,title:job.title,company_name:'Example',location:{name:'Toronto, Ontario'},content:'<p>A current junior software development role working with Python, SQL and web applications. Please apply using the application form.</p>',first_published:new Date(now-24*3600000).toISOString(),updated_at:new Date(now).toISOString(),absolute_url:url,questions:[{label:'Resume'}]};
function mock(value:unknown,status=200):typeof fetch{return (async()=>new Response(typeof value==='string'?value:JSON.stringify(value),{status})) as typeof fetch;}
test('a verified job uses original employer publication, identity and application evidence',async()=>{
 const r=await verifyAlertJob(job,{now,fetcher:mock(live)});assert.equal(r.eligible,true);if(!r.eligible)return;
 assert.equal(r.proof.publication.field,'Greenhouse first_published');assert.equal(r.proof.title,job.title);assert.equal(r.proof.applyUrl,url);assert.equal(proofStillFresh(r.proof,now),true);assert.equal(proofStillFresh(r.proof,now+6*60000),false);
});
test('strict inclusive 72-hour boundary rejects older, future and undated publications',()=>{
 assert.equal(ALERT_WINDOW_HOURS,72);assert.ok(publicationProof(new Date(now-72*3600000).toISOString(),'datePosted',now));
 for(const value of [new Date(now-72*3600000-1).toISOString(),new Date(now+1).toISOString(),undefined,'Posted 3 Days Ago','2026-11-03T12:00:00'])assert.equal(publicationProof(value,'datePosted',now),undefined,String(value));
});
test('calendar dates use conservative global timezone bounds, never an invented exact midnight',()=>{
 const r=publicationProof('2026-11-02','datePosted',now);assert.ok(r);assert.equal(r.precision,'date-only');assert.notEqual(r.earliest,r.latest);assert.equal(publicationProof('2026-11-01','datePosted',now),undefined);assert.equal(publicationProof('2026-02-30','datePosted',now),undefined);
});
test('feed update/discovery timestamps cannot make an old or undated job fresh',async()=>{
 for(const date of ['2026-10-14T17:40:28-04:00',undefined]){
  const r=await verifyAlertJob(job,{now,fetcher:mock({...live,first_published:date,updated_at:new Date(now).toISOString()})});assert.equal(r.eligible,false);if(!r.eligible)assert.match(r.reason,/Original publication/);
 }
});
test('HTTP success, access errors and a successful unrelated JSON body are never availability proof',async()=>{
 for(const [body,status] of [['<h1>Careers</h1>',200],['Not found',404],['Forbidden',403],['Rate limited',429],['Maintenance',503],[{},200]] as [unknown,number][]){
  const r=await verifyAlertJob(job,{now,fetcher:mock(body,status)});assert.equal(r.eligible,false,`${status}`);
 }
 const failed=await verifyAlertJob(job,{now,fetcher:(async()=>{throw Error('timeout');}) as typeof fetch});assert.equal(failed.eligible,false);
});
test('wrong job, company, title, closed deadline, future-vacancy language and prospect posts are excluded',async()=>{
 for(const change of [{id:999},{company_name:'Another employer'},{title:'Senior Manager'},{internal_job_id:null},{application_deadline:'2026-11-01T00:00:00Z'},{content:live.content+' This position has been filled.'},{content:live.content+' This posting is for a future vacancy.'},{questions:[]},{location:{name:'New York, United States'}}]){
  const r=await verifyAlertJob(job,{now,fetcher:mock({...live,...change})});assert.equal(r.eligible,false,JSON.stringify(change));
 }
});
test('a repost cannot reset a vacancy already observed outside the release window',async()=>{
 const r=await verifyAlertJob({...job,discoveredAt:'2026-10-01T00:00:00Z'},{now,fetcher:mock(live)});assert.equal(r.eligible,false);if(!r.eligible)assert.match(r.reason,/already known/);
});
test('generic employer pages and JS shells with no job-specific structured evidence are excluded',async()=>{
 const other={...job,source:'manual',url:'https://example.com/careers/job-123'};
 for(const body of ['<h1>Junior Software Developer</h1><button>Apply</button>','<div id="root"></div>'])assert.equal((await verifyAlertJob(other,{now,fetcher:mock(body)})).eligible,false);
});
test('matching live employer JobPosting needs actual application action and a source publication date',async()=>{
 const other={...job,source:'manual',url:'https://example.com/careers/job-123'};
 const schema={'@type':'JobPosting',title:job.title,hiringOrganization:{name:'Example Inc.'},description:live.content,datePosted:live.first_published,url:other.url,identifier:{value:'123'},jobLocation:{address:{addressLocality:'Toronto',addressRegion:'Ontario',addressCountry:'CA'}}};
 const html=`<script type="application/ld+json">${JSON.stringify(schema)}</script><a href="/apply/123">Apply now</a>`;
 assert.equal((await verifyAlertJob(other,{now,fetcher:mock(html)})).eligible,true);
 assert.equal((await verifyAlertJob(other,{now,fetcher:mock(html.replace('<a href="/apply/123">Apply now</a>',''))})).eligible,false);
});
test('aggregators, demo links and non-public URLs cannot be treated as authoritative sources',async()=>{
 for(const url of ['https://himalayas.app/jobs/123','http://example.com/jobs/123','https://127.0.0.1/jobs/123','https://foo.localhost/jobs/123','#'])assert.equal((await verifyAlertJob({...job,url},{now,fetcher:mock(live)})).eligible,false,url);
});
test('Gmail history deduplicates exact jobs across tracking parameters and title/employer matches',()=>{
 assert.equal(canonicalAlertUrl(url+'?utm_source=email&gh_src=foo'),canonicalAlertUrl(url));
 assert.equal(alertAlreadySent(job,[`<a href="${url}?utm_source=chatgpt&amp;gh_src=bar">Apply</a>`]),true);
 assert.equal(alertAlreadySent(job,['Junior Software Developer — Example Inc.']),true);
 assert.equal(alertAlreadySent(job,['A different job at Another Company']),false);
});
test('ambiguous Ontario-named cities in other regions are not accepted as Ontario vacancies',async()=>{
 for(const name of ['London, UK','Cambridge, MA','Windsor, CT','Waterloo, Iowa'])assert.equal((await verifyAlertJob(job,{now,fetcher:mock({...live,location:{name}})})).eligible,false,name);
 assert.equal((await verifyAlertJob(job,{now,fetcher:mock({...live,location:{name:'Remote - Canada'}})})).eligible,true);
});
test('an ATS record cannot supply a generic or unrelated careers homepage as its application link',async()=>{
 assert.equal((await verifyAlertJob(job,{now,fetcher:mock({...live,absolute_url:'https://example.com/careers'})})).eligible,false);
 assert.equal((await verifyAlertJob(job,{now,fetcher:mock({...live,absolute_url:'https://example.com/careers?gh_jid=123'})})).eligible,true);
});
