import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/recruiters.json';
import contexts from '../data/recruiter-message-context.json';
import {buildRecruiterMessage,messagePlan,recommendedMessageDomain,recommendedMessageChannel,outreachFocus,messageChannels} from './recruiter-messages';
const person=(name:string)=>{const c=data.contacts.find(c=>c.name===name);assert.ok(c,name);return c;};
test('all directory contacts have reviewed drafting context and render all channels across supported candidate domains',()=>{
 for(const c of data.contacts){
  assert.ok(contexts[c.id as keyof typeof contexts],c.name);
  for(const domain of Object.keys(outreachFocus))for(const channel of messageChannels){
   const draft=buildRecruiterMessage(domain,channel,c);
   assert.ok(draft.body.startsWith('Hi '),c.name);assert.ok(draft.body.includes('permanent'),c.name);
   assert.ok(!/undefined|\[First name\]|\[Agency\]|NaN/.test(draft.body),c.name);
   assert.ok(!/Thank you for connecting|resume is attached|I have attached|your current vacancy|successfully placed me/i.test(draft.body),c.name);
   if(channel==='LinkedIn connection')assert.ok([...draft.body].length<=200,`${c.name}: ${draft.body.length}`);
   else assert.ok(draft.body.includes('Arnob'),c.name);
  }
 }
});
test('SAP searches do not turn Oracle experience into SAP experience or an application for a contract',()=>{
 const c=person("Derek O'Connor");const m=buildRecruiterMessage(recommendedMessageDomain(c),'Cold email',c);
 assert.match(m.body,/SAP Tester/);assert.match(m.body,/Oracle Fusion/);assert.match(m.body,/rather than that SAP testing contract/);assert.match(m.body,/permanent, full-time/);
});
test('specific software and data introductions use relevant different candidate evidence',()=>{
 const joey=buildRecruiterMessage(recommendedMessageDomain(person('Joey Kewin')),'Cold email',person('Joey Kewin'));
 const owen=buildRecruiterMessage(recommendedMessageDomain(person('Owen Williams')),'Cold email',person('Owen Williams'));
 assert.match(joey.body,/full-stack, web and mobile/);assert.match(joey.body,/personal CRM and browser games/);
 assert.match(owen.body,/Data Analyst/);assert.match(owen.body,/Python and SQL/);assert.ok(!owen.body.includes('browser games'));
});
test('off-domain specialists and unverified contacts receive referrals without invented desk claims',()=>{
 for(const name of ['Dave Tih','Ben Basian','Shelby Hurlburt']){
  const c=person(name);const domain=recommendedMessageDomain(c);assert.equal(recommendedMessageChannel(c),'Referral request');assert.equal(messagePlan(c,domain).routing,true);
  const draft=buildRecruiterMessage(domain,'Cold email',c);assert.match(draft.subject,/referral/);assert.match(draft.body,/If .* handles these searches/);
 }
 assert.match(buildRecruiterMessage('Software Engineering','Cold email',person('Ben Basian')).body,/investment professionals/);
});
test('supplier account contacts ask for a candidate-facing recruiter',()=>{
 assert.match(buildRecruiterMessage('ERP & Business Systems','Cold email',person('Lavina McKimm')).body,/candidate-facing recruiter/);
});
test('Tarah uses the user-described conversation without claiming an email or attached resume',()=>{
 const c=person('Tarah Katzberg');assert.equal(recommendedMessageDomain(c),'ERP & Business Systems');assert.equal(messagePlan(c,'ERP & Business Systems').label,'Existing conversation');
 assert.match(buildRecruiterMessage('ERP & Business Systems','Cold email',c).body,/your advice/);
});
test('follow-ups refer to an earlier message only after an outbound interaction was logged',()=>{
 const c=person('Joey Kewin');const first=buildRecruiterMessage('Software Engineering','Follow-up',c);
 assert.ok(!first.body.includes('my earlier message'));assert.match(first.note,/No sent message/);
 const sent=buildRecruiterMessage('Software Engineering','Follow-up',c,{activities:[{at:'2026-11-01T12:00:00Z',channel:'Email',note:'Sent introduction'}]});assert.match(sent.body,/my earlier message/);
 const unsent=buildRecruiterMessage('Software Engineering','Follow-up',c,{stage:'Connected',activities:[]});assert.ok(!unsent.body.includes('my earlier message'));
});
test('selected unsupported domain switches a specialist to routing, and alternate supported domains use their own focus',()=>{
 const c=person('Anna Siu');assert.equal(messagePlan(c,'Administrative').routing,true);
 const cloud=buildRecruiterMessage('Cloud & DevOps','Cold email',c);assert.match(cloud.body,/cloud and DevOps/);assert.ok(!cloud.body.includes('IT risk and governance'));
});
test('explicit senior/executive and contract desks get permanent early-career referral requests',()=>{
 for(const name of ['Ian Kinsella','Mark Garbe','Priscilla Poirier','Kush Baudi']){
  const c=person(name);assert.equal(recommendedMessageChannel(c),'Referral request',name);
 }
});
test('a manually added contact keeps the user-selected target without treating it as verified hiring history',()=>{
 const c={id:'custom-example',name:'Example Contact',company:'Example Agency',title:'Recruiter',verification:'User-added',domains:['Software Engineering']};
 assert.equal(recommendedMessageDomain(c),'Software Engineering');assert.equal(messagePlan(c,'Software Engineering').routing,true);
 assert.match(buildRecruiterMessage('Software Engineering','Cold email',c).body,/If Example Agency handles these searches/);
});
test('explicit referral channel asks for an introduction even when the recipient has a matching specialty',()=>{
 const c=person('Joey Kewin');assert.match(buildRecruiterMessage('Software Engineering','Referral request',c).body,/could you suggest the appropriate recruiter/);
});
test('property developers are not software developers in directory tags or default introductions',()=>{
 for(const name of ['Ben Basian','Carl Anthony']){const c=person(name);assert.ok(!(c.domains as string[]).includes('Software Engineering'));assert.equal(recommendedMessageChannel(c),'Referral request');}
});
