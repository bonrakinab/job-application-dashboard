import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { CUSTOMER_SERVICE_TERMS, CUSTOMER_SERVICE_LOCATION_PATTERNS, customerServiceQuery, isOntarioCustomerServiceJob } from './customer-service-jobs';
const job = (location: string, title = 'Customer Service Representative', remote = false) => ({ location, title, remote });
test('covers Ontario cities and all employment profiles without score gating', () => {
  for (const location of ['Windsor, ON', 'Kenora, Ontario', 'New Liskeard, Ontario', 'Toronto, Canada', 'ON-Ottawa']) {
    assert.equal(isOntarioCustomerServiceJob(job(location)), true, location);
  }
  for (const title of ['Customer Experience Associate', 'Client Services Representative', 'Call Centre Agent', 'CSR', 'Customer Support Specialist']) {
    assert.equal(isOntarioCustomerServiceJob(job('Ottawa, Ontario', title)), true, title);
  }
});
test('requires Ontario eligibility for remote roles and excludes ambiguous foreign cities', () => {
  for (const location of ['Remote Canada', 'Worldwide', 'North America']) assert.equal(isOntarioCustomerServiceJob(job(location, undefined, true)), true);
  for (const location of ['Remote', 'USA Only', 'Ontario, California', 'Ontario, CA, US, 91761', 'London, England', 'Vancouver, British Columbia, Canada', 'Canada excluding Ontario']) {
    assert.equal(isOntarioCustomerServiceJob(job(location, undefined, true)), false, location);
  }
  assert.equal(isOntarioCustomerServiceJob(job('Toronto, ON', 'Software Engineer')), false);
});
test('query applies role and location scope before paginating without the main inventory cap', () => {
  const query = decodeURIComponent(customerServiceQuery(3500));
  assert.match(query, /and=\(or\(title/);
  assert.match(query, /location.ilike.\*Ontario\*/);
  assert.match(query, /offset=3500$/);
});

test('list query stays lean and every predicate is covered by its partial index', () => {
  const query = decodeURIComponent(customerServiceQuery(0));
  assert.ok(!query.includes('select=*'));
  assert.ok(!query.includes('raw'));
  assert.ok(!query.includes('description'));
  assert.ok(query.includes('job_matches(overall,recommendation,profile_id)'));
  const migration = readFileSync(new URL('../../supabase/migrations/20261113084021_customer_service_role_inventory_index.sql', import.meta.url), 'utf8');
  for (const term of CUSTOMER_SERVICE_TERMS) assert.ok(migration.includes("title ilike '%" + term.replace(/ /g, '%') + "%'"));
  for (const pattern of CUSTOMER_SERVICE_LOCATION_PATTERNS) assert.ok(migration.includes("location ilike '" + pattern.replace(/\*/g, '%') + "'"));
});
