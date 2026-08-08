function base64Url(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function present(value: string | undefined) {
  return Boolean(value?.trim());
}

async function accessToken() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
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

export function gmailConfigured() {
  return gmailConfigStatus().oauth;
}

export function gmailDigestConfigured() {
  return gmailConfigStatus().digest;
}

export async function validateGmailOAuth() {
  const token = await accessToken();
  if (!token) throw new Error('Gmail OAuth is not configured.');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Gmail profile ${response.status}: ${(await response.text()).slice(0, 600)}`);
  return { ok: true };
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
