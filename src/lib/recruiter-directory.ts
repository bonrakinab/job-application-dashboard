export type DirectoryContact = {company:string;title:string;verification:string;notes?:string;contactKind?:string};
export const contactKinds=['Recruiter / staffing consultant','HR / talent acquisition','Leadership / referral contact','Supplier account contacts'] as const;
export function recruiterContactKind(c:DirectoryContact):string {
  if(c.contactKind&&contactKinds.includes(c.contactKind as typeof contactKinds[number]))return c.contactKind;
  if(/procurement contact|supplier agreement/i.test(c.verification+' '+(c.notes||'')))return 'Supplier account contacts';
  if(/\bHR\b|human resources|talent acquisition|people.*culture/i.test(c.title))return 'HR / talent acquisition';
  if(/recruit|placement|permanent.*search|employment specialist|staffing consultant|personnel consultant/i.test(c.title))return 'Recruiter / staffing consultant';
  return 'Leadership / referral contact';
}
export function matchesContactKind(c:DirectoryContact,filter:string) {
 const kind=recruiterContactKind(c);
 return filter==='All contact types'||(filter==='Recruiters & other contacts'?kind!=='Supplier account contacts':kind===filter);
}
export function companyContactCounts(contacts:DirectoryContact[]) {
 const counts=new Map<string,number>();for(const c of contacts)counts.set(c.company,(counts.get(c.company)||0)+1);
 return [...counts.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
}

export function normalizedAgencyName(name:string){return name.toLowerCase().replace(/\b(incorporated|inc|limited|ltd|corporation|corp)\b/g,'').replace(/[^a-z0-9]/g,'');}
