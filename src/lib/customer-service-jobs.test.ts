import assert from 'node:assert/strict';
import test from 'node:test';
import { customerServiceQuery, isOntarioCustomerServiceJob } from './customer-service-jobs';
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
