import { aiStatus } from '@/lib/ai';
import { gmailRuntimeStatus } from '@/lib/gmail';

export const dynamic = 'force-dynamic';

function present(...values: Array<string | undefined>) {
  return values.some((value) => Boolean(value));
}

export async function GET() {
  const ai = aiStatus();
  const gmail = await gmailRuntimeStatus();
  const checks = {
    supabase: present(process.env.SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL)
      && present(process.env.SUPABASE_SECRET_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY),
    dashboardAuth: present(process.env.DASHBOARD_PASSWORD) && present(process.env.AUTH_SECRET),
    ai: ai.configured,
    gemini: ai.gemini,
    openai: ai.openai,
    gmail: gmail.oauth,
    gmailOauth: gmail.oauth,
    gmailDigest: gmail.digest,
    gmailClientId: gmail.clientId,
    gmailClientSecret: gmail.clientSecret,
    gmailRefreshToken: gmail.refreshToken || gmail.storedRefreshToken,
    gmailStoredConnection: gmail.storedRefreshToken,
    gmailDigestTo: gmail.digestTo,
    cron: present(process.env.CRON_SECRET),
  };

  return Response.json({
    ok: true,
    mode: checks.supabase ? 'persistent' : 'demo',
    aiProvider: ai.provider,
    checks,
    note: 'This endpoint reports configuration presence only. It never returns secret values.',
  }, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
