import type { Job } from './types';

// Title-only matching keeps incidental mentions of customer service in other jobs out.
export const CUSTOMER_SERVICE_TERMS = [
  'customer service', 'customer care', 'customer support', 'customer experience',
  'customer associate', 'customer representative', 'customer relations', 'customer success',
  'client service', 'client services', 'client care', 'client support', 'client experience',
  'contact centre', 'contact center', 'call centre', 'call center',
  'member service', 'member services', 'guest service', 'guest services', 'csr',
];
export const ONTARIO_CITIES = [
  'Toronto', 'Ottawa', 'Windsor', 'London', 'Hamilton', 'Mississauga', 'Brampton',
  'Markham', 'Vaughan', 'Richmond Hill', 'Oakville', 'Burlington', 'Milton',
  'Kitchener', 'Waterloo', 'Cambridge', 'Guelph', 'Brantford', 'Woodstock',
  'Oshawa', 'Whitby', 'Ajax', 'Pickering', 'Barrie', 'Orillia', 'Newmarket',
  'Aurora', 'Orangeville', 'Acton', 'Kingston', 'Belleville', 'Brockville',
  'Cornwall', 'Peterborough', 'Cobourg', 'Niagara', 'St. Catharines', 'Welland',
  'Sarnia', 'Chatham', 'Leamington', 'Tecumseh', 'Sudbury', 'Thunder Bay',
  'Sault Ste. Marie', 'North Bay', 'Timmins', 'New Liskeard', 'Temiskaming',
  'Kenora', 'Dryden', 'Fort Frances', 'Stratford', 'St. Thomas', 'Owen Sound',
];
const normal = (value: string) => value.toLowerCase().replace(/[–—_-]/g, ' ').replace(/\s+/g, ' ').trim();
export function isCustomerServiceJob(job: Pick<Job, 'title'>) {
  const title = normal(job.title);
  return CUSTOMER_SERVICE_TERMS.some(term => new RegExp(`\\b${term}\\b`).test(title));
}
export function isOntarioCustomerServiceJob(job: Pick<Job, 'title' | 'location' | 'remote' | 'workplaceType'>) {
  if (!isCustomerServiceJob(job)) return false;
  const location = normal(job.location ?? '');
  if (/\bontario,?\s+ca\b/.test(location)) return false;
  if (!/\bcanada\b/.test(location) && /\b(united states|usa|us|u\.s\.|california|england|united kingdom|connecticut|ohio)\b/.test(location)) return false;
  if (/\b(excluding|except|not available in)\s+ontario\b/.test(location)) return false;
  if (/\bontario\b/.test(location) || /(?:^|[,\s-])ON(?:$|[,\s-])/.test(job.location ?? '')) return true;
  // A city alone is ambiguous (e.g. London, England); require Canadian context.
  if (/\bcanada\b/.test(location) && ONTARIO_CITIES.some(city => location.includes(city.toLowerCase()))) return true;
  const remote = job.remote === true || /\b(remote|work from home)\b/.test(`${location} ${normal(job.workplaceType ?? '')}`);
  if (!remote || /\bhybrid\b/.test(normal(job.workplaceType ?? ''))) return false;
  // Do not turn province-restricted Canadian remote work into Ontario eligibility.
  if (/\b(quebec|québec|british columbia|alberta|manitoba|saskatchewan|nova scotia|new brunswick|newfoundland|pei|vancouver|calgary|montreal|montréal)\b/.test(location)) return false;
  return /\b(canada|worldwide|global|anywhere in the world|north america|americas)\b/.test(location);
}

// Keep this predicate in sync with jobs_customer_service_inventory_idx in the migration.
export const CUSTOMER_SERVICE_LOCATION_PATTERNS = [
  '*Ontario*', '*Canada*', '*Worldwide*', '*Global*', '*North America*',
  '*Americas*', '*Anywhere in the World*', '* ON', '* ON *', '* ON,*', 'ON-*',
];
// List pages do not need full descriptions, raw ATS payloads, or generated match explanations.
export const CUSTOMER_SERVICE_COLUMNS = 'id,external_id,source,source_key,url,apply_url,title,company,location,posted_at,discovered_at,last_seen_at,employment_type,remote,workplace_type,validity_status,health_score,last_verified_at,application_profile_id,job_matches(overall,recommendation,profile_id),applications(id,status,job_id)';
export function customerServiceQuery(offset: number, limit = 500) {
  const titles = CUSTOMER_SERVICE_TERMS.map(term => `title.ilike.*${term.replace(/ /g, '*')}*`);
  const places = CUSTOMER_SERVICE_LOCATION_PATTERNS.map(pattern => `location.ilike.${pattern.includes(',') ? JSON.stringify(pattern) : pattern}`);
  return `jobs?select=${CUSTOMER_SERVICE_COLUMNS}&and=${encodeURIComponent(`(or(${titles.join(',')}),or(${places.join(',')}))`)}&order=discovered_at.desc,id.asc&limit=${limit}&offset=${offset}`;
}
