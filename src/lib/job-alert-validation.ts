import type {Job} from './types';
import {stripHtml} from './utils';

export const ALERT_WINDOW_HOURS=72;
const HOUR=3_600_000;
export type PublicationProof={earliest:string;latest:string;label:string;precision:'timestamp'|'date-only';field:string};
export type AlertProof={title:string;company:string;location:string;jobId:string;applyUrl:string;sourceUrl:string;verifiedAt:string;publication:PublicationProof};
export type AlertCheck={eligible:true;proof:AlertProof}|{eligible:false;reason:string;closed?:boolean};
type Obj=Record<string,any>;
const norm=(s:unknown)=>String(s??'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const plain=(s:unknown)=>stripHtml(String(s??'').replace(/&lt;/g,'<').replace(/&gt;/g,'>'));
function companyMatches(a:string,b:string){const clean=(v:string)=>norm(v).replace(/\b(inc|incorporated|corp|corporation|ltd|limited|llc|company|co|canada)\b/g,'').replace(/\s+/g,' ').trim();const x=clean(a),y=clean(b);return x.length>=3&&y.length>=3&&(x===y||x.startsWith(y+' ')||y.startsWith(x+' '));}
export function publicJobUrl(value:string){try{const u=new URL(value);const h=u.hostname.toLowerCase();return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&h.includes('.')&&!h.endsWith('.local')&&!h.endsWith('.internal')&&h!=='localhost'&&!h.endsWith('.localhost')&&!/^(?:\d+\.){3}\d+$/.test(h)&&!h.includes(':');}catch{return false;}}
function specificJobUrl(value:string,id:string){try{const u=new URL(value);const path=u.pathname.toLowerCase().replace(/\/$/,'')||'/';const generic=path==='/'||/(?:^|\/)(?:careers?|jobs?|search)(?:\/(?:search|jobs?))?$/.test(path);return !generic||[...u.searchParams.values()].some(v=>v===id);}catch{return false;}}
export function canonicalAlertUrl(value:string){try{const u=new URL(value);u.hash='';for(const key of [...u.searchParams.keys()])if(/^(utm_|gh_src$|source$|src$|ref$|tracking)/i.test(key))u.searchParams.delete(key);u.searchParams.sort();return u.toString().replace(/\/$/,'');}catch{return '';}}
export function publicationProof(value:unknown,field:string,now:number):PublicationProof|undefined{
 if(typeof value!=='string')return;
 if(/^\d{4}-\d{2}-\d{2}$/.test(value)){
  const day=Date.parse(value+'T00:00:00Z');if(!Number.isFinite(day)||new Date(day).toISOString().slice(0,10)!==value||value>new Date(now).toISOString().slice(0,10))return;
  // No source timezone: use the earliest possible instant across UTC+14..UTC-12.
  // This interval is evidence bounds, never a fabricated exact posted_at value.
  const earliest=day-14*HOUR,latest=Math.min(day+36*HOUR,now);
  if(earliest>now||earliest<now-ALERT_WINDOW_HOURS*HOUR)return;
  return {earliest:new Date(earliest).toISOString(),latest:new Date(latest).toISOString(),label:value+' (source date only; conservative timezone bounds)',precision:'date-only',field};
 }
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(value))return;
 const calendar=value.slice(0,10);const day=Date.parse(calendar+'T00:00:00Z');if(!Number.isFinite(day)||new Date(day).toISOString().slice(0,10)!==calendar)return;
 const t=Date.parse(value);if(!Number.isFinite(t)||t>now||t<now-ALERT_WINDOW_HOURS*HOUR)return;
 return {earliest:new Date(t).toISOString(),latest:new Date(t).toISOString(),label:value,precision:'timestamp',field};
}
export function proofStillFresh(proof:AlertProof,now=Date.now()){const first=Date.parse(proof.publication.earliest),verified=Date.parse(proof.verifiedAt);return Number.isFinite(first)&&first>=now-ALERT_WINDOW_HOURS*HOUR&&first<=now&&verified<=now&&verified>=now-5*60_000;}
export function alertClosureReason(text:string){const t=plain(text);return /(?:job|position|requisition|vacancy|posting)\s+(?:(?:is|has been|was)\s+)?(?:no longer available|filled|closed|expired)|no longer accepting applications|applications? (?:are|is|have) closed|not accepting applications|job not found/i.test(t)?'The source says the vacancy is closed or unavailable.':/future vacanc(?:y|ies)|talent (?:pool|pipeline|community)|evergreen (?:requisition|posting|role)|expressions? of interest|anticipated (?:opening|vacancy)|not (?:currently )?(?:for |associated with )?(?:an? )?(?:existing|current|active) (?:vacancy|opening|position)/i.test(t)?'Future vacancy, talent pool or non-current opening.':undefined;}
function ontarioEligible(location:string,remote=false){const l=norm(location);if(/\bontario\b/.test(l)||/\bON\b/.test(location))return !/\b(?:united states|connecticut|ohio|england|united kingdom)\b/.test(l);if(/\bcanada\b/.test(l)&&/\b(?:toronto|ottawa|waterloo|kitchener|windsor|mississauga|brampton|markham|hamilton|guelph|burlington|oakville|london|barrie|kingston|oshawa|vaughan|niagara|sudbury|cambridge)\b/.test(l))return true;return /\bcanada\b/.test(l)&&(remote||/\bremote\b/.test(l))&&!/\b(?:quebec only|british columbia only|alberta only)\b/.test(l);}

async function read(url:string,fetcher:typeof fetch){if(!publicJobUrl(url))throw Error('Unsupported source URL');const response=await fetcher(url,{headers:{Accept:'application/json,text/html;q=0.9','User-Agent':'JobApplicationDashboard/1.0 personal-job-search'},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10_000)});if(!response.ok)throw Error(`Source returned HTTP ${response.status}`);return {response,body:(await response.text()).slice(0,1_000_000)};}
function structuredPostings(value:unknown):Obj[]{if(Array.isArray(value))return value.flatMap(structuredPostings);if(!value||typeof value!=='object')return [];const v=value as Obj;const types=Array.isArray(v['@type'])?v['@type']:[v['@type']];return [...(types.includes('JobPosting')?[v]:[]),...structuredPostings(v['@graph'])];}
export function htmlJobPostings(body:string){const jobs:Obj[]=[];for(const m of body.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{jobs.push(...structuredPostings(JSON.parse(m[1])));}catch{ /* Malformed JSON is not proof. */ }}return jobs;}
function postingLocations(v:unknown):string[]{if(Array.isArray(v))return v.flatMap(postingLocations);if(typeof v==='string')return [v];if(!v||typeof v!=='object')return [];const o=v as Obj;return [o.name,o.addressLocality,o.addressRegion,typeof o.addressCountry==='string'?o.addressCountry:o.addressCountry?.name,...postingLocations(o.address)].filter(x=>typeof x==='string');}

export async function verifyAlertJob(job:Job,options:{now?:number;fetcher?:typeof fetch}={}):Promise<AlertCheck>{
 const now=options.now??Date.now(),fetcher=options.fetcher??fetch;
 if(['closed','likely_closed'].includes(job.validityStatus??''))return {eligible:false,reason:'Previously marked closed; not eligible for alerting.'};
 const storedClosure=alertClosureReason(job.title+' '+job.description);if(storedClosure)return {eligible:false,reason:storedClosure};
 const observed=job.applyUrl||job.url;if(!publicJobUrl(observed))return {eligible:false,reason:'No supported HTTPS job-specific URL.'};
 try{
  const u=new URL(observed);let title='',company='',location='',description='',id='',applyUrl=observed,sourceUrl=observed,date:unknown,field='',expiry:unknown,remote=false;
  const gh=u.hostname.match(/^(?:job-boards|boards)\.greenhouse\.io$/)?u.pathname.match(/^\/([^/]+)\/jobs\/(\d+)\/?$/):null;
  const lever=u.hostname==='jobs.lever.co'?u.pathname.match(/^\/([^/]+)\/([^/]+)(?:\/apply)?\/?$/):null;
  const ashby=u.hostname==='jobs.ashbyhq.com'?u.pathname.match(/^\/([^/]+)\/([^/]+)(?:\/application)?\/?$/):null;
  if(gh){
   sourceUrl=`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(gh[1])}/jobs/${gh[2]}?questions=true`;
   const {body}=await read(sourceUrl,fetcher);const v=JSON.parse(body) as Obj;
   if(String(v.id)!==gh[2]||!v.internal_job_id||!Array.isArray(v.questions)||!v.questions.length)return {eligible:false,reason:'ATS identity/application fields are missing or this is a prospect post.'};
   title=String(v.title??'');company=String(v.company_name??'');location=String(v.location?.name??'');description=plain(v.content);id=String(v.id);applyUrl=String(v.absolute_url??'');date=v.first_published;field='Greenhouse first_published';expiry=v.application_deadline;
  }else if(lever){
   sourceUrl=`https://api.lever.co/v0/postings/${encodeURIComponent(lever[1])}/${encodeURIComponent(lever[2])}?mode=json`;
   const {body}=await read(sourceUrl,fetcher);const v=JSON.parse(body) as Obj;
   if(v.id!==lever[2]||!(job.source==='lever'&&job.sourceKey===lever[1]||companyMatches(job.company,lever[1])))return {eligible:false,reason:'Lever job/board identity did not match.'};
   title=String(v.text??'');company=job.company;location=String(v.categories?.location??'');description=plain(v.descriptionPlain||v.description);id=String(v.id);applyUrl=String(v.applyUrl||v.hostedUrl||'');date=typeof v.createdAt==='number'?new Date(v.createdAt).toISOString():undefined;field='Lever createdAt (creation bounds publication)';remote=v.workplaceType==='remote';
  }else if(ashby){
   sourceUrl=`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(ashby[1])}`;
   const {body}=await read(sourceUrl,fetcher);const payload=JSON.parse(body) as Obj;const v=Array.isArray(payload.jobs)?payload.jobs.find((v:Obj)=>{try{return new URL(v.jobUrl).pathname.split('/').filter(Boolean).at(-1)===ashby[2];}catch{return false;}}):undefined;
   if(!v||v.isListed===false||!(job.source==='ashby'&&job.sourceKey===ashby[1]||companyMatches(job.company,ashby[1])))return {eligible:false,reason:'The exact job is absent from its public ATS board.'};
   title=String(v.title??'');company=job.company;location=String(v.location??'');description=plain(v.descriptionPlain);id=ashby[2];applyUrl=String(v.applyUrl||v.jobUrl||'');date=v.publishedAt;field='Ashby publishedAt';remote=v.isRemote===true;
  }else{
   if(/(?:^|\.)(?:linkedin\.com|indeed\.com|glassdoor\.com|jobicy\.com|himalayas\.app|remoteok\.com|remotive\.com|jobgether\.com|weworkremotely\.com)$/.test(u.hostname))return {eligible:false,reason:'Aggregator/discovery page is not an authoritative employer application source.'};
   const {body}=await read(observed,fetcher);const blocked=alertClosureReason(body);if(blocked)return {eligible:false,reason:blocked,closed:!/future|talent|non-current/i.test(blocked)};
   const postings=htmlJobPostings(body);const v=postings.find(p=>norm(p.title)===norm(job.title)&&companyMatches(job.company,String(p.hiringOrganization?.name??'')));
   if(!v)return {eligible:false,reason:'No matching employer/title JobPosting evidence on the live detail page.'};
   const sourceId=String(typeof v.identifier==='object'?v.identifier?.value??'':v.identifier??'');
   if(postings.length!==1&&!sourceId.includes(job.externalId))return {eligible:false,reason:'Generic multi-job page is not proof of the specific vacancy.'};
   if(!/(?:<button[^>]*>[\s\S]{0,160}?apply|<a\b[^>]*href=["'][^"']+["'][^>]*>[\s\S]{0,160}?apply|<form\b[^>]*(?:apply|application))/i.test(body))return {eligible:false,reason:'No usable application action found on the live page.'};
   title=String(v.title);company=String(v.hiringOrganization.name);location=postingLocations(v.jobLocation).join(', ');remote=v.jobLocationType==='TELECOMMUTE';if(remote)location+=' '+postingLocations(v.applicantLocationRequirements).join(', ');description=plain(v.description);id=sourceId||job.externalId;date=v.datePosted;field='Employer JobPosting.datePosted';expiry=v.validThrough;
   if(v.url&&canonicalAlertUrl(String(v.url))!==canonicalAlertUrl(observed))return {eligible:false,reason:'Structured job URL does not match the requested detail page.'};
  }
  if(!norm(title)||!id||norm(title)!==norm(job.title)||!companyMatches(job.company,company)||description.length<80||!publicJobUrl(applyUrl)||!specificJobUrl(applyUrl,id))return {eligible:false,reason:'Live vacancy identity, description or application URL failed validation.'};
  if(!ontarioEligible(location,remote))return {eligible:false,reason:'Live source does not confirm Ontario or Ontario-eligible Canadian remote work.'};
  const closed=alertClosureReason(title+' '+description);if(closed)return {eligible:false,reason:closed,closed:!/future|talent|non-current/i.test(closed)};
  if(expiry){const until=Date.parse(String(expiry));if(!Number.isFinite(until))return {eligible:false,reason:'Unclear application deadline.'};if(until<=now)return {eligible:false,reason:'The application deadline has passed.',closed:true};}
  const publication=publicationProof(date,field,now);if(!publication)return {eligible:false,reason:'Original publication is unknown, ambiguous, future-dated or older than 72 hours.'};
  // A vacancy already observed before this window cannot become new through a repost/update.
  if(job.discoveredAt&&Date.parse(job.discoveredAt)<now-ALERT_WINDOW_HOURS*HOUR)return {eligible:false,reason:'This vacancy was already known before the 72-hour release window.'};
  return {eligible:true,proof:{title,company,location,jobId:id,applyUrl,sourceUrl,verifiedAt:new Date(now).toISOString(),publication}};
 }catch(error){return {eligible:false,reason:`Live source could not be verified: ${error instanceof Error?error.message.slice(0,160):'request failed'}`};}
}
