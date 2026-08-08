import { createHmac, timingSafeEqual } from 'node:crypto';

export const AUTH_COOKIE = 'job_agent_session';

function secret() { return process.env.AUTH_SECRET || ''; }

export function authEnabled() { return Boolean(process.env.DASHBOARD_PASSWORD && secret()); }

export function sessionToken() {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password || !secret()) return '';
  return createHmac('sha256', secret()).update(`job-agent:${password}`).digest('hex');
}

export function validPassword(candidate: string) {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) return true;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function validSession(candidate?: string) {
  if (!authEnabled()) return true;
  const expected = sessionToken();
  if (!candidate || candidate.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(expected));
}
