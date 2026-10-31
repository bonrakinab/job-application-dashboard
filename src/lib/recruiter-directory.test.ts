import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/recruiters.json';
import original from '../data/recruiter-original-ids.json';
import {companyContactCounts,matchesContactKind,recruiterContactKind} from './recruiter-directory';
test('network expansion preserves every original contact ID and identity used by saved outreach',()=>{
 const map=new Map(data.contacts.map(c=>[c.id,c]));assert.equal(map.size,data.contacts.length);
 for(const old of original){const c=map.get(old.id);assert.ok(c,old.id);assert.equal(c.name,old.name);assert.equal(c.company,old.company);}
});
test('HR and TA contacts are included in the normal directory and can be filtered separately',()=>{
 const c={company:'Agency',title:'HR and Talent Acquisition Manager',verification:'Official team page'};
 assert.equal(recruiterContactKind(c),'HR / talent acquisition');assert.equal(matchesContactKind(c,'Recruiters & other contacts'),true);assert.equal(matchesContactKind(c,'HR / talent acquisition'),true);assert.equal(matchesContactKind(c,'Supplier account contacts'),false);
});
test('supplier account contacts retain their distinct classification',()=>{
 const c={company:'Agency',title:'Account Manager',verification:'Public OECM procurement contact'};
 assert.equal(matchesContactKind(c,'Recruiters & other contacts'),false);assert.equal(matchesContactKind(c,'Supplier account contacts'),true);
});
test('company counts include multiple people without collapsing them into one agency record',()=>{
 assert.deepEqual(companyContactCounts([{company:'B',title:'',verification:''},{company:'A',title:'',verification:''},{company:'B',title:'',verification:''}]),[['A',1],['B',2]]);
});
