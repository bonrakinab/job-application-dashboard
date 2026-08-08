import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, authEnabled, validSession } from '@/lib/auth';

function privateDataConfigured() {
  return Boolean((process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
}

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === '/api/health' || path === '/api/internal/smoke/ai' || path.startsWith('/api/cron/')) return NextResponse.next();

  if (process.env.NODE_ENV === 'production' && privateDataConfigured() && !authEnabled()) {
    return new NextResponse('Dashboard authentication must be configured before private Supabase data can be exposed.', { status: 503 });
  }

  if (!authEnabled()) return NextResponse.next();
  if (path === '/login' || path === '/api/auth/login') return NextResponse.next();
  const session = request.cookies.get(AUTH_COOKIE)?.value;
  if (validSession(session)) return NextResponse.next();
  if (path.startsWith('/api/')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
