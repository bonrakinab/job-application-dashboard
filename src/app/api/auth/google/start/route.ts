import { NextResponse } from 'next/server';
import { googleAuthorizationUrl } from '@/lib/google-oauth';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    return NextResponse.redirect(googleAuthorizationUrl(request, '/settings'));
  } catch (error) {
    const message = encodeURIComponent(error instanceof Error ? error.message : String(error));
    return NextResponse.redirect(new URL(`/settings?gmail=error&message=${message}`, request.url));
  }
}
