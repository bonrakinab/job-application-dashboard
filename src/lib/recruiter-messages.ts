import {outreachFocus} from './recruiter-message-focus';
import {recruiterContactKind} from './recruiter-directory';
import profiles from '../data/recruiter-message-context.json';
export {outreachFocus};
export type MessageContact={id:string;name:string;company:string;title:string;verification:string;notes?:string;contactKind?:string;identityStatus?:string;domains:string[];domainEvidence?:{domain:string;basis:string;source:string;summary:string;limitation:string}[]};
export type MessageTrack={stage?:string;activities?:{channel:string;note:string;at:string}[]};
type Context={focus:string;hook:string;source:string;basis:string;preferredDomain?:string;constraint?:string;warm?:boolean;candidateEvidence?:string;referralOnly?:boolean};
const contexts=profiles as Record<string,Context>;
const preferred=['ERP & Business Systems','Software Engineering','AI & Data','Cloud & DevOps','IT Support','Administrative','Cybersecurity','Technology (general)','General Staffing'];
export const messageChannels=['Cold email','LinkedIn connection','LinkedIn message','Referral request','Follow-up'];
export function recommendedMessageDomain(c:MessageContact){return contexts[c.id]?.preferredDomain||preferred.find(d=>c.domainEvidence?.some(e=>e.domain===d))||(c.id.startsWith('custom-')?preferred.find(d=>c.domains.includes(d)):undefined)||'ERP & Business Systems';}
export function messagePlan(c:MessageContact|undefined,domain:string){
 const profile=c?contexts[c.id]:undefined;
 const evidence=c?.domainEvidence?.find(e=>e.domain===domain);
 const kind=c?recruiterContactKind(c):'';
 const supplier=kind==='Supplier account contacts';
 const routing=supplier||!!profile?.referralOnly||(!profile?.warm&&!evidence);
 return {profile,evidence,routing,supplier,label:profile?.warm?'Existing conversation':supplier?'Ask for the candidate recruitment contact':routing?'Ask for a relevant referral':'Introduce relevant experience',reason:profile?.warm?'Uses the conversation you described; does not assume a previous email or attached resume.':supplier?'This is a supplier/account contact, so the draft asks for a candidate-facing recruiter.':profile?.referralOnly?'The documented focus is senior, executive or contract recruitment. The draft asks for a permanent early-career desk referral.':!evidence?'No person-level evidence for the selected domain. The draft asks for routing without assigning that specialty to this person.':`${evidence.basis}; the draft references the documented focus and keeps your permanent, early-career preference clear.`,sources:evidence?.source?[evidence.source]:profile?.source?[profile.source]:[]};
}
export function recommendedMessageChannel(c:MessageContact){return messagePlan(c,recommendedMessageDomain(c)).routing?'Referral request':'Cold email';}
function firstName(name:string){return name.replace(/^(?:Dr\.?|Mr\.?|Ms\.?|Mrs\.?)\s+/i,'').split(/[\s,]+/)[0]||'[First name]';}
function connectionNote(name:string,domain:string,focus:string|undefined,routing:boolean,warm:boolean){
 const f=outreachFocus[domain];
 const target=domain==='ERP & Business Systems'?'ERP support':domain==='Technology (general)'||domain==='General Staffing'?'IT':f.short;
 const options=warm?[
  `Hi ${name}, thanks for your guidance on approaching recruiters. I’m exploring permanent ${target} roles in Ontario and would appreciate staying connected.`,
 ]:[
  focus?`Hi ${name}, I noticed your work in ${focus}. I’m seeking permanent ${target} roles in Ontario. Could we connect${routing?'? I’d appreciate a relevant referral.':'?'}`:'',
  `Hi ${name}, I’m an MSc CS graduate seeking permanent ${target} roles in Ontario. Could we connect? I’d appreciate guidance on the right recruitment contact.`,
 ];
 return options.find(v=>v&&[...v].length<=200)||`Hi ${name.slice(0,35)}, I’m seeking permanent early-career IT roles in Ontario. Could we connect? I’d appreciate guidance on the right recruitment contact.`;
}
export function buildRecruiterMessage(domain:string,channel:string,c?:MessageContact,track?:MessageTrack){
 const selected=outreachFocus[domain]?domain:'ERP & Business Systems';const f=outreachFocus[selected];
 const name=c?firstName(c.name):'[First name]';const company=c?.company||'[Agency]';const plan=messagePlan(c,selected);const p=plan.profile;
 const request=plan.supplier?`Could you direct me to the candidate-facing recruiter at ${company} who handles enquiries in this area?`:(plan.routing||channel==='Referral request')?`If ${company} handles these searches, could you suggest the appropriate recruiter or pass along my details?`:`Are you handling suitable openings at ${company}? I’d welcome the chance to share my resume for consideration.`;
 const alternateFocus:Record<string,string>={'ERP & Business Systems':'enterprise applications','Software Engineering':'software development','AI & Data':'data','Cloud & DevOps':'cloud and DevOps','Cybersecurity':'cybersecurity','Administrative':'administrative support','Technology (general)':'technology','IT Support':'IT support','General Staffing':'staffing'};
 const alternate=!!c&&selected!==recommendedMessageDomain(c)&&!!plan.evidence;
 const selectedHook=alternate?plan.evidence?.basis==='Attributed hiring activity'?`I came across recruitment activity you shared involving ${alternateFocus[selected]||f.short}.`:`Your individual profile includes recruitment work involving ${alternateFocus[selected]||f.short}.`:p?.hook;
 const hook=p?.warm?p.hook:selectedHook?`${selectedHook}${plan.routing&&p?.focus?' I’m reaching out for guidance on a different recruitment area.':''}`:c?`I’m hoping to reach the right recruitment contact at ${company}.`:'I’m reaching out to introduce myself and learn whether you handle the opportunities I’m targeting.';
 const note=c&&selected===recommendedMessageDomain(c)?p?.constraint||'':'';
 const experience=c&&selected===recommendedMessageDomain(c)&&p?.candidateEvidence?p.candidateEvidence:f.evidence;
 const candidate=`I’m Arnob Banik, an MSc Computer Science graduate from the University of Windsor. ${experience}`;
 const subject=`Permanent ${f.short} opportunities — Arnob Banik`;
 const signature='Arnob Banik\narnob.bnk@gmail.com';
 const sourceNote=!c?'Choose a recruiter to personalize this draft.':plan.reason;
 if(channel==='LinkedIn connection')return {subject:'',body:connectionNote(name,selected,alternate?`${alternateFocus[selected]||f.short} recruitment`:p?.focus,plan.routing,!!p?.warm),note:sourceNote};
 if(channel==='Follow-up'){
  const sent=track?.activities?.some(a=>['Email','LinkedIn request','LinkedIn message'].includes(a.channel));
  if(sent||p?.warm){
   const intro=sent?`I’m following up on my earlier message about permanent ${f.role} opportunities in Ontario.`:`I wanted to follow up on our conversation about approaching staffing recruiters. I’m seeking permanent, full-time ${f.role} roles in Ontario.`;
   return {subject:`Following up — permanent ${f.short} opportunities`,body:`Hi ${name},\n\n${intro}\n\n${experience}\n\n${request}\n\nThank you,\n${signature}`,note:sourceNote};
  }
  return {subject,body:`Hi ${name},\n\n${hook}\n\n${candidate}\n\nI’m looking for permanent, full-time ${f.role} roles in Ontario. ${request}\n\nThank you,\n${signature}`,note:'No sent message is logged for this person. This is written as an introduction so it does not invent a previous exchange.'};
 }
 if(channel==='LinkedIn message')return {subject:'',body:`Hi ${name},\n\n${hook}\n\n${experience}\n\nI’m looking for permanent, full-time ${f.role} roles in Ontario.${note?' '+note:''} ${request}\n\nThank you for your time.\nArnob`,note:sourceNote};
 if(channel==='Referral request'||plan.routing)return {subject:`Recruiter referral — permanent ${f.short} roles`,body:`Hi ${name},\n\n${hook}\n\n${plan.supplier?experience:candidate}\n\nI’m seeking permanent, full-time ${f.role} roles across Ontario, including remote roles open to Ontario residents.${note?' '+note:''}\n\n${request}\n\nThank you,\n${signature}`,note:sourceNote};
 return {subject,body:`Hi ${name},\n\n${hook}\n\n${candidate}\n\nI’m looking for permanent, full-time ${f.role} roles in Ontario, including remote opportunities open to Ontario residents.${note?' '+note:''}\n\n${request}\n\nThank you for your time,\n${signature}`,note:sourceNote};
}
