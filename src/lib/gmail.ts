import { getStoredGmailRefreshToken, hasStoredGmailConnection, validateGoogleAccessToken } from './google-oauth';

function base64Url(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function present(value: string | undefined) {
  return Boolean(value?.trim());
}

export function preferredGmailRefreshToken(storedToken?: string | null, envToken?: string | null) {
  const stored = storedToken?.trim();
  if (stored) return stored;
  const env = envToken?.trim();
  return env || null;
}

async function refreshTokenValue() {
  let storedToken: string | null = null;
  try {
    storedToken = await getStoredGmailRefreshToken();
  } catch {
    // A dashboard-stored credential is preferred, but an environment fallback can still keep Gmail working.
  }
  return preferredGmailRefreshToken(storedToken, process.env.GOOGLE_REFRESH_TOKEN);
}

async function accessToken() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = await refreshTokenValue();
  if (!clientId || !clientSecret || !refreshToken) return null;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Google OAuth ${response.status}: ${(await response.text()).slice(0, 500)}`);
  const json = await response.json() as { access_token?: string };
  return json.access_token ?? null;
}

export function gmailConfigStatus(env: NodeJS.ProcessEnv = process.env) {
  const clientId = present(env.GOOGLE_CLIENT_ID);
  const clientSecret = present(env.GOOGLE_CLIENT_SECRET);
  const refreshToken = present(env.GOOGLE_REFRESH_TOKEN);
  const digestTo = present(env.GMAIL_DIGEST_TO);
  const oauth = clientId && clientSecret && refreshToken;

  return {
    oauth,
    digest: oauth && digestTo,
    clientId,
    clientSecret,
    refreshToken,
    digestTo,
  };
}

export async function gmailRuntimeStatus() {
  const env = gmailConfigStatus();
  let storedConnection = false;
  let storedRefreshToken = false;
  try {
    storedConnection = await hasStoredGmailConnection();
    if (storedConnection) storedRefreshToken = Boolean(await getStoredGmailRefreshToken());
  } catch {
    storedRefreshToken = false;
  }
  const oauth = env.clientId && env.clientSecret && (storedRefreshToken || env.refreshToken);
  const credentialSource = storedRefreshToken ? 'stored' : env.refreshToken ? 'environment' : 'none';
  return {
    ...env,
    oauth,
    digest: oauth && env.digestTo,
    storedConnection,
    storedRefreshToken,
    credentialSource,
  };
}

export async function gmailConfigured() {
  return (await gmailRuntimeStatus()).oauth;
}

export async function gmailDigestConfigured() {
  return (await gmailRuntimeStatus()).digest;
}

export async function validateGmailOAuth() {
  const token = await accessToken();
  if (!token) throw new Error('Gmail OAuth is not configured.');

  await validateGoogleAccessToken(token);
  return { ok: true };
}

export async function gmailAuthorizationStatus() {
  const runtime = await gmailRuntimeStatus();
  if (!runtime.oauth) {
    return { authorized: false, error: 'Gmail OAuth is not configured.' };
  }
  try {
    await validateGmailOAuth();
    return { authorized: true, error: null as string | null };
  } catch (error) {
    return {
      authorized: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function sendDigest(subject: string, text: string) {
  const to = process.env.GMAIL_DIGEST_TO;
  const token = await accessToken();
  if (!to || !token) return { skipped: true };
  const mime = [`To: ${to}`, `Subject: ${subject}`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset="UTF-8"', '', text].join('\r\n');
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: base64Url(mime) }),
  });
  if (!response.ok) throw new Error(`Gmail ${response.status}: ${(await response.text()).slice(0, 600)}`);
  return { skipped: false, result: await response.json() };
}

export async function createOutreachDraft(subject: string, text: string, to?: string) {
  const token = await accessToken();
  if (!token) throw new Error('Gmail OAuth is not configured.');
  const headers = [
    to ? `To: ${to}` : null,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    text,
  ].filter((value): value is string => value !== null);
  const raw = base64Url(headers.join('\r\n'));
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { raw } }),
  });
  if (!response.ok) throw new Error(`Gmail ${response.status}: ${(await response.text()).slice(0, 600)}`);
  return response.json() as Promise<{ id?: string; message?: { id?: string; threadId?: string } }>;
}

// Read only previous JobAgent/Ontario alert messages, not unrelated mailbox content.
// A failed history check is an error so the caller cannot silently resend listings.
export async function readJobAlertHistory() {
  const token=await accessToken();
  if(!token)throw new Error('Gmail alert history could not be checked: OAuth is not configured.');
  const auth={Authorization:`Bearer ${token}`};
  const query='in:sent newer_than:90d {subject:"Ontario Job Alert" subject:"Job Agent:" subject:"Windsor part-time" subject:"Ontario Customer Representative Job Alert" subject:"Ontario Customer Associate Job Alert"}';
  const ids:{id:string}[]=[];let page:string|undefined;
  do{
    const params=new URLSearchParams({q:query,maxResults:'100',...(page?{pageToken:page}:{})});
    const list=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?'+params,{headers:auth,cache:'no-store',signal:AbortSignal.timeout(10_000)});
    if(!list.ok)throw new Error(`Gmail alert history ${list.status}`);
    const found=await list.json() as {messages?:{id:string}[];nextPageToken?:string};ids.push(...found.messages??[]);page=found.nextPageToken;
    if(page&&ids.length>=1000)throw new Error('Gmail alert history exceeds the safe scan limit; refusing an incomplete deduplication check.');
  }while(page);
  const messages:string[]=[];
  const decode=(part:any):string=>[part?.body?.data?Buffer.from(part.body.data,'base64url').toString('utf8'):'',...(part?.parts??[]).map(decode)].join('\n');
  for(let start=0;start<ids.length;start+=5){
    const batch=await Promise.all(ids.slice(start,start+5).map(async({id})=>{
      const r=await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`,{headers:auth,cache:'no-store',signal:AbortSignal.timeout(10_000)});
      if(!r.ok)throw new Error(`Gmail alert message ${r.status}`);
      const value=await r.json() as {payload?:unknown};return decode(value.payload);
    }));messages.push(...batch);
  }
  return messages;
}
