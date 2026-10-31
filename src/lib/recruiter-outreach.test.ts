import test from 'node:test';
import assert from 'node:assert/strict';
import {validateOutreach} from './recruiter-outreach';
const record={stage:'Contacted',notes:'Sent relevant introduction',due:'2026-11-06',activities:[{at:'2026-10-31T00:00:00.000Z',channel:'Email',note:'First message'}]};
test('outreach preserves stages, due dates and interaction history, while discarding caller scope',()=>{
 const v=validateOutreach({id:'contact-abc',record:{...record,profile_id:'part-time',userId:'other'}});assert.deepEqual(v,{id:'contact-abc',record});
});
test('invalid tracking values and unsafe custom-contact URLs are rejected',()=>{
 for(const value of [{id:'../other',record},{id:'x',record:{...record,stage:'Fake'}},{id:'x',record:{...record,due:'tomorrow'}},{id:'x',record:{...record,activities:[{at:'bad'}]}},{id:'custom-1',record:{...record,custom:{id:'custom-1',name:'Name',company:'Firm',domains:[],source:'javascript:alert(1)'}}}])assert.throws(()=>validateOutreach(value));
});
test('a valid manual contact can be saved without guessing a public email',()=>{
 const custom={id:'custom-1',name:'Recruiter',company:'Agency',title:'Consultant',location:'Ontario',source:'https://example.com/team',verification:'User-added',domains:['Software Engineering'],email:''};assert.deepEqual(validateOutreach({id:'custom-1',record:{...record,custom}}).record.custom,custom);
});
