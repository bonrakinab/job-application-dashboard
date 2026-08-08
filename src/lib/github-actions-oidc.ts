import { createPublicKey, verify as verifySignature } from 'node:crypto';

const ISSUER = 'https://token.actions.githubusercontent.com';
const JWKS_URL = `${ISSUER}/.well-known/jwks`;
const AUDIENCE = 'job-agent-production-smoke';
const REPOSITORY = 'bonrakinab/job-application-dashboard';
const REF = 'refs/heads/main';
const WORKFLOW_SUFFIX = '/.github/workflows/production-smoke.yml@refs/heads/main';

type Claims = Record<string, unknown> & {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  repository?: string;
  ref?: string;
  event_name?: string;
  job_workflow_ref?: string;
  workflow_ref?: string;
};

function decodeJson(part: string) {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;
}

function audienceMatches(value: Claims['aud']) {
  return Array.isArray(value) ? value.includes(AUDIENCE) : value === AUDIENCE;
}

export async function verifyGitHubActionsOidc(request: Request): Promise<Claims> {
  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) throw new Error('Missing GitHub Actions OIDC token.');
  const token = authorization.slice('Bearer '.length).trim();
  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature) throw new Error('Malformed GitHub Actions OIDC token.');

  const header = decodeJson(encodedHeader) as { alg?: string; kid?: string };
  const claims = decodeJson(encodedPayload) as Claims;
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Unexpected GitHub OIDC signing algorithm.');

  const response = await fetch(JWKS_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Unable to load GitHub OIDC signing keys (${response.status}).`);
  const jwks = await response.json() as { keys?: Array<Record<string, unknown> & { kid?: string }> };
  const jwk = jwks.keys?.find((key) => key.kid === header.kid);
  if (!jwk) throw new Error('GitHub OIDC signing key was not found.');

  const publicKey = createPublicKey({ key: jwk as never, format: 'jwk' });
  const valid = verifySignature(
    'RSA-SHA256',
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    publicKey,
    Buffer.from(encodedSignature, 'base64url'),
  );
  if (!valid) throw new Error('Invalid GitHub Actions OIDC signature.');

  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== ISSUER) throw new Error('Unexpected GitHub OIDC issuer.');
  if (!audienceMatches(claims.aud)) throw new Error('Unexpected GitHub OIDC audience.');
  if (typeof claims.exp !== 'number' || claims.exp <= now) throw new Error('Expired GitHub OIDC token.');
  if (typeof claims.nbf === 'number' && claims.nbf > now + 30) throw new Error('GitHub OIDC token is not active yet.');
  if (claims.repository !== REPOSITORY) throw new Error('Unexpected GitHub repository claim.');
  if (claims.ref !== REF) throw new Error('Production smoke tests must originate from main.');
  if (claims.event_name !== 'push') throw new Error('Production smoke tests must originate from a push workflow.');
  const workflowRef = claims.job_workflow_ref ?? claims.workflow_ref;
  if (typeof workflowRef !== 'string' || !workflowRef.endsWith(WORKFLOW_SUFFIX)) {
    throw new Error('Unexpected GitHub workflow claim.');
  }

  return claims;
}
