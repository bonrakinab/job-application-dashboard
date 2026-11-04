import {collapseDuplicateJobs} from '@/lib/job-duplicates';
import {sendDigest,readJobAlertHistory} from '@/lib/gmail';
import {isMainCareerJob} from '@/lib/part-time-jobs';
import {runDiscoveryAndAnalysis} from '@/lib/orchestrator';
import {isLiveMode,listJobs,logActivity,saveJobValidity} from '@/lib/store';
import {ALERT_WINDOW_HOURS,verifyAlertJob,proofStillFresh,type AlertProof} from '@/lib/job-alert-validation';
import {alertAlreadySent} from '@/lib/job-alert-history';
export const runtime='nodejs';
export const maxDuration=300;
function authorizedCron(request:Request){const secret=process.env.CRON_SECRET?.trim();return secret?request.headers.get('authorization')===`Bearer ${secret}`:request.headers.get('user-agent')?.toLowerCase().includes('vercel-cron/1.0')??false;}
async function safeLogActivity(event:string,payload:unknown){try{await logActivity(event,undefined,payload);}catch{/* Logging must not cause email retries after a successful send. */}}
export async function GET(request:Request){
 if(!authorizedCron(request))return new Response('Unauthorized',{status:401});
 // Demo/sample jobs must never leave the application as real job alerts.
 if(!isLiveMode())return Response.json({error:'Live job storage is required for alerts.',mailSkipped:true},{status:503});
 try{
  const discovery=await runDiscoveryAndAnalysis();
  const cutoff=Date.now()-ALERT_WINDOW_HOURS*3_600_000;
  const recentHint=(v?:string)=>{const t=v?Date.parse(v):NaN;return Number.isFinite(t)&&t>=cutoff&&t<=Date.now()?1:0;};
  const candidates=collapseDuplicateJobs((await listJobs(1000)).filter(isMainCareerJob).filter(j=>j.match&&['exceptional','strong','reasonable'].includes(j.match.recommendation)&&!j.match.blockers?.length&&!['closed','likely_closed'].includes(j.validityStatus??'unknown'))).jobs
   .sort((a,b)=>recentHint(b.postedAt)-recentHint(a.postedAt)||(b.match?.overall??0)-(a.match?.overall??0)).slice(0,36);
  const verified:Array<{job:typeof candidates[number];proof:AlertProof}>=[];
  const excluded:Array<{id?:string;reason:string}>=[];
  for(let start=0;start<candidates.length;start+=4){
   const batch=await Promise.all(candidates.slice(start,start+4).map(async job=>({job,check:await verifyAlertJob(job)})));
   for(const {job,check} of batch){
    if(check.eligible)verified.push({job,proof:check.proof});
    else{
     excluded.push({id:job.id,reason:check.reason});
     if(check.closed&&job.id)await saveJobValidity(job.id,{validityStatus:'closed',healthScore:5,lastVerifiedAt:new Date().toISOString(),verificationMethod:'alert-live-source',verificationSignals:[check.reason],closureReason:check.reason});
    }
   }
  }
  if(!verified.length){await safeLogActivity('cron.daily.completed',{digestJobs:0,mailSkipped:true,reason:'No source-verified open jobs originally posted within 72 hours.',checked:candidates.length,excluded});return Response.json({ok:true,digestJobs:0,mailSkipped:true,checked:candidates.length,excluded});}
  // Both sources are checked: this digest and the ChatGPT-scheduled Gmail alerts.
  // If Gmail cannot be read, the error aborts sending instead of bypassing deduplication.
  const history=await readJobAlertHistory();
  const jobs=verified.filter(({job,proof})=>proofStillFresh(proof)&&!alertAlreadySent({...job,applyUrl:proof.applyUrl},history)).slice(0,12);
  if(!jobs.length){await safeLogActivity('cron.daily.completed',{digestJobs:0,mailSkipped:true,reason:'All verified listings were already sent or aged out before sending.'});return Response.json({ok:true,digestJobs:0,mailSkipped:true});}
  const lines=jobs.map(({job,proof},i)=>`${i+1}. ${proof.title} — ${proof.company}\n   ${proof.location}\n   Match: ${job.match?.overall}/100 · ${job.match?.recommendation}\n   Original publication: ${proof.publication.label}\n   Source field: ${proof.publication.field}\n   Live application verified: ${proof.verifiedAt}\n   ${proof.applyUrl}`);
  const appUrl=process.env.NEXT_PUBLIC_APP_URL||'';
  const text=['Job Agent — verified open jobs',`Only source-verified original postings within the last ${ALERT_WINDOW_HOURS} hours are included.`,'',...lines,'',appUrl?`Dashboard: ${appUrl}/recommended`:''].filter(Boolean).join('\n');
  const mail=await sendDigest(`Job Agent: ${jobs.length} verified matches within 72 hours`,text);
  await safeLogActivity('cron.daily.completed',{discoveryFetched:discovery.fetched,digestJobs:mail.skipped?0:jobs.length,mailSkipped:mail.skipped,checked:candidates.length,excluded,alertProofs:mail.skipped?[]:jobs.map(({job,proof})=>({id:job.id,...proof}))});
  return Response.json({ok:true,digestJobs:mail.skipped?0:jobs.length,mail,checked:candidates.length,excluded});
 }catch(error){const message=error instanceof Error?error.message:String(error);await safeLogActivity('cron.daily.failed',{error:message.slice(0,1200),mailPolicy:'Strict original-publication 72h plus live source verification; no unverified fallback.'});return Response.json({error:message,mailSkipped:true},{status:500});}
}
