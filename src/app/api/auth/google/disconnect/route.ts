import { NextResponse } from 'next/server';
import { deleteStoredGmailConnection } from '@/lib/google-oauth';
import { logActivity } from '@/lib/store';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  await deleteStoredGmailConnection();
  await logActivity('gmail.oauth.disconnected', undefined, { disconnectedAt: new Date().toISOString() });
  return NextResponse.redirect(new URL('/settings?gmail=disconnected', request.url), 303);
}
