import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { deleteRows, supabaseRequest, upsertRows } from './supabase-rest';

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.compose';
const PROVIDER = 'gmail';
const STATE_TTL_MS = 10 * 60 * 1000;

type StoredConnection = {
  provider: string;
  refresh_token_ciphertext: string;
  scope?: string | null;
  connected_at?: string;
  updated_at?: string;
};

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is required for Google OAuth.');
  return secret;
}

function encryptionKey() {
  return createHash('sha256').update(authSecret()).digest();
}

function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join(':');
}

function decrypt(value: string) {
  const [version, ivRaw, tagRaw, dataRaw] = value.split(':');
  if (version !== 'v1' || !ivRaw || !tagRaw || !dataRaw) throw new Error('Stored Gmail credential format is invalid.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export async function getStoredGmailRefreshToken() {
  const rows = await supabaseRequest<StoredConnection[]>(
    `oauth_connections?provider=eq.${PROVIDER}&select=provider,refresh_token_ciphertext,scope,connected_at,updated_at&limit=1`,
  );
  const row = rows[0];
  return row?.refresh_token_ciphertext ? decrypt(row.refresh_token_ciphertext) : null;
}

export async function hasStoredGmailConnection() {
  const rows = await supabaseRequest<Array<{ provider: string }>>(
    `oauth_connections?provider=eq.${PROVIDER}&select=provider&limit=1`,
  );
  return Boolean(rows[0]);
}

export async function saveStoredGmailConnection(refreshToken: string, scope?: string) {
  if (!refreshToken.trim()) throw new Error('Google did not return a refresh token.');
  const now = new Date().toISOString();
  await upsertRows<StoredConnection>('oauth_connections', [{
    provider: PROVIDER,
    refresh_token_ciphertext: encrypt(refreshToken),
    scope: scope || GMAIL_SCOPE,
    connected_at: now,
    updated_at: now,
  }], 'provider');
}

export async function deleteStoredGmailConnection() {
  await deleteRows<StoredConnection>(`oauth_connections?provider=eq.${PROVIDER}`);
}

function stateSignature(payload: string) {
  return createHmac('sha256', authSecret()).update(payload).digest('base64url');
}

export function createGoogleOAuthState(returnTo = '/settings') {
  const safeReturnTo = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/settings';
  const payload = Buffer.from(JSON.stringify({
    iat: Date.now(),
    nonce: randomBytes(16).toString('base64url'),
    returnTo: safeReturnTo,
  }), 'utf8').toString('base64url');
  return `${payload}.${stateSignature(payload)}`;
}

export function verifyGoogleOAuthState(state: string) {
  const [payload, signature] = state.split('.');
  if (!payload || !signature) throw new Error('Invalid Google OAuth state.');
  const expected = Buffer.from(stateSignature(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error('Invalid Google OAuth state signature.');
  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { iat?: number; returnTo?: string };
  if (typeof decoded.iat !== 'number' || Date.now() - decoded.iat > STATE_TTL_MS || decoded.iat > Date.now() + 30_000) {
    throw new Error('Google OAuth state expired.');
  }
  return decoded.returnTo?.startsWith('/') && !decoded.returnTo.startsWith('//') ? decoded.returnTo : '/settings';
}

export function googleOAuthCallbackUrl(request: Request) {
  const url = new URL(request.url);
  return `${url.origin}/api/auth/google/callback`;
}

export function googleAuthorizationUrl(request: Request, returnTo = '/settings') {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Google OAuth client ID/secret are not configured.');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleOAuthCallbackUrl(request),
    response_type: 'code',
    scope: GMAIL_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: createGoogleOAuthState(returnTo),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleAuthorizationCode(code: string, redirectUri: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Google OAuth client ID/secret are not configured.');

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Google OAuth ${response.status}: ${(await response.text()).slice(0, 500)}`);
  return response.json() as Promise<{
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  }>;
}

export async function validateGoogleAccessToken(accessToken: string) {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts?maxResults=1', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Gmail authorization ${response.status}: ${(await response.text()).slice(0, 500)}`);
}
