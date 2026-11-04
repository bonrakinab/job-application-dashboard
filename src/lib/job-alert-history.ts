import {canonicalAlertUrl} from './job-alert-validation';
import {normalizeText} from './utils';
import type {Job} from './types';
export function alertAlreadySent(job:Pick<Job,'title'|'company'|'url'|'applyUrl'>,history:string[]){
 const urls=new Set([job.url,job.applyUrl].filter((v):v is string=>!!v).map(canonicalAlertUrl));
 return history.some(body=>{
  const links=body.replace(/&amp;/g,'&').match(/https:\/\/[^\s<>"']+/g)??[];
  if(links.some(link=>urls.has(canonicalAlertUrl(link))))return true;
  const text=normalizeText(body);return text.includes(normalizeText(job.title))&&text.includes(normalizeText(job.company));
 });
}
