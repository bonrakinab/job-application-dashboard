import { NextResponse } from 'next/server';
import { AUTH_COOKIE, sessionToken, validPassword } from '@/lib/auth';

export async function POST(request: Request) {
  const data = await request.formData();
  const password = String(data.get('password') ?? '');
  if (!validPassword(password)) return NextResponse.redirect(new URL('/login?error=1', request.url), 303);
  const response = NextResponse.redirect(new URL('/', request.url), 303);
  response.cookies.set(AUTH_COOKIE, sessionToken(), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 });
  return response;
}
