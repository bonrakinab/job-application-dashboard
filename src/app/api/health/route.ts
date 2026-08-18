import { aiStatus } from '@/lib/ai';
import { gmailAuthorizationStatus, gmailRuntimeStatus } from '@/lib/gmail';

export const dynamic = 'force-dynamic';

function present(...values: Array<string | undefined>) {
  return values.some((value) => Boolean(value));
}

export async function GET() {
  const ai = aiStatus();
  const [gmail, gmailAuth] = await Promise.all([
    gmailRuntimeStatus(),
    gmailAuthorizationStatus(),
  ]);
  const checks = {
    supabase: present(process.env.SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL)
      && present(process.env.SUPABASE_SECRET_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY),
    dashboardAuth: present(process.env.DASHBOARD_PASSWORD) && present(process.env.AUTH_SECRET),
    ai: ai.configured,
    gemini: ai.gemini,
    openai: ai.openai,
    gmailConfigured: gmail.oauth,
    gmailAuthorized: gmailAuth.authorized,
    gmailDigest: Boolean(gmail.digest && gmailAuth.authorized),
    gmailClientId: gmail.clientId,
    gmailClientSecret: gmail.clientSecret,
    gmailRefreshToken: gmail.refreshToken || gmail.storedRefreshToken,
    gmailStoredConnection: gmail.storedConnection,
    gmailDigestTo: gmail.digestTo,
    cron: present(process.env.CRON_SECRET),
  };
  const issues = [
    !checks.supabase ? 'Supabase persistence is not configured.' : null,
    !checks.dashboardAuth ? 'Dashboard authentication is not fully configured.' : null,
    !checks.ai ? `Selected AI provider ${ai.provider} is not configured.` : null,
    checks.gmailConfigured && !checks.gmailAuthorized ? 'Gmail is configured but authorization is invalid; reconnect Gmail in Settings.' : null,
    gmail.digestTo && !checks.gmailAuthorized ? 'Daily Gmail digest delivery is paused until Gmail is reconnected.' : null,
  ].filter((value): value is string => Boolean(value));

  return Response.json({
    ok: checks.supabase && checks.dashboardAuth && checks.ai,
    degraded: issues.length > 0,
    mode: checks.supabase ? 'persistent' : 'demo',
    aiProvider: ai.provider,
    checks,
    issues,
    note: 'This endpoint reports configuration and authorization health without returning secret values.',
  }, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
