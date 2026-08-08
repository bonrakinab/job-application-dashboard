import { NextResponse } from 'next/server';
import {
  exchangeGoogleAuthorizationCode,
  googleOAuthCallbackUrl,
  saveStoredGmailConnection,
  validateGoogleAccessToken,
  verifyGoogleOAuthState,
} from '@/lib/google-oauth';
import { logActivity } from '@/lib/store';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get('error');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  try {
    if (error) throw new Error(`Google authorization was not completed: ${error}`);
    if (!code || !state) throw new Error('Google authorization response is incomplete.');

    const returnTo = verifyGoogleOAuthState(state);
    const tokens = await exchangeGoogleAuthorizationCode(code, googleOAuthCallbackUrl(request));
    if (!tokens.access_token) throw new Error('Google did not return an access token.');
    if (!tokens.refresh_token) throw new Error('Google did not return a refresh token. Please reconnect and approve access again.');

    await validateGoogleAccessToken(tokens.access_token);
    await saveStoredGmailConnection(tokens.refresh_token, tokens.scope);
    await logActivity('gmail.oauth.connected', undefined, {
      connectedAt: new Date().toISOString(),
      scope: tokens.scope ?? 'gmail.compose',
    });

    const destination = new URL(returnTo, request.url);
    destination.searchParams.set('gmail', 'connected');
    return NextResponse.redirect(destination);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    try {
      await logActivity('gmail.oauth.failed', undefined, { message, failedAt: new Date().toISOString() });
    } catch {
      // Do not mask the OAuth error if logging fails.
    }
    const destination = new URL('/settings', request.url);
    destination.searchParams.set('gmail', 'error');
    destination.searchParams.set('message', message.slice(0, 300));
    return NextResponse.redirect(destination);
  }
}
